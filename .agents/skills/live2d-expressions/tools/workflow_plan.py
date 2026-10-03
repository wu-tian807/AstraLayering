"""Validate and plan the expression DAG; never invoke a model or execute shell text.

The SKILL dispatcher executes each ready task, then records its actual artifacts.
Successful records bind input and output hashes. Repair invalidates only the selected
upstream targets and their descendants, and has a persistent per-gate round limit.
"""
from __future__ import annotations

import argparse
from copy import deepcopy
import hashlib
from itertools import product
import json
import math
import re
from pathlib import Path, PurePosixPath
import sys

import jsonschema
import yaml


TOOLS = Path(__file__).resolve().parent
SCHEMA = Path(__file__).with_name('workflow.schema.json')
DEFAULT_CONFIG = TOOLS.parent / 'workflow.yaml'
BASIC_FACE_V1_GROUPS = (
    ('eye.left.open', 'eye.left.curve'), ('eye.right.open', 'eye.right.curve'),
    ('brow.left.height', 'brow.left.angle', 'brow.left.curve'),
    ('brow.right.height', 'brow.right.angle', 'brow.right.curve'),
    ('mouth.open', 'mouth.form'),
)
BASIC_FACE_V1_PARAMETERS = {
    name: {'min': 0 if name.endswith('.open') else -1, 'max': 1,
           'default': 1 if name.startswith('eye.') and name.endswith('.open') else 0}
    for group in BASIC_FACE_V1_GROUPS for name in group
}


class WorkflowError(ValueError):
    pass


def validate_capability_profile(document, profile):
    """Require the complete facial contract; generic unprofiled rigs stay valid.

    Geometry effectiveness is measured by the runtime and checked separately in
    scan evidence. This gate never substitutes parameter names for that proof.
    """
    if profile != 'basic-face-v1' or document.get('capability_profile') != profile:
        raise WorkflowError(f'capability profile must be {profile}')
    is_scope = 'public_controls' in document
    if is_scope:
        controls = document['public_controls']
        parameters = {p['id']: {'type': 'number', **p} for p in controls}
        if len(parameters) != len(controls):
            raise WorkflowError('basic-face-v1 scope has duplicate parameter ids')
    else:
        parameters = document.get('parameters', {})
    for name, expected in BASIC_FACE_V1_PARAMETERS.items():
        actual = parameters.get(name)
        if (not isinstance(actual, dict) or actual.get('type') != 'number'
                or any(type(actual.get(key)) not in (int, float) or actual[key] != value
                       for key, value in expected.items())):
            raise WorkflowError(f'basic-face-v1 missing/invalid parameter {name}: expected {expected}')
    for group in BASIC_FACE_V1_GROUPS:
        matches = []
        for region in document.get('regions', []):
            ids = region.get('parameter_ids', []) if is_scope else [a['parameter'] for a in region.get('axes', [])]
            if len(ids) == len(group) and set(ids) == set(group):
                matches.append(region)
        if len(matches) != 1:
            raise WorkflowError('basic-face-v1 needs one joint region for ' + ' × '.join(group))
        if is_scope:
            continue
        region = matches[0]
        grid = []
        for axis in region['axes']:
            name, keys = axis['parameter'], axis['keys']
            expected = BASIC_FACE_V1_PARAMETERS[name]
            if (len(keys) < 2 or any(type(v) not in (int, float) or not math.isfinite(v) for v in keys)
                    or any(a >= b for a, b in zip(keys, keys[1:]))
                    or keys[0] != expected['min'] or keys[-1] != expected['max']
                    or expected['default'] not in keys):
                raise WorkflowError(f'basic-face-v1 axis {name} must cover min/default/max')
            grid.append(keys)
        expected_cells = set(product(*grid))
        if document.get('document_type') == 'boundary_recipe':
            cells = [tuple(k['at']) for k in region.get('keyforms', [])]
            if len(cells) != len(expected_cells) or set(cells) != expected_cells:
                raise WorkflowError(f'basic-face-v1 incomplete keyform grid in {region["id"]}')
        elif document.get('document_type') == 'boundary_rig':
            bindings = [b for b in document.get('bindings', []) if b['region'] == region['id']]
            if not any(b['property'] in ('d', 'transform') for b in bindings):
                raise WorkflowError(f'basic-face-v1 missing geometry binding in {region["id"]}')
            if any(len(b['keyforms']) != len(expected_cells) for b in bindings):
                raise WorkflowError(f'basic-face-v1 incomplete compiled grid in {region["id"]}')


def validate_capability_evidence(scan, profile):
    if scan.get('capability_profile') != profile:
        raise WorkflowError(f'scan must declare capability_profile {profile}')
    evidence = scan.get('capabilities') or {}
    if evidence.get('profile') != profile or not set(BASIC_FACE_V1_PARAMETERS) <= set(evidence.get('parameters', [])):
        raise WorkflowError(f'{profile}: missing complete runtime capability evidence')
    required = [(name, {}) for name in BASIC_FACE_V1_PARAMETERS]
    required += [('eye.' + side + '.curve', {'eye.' + side + '.open': 0}) for side in ('left', 'right')]
    for name, conditions in required:
        matches = [row for row in evidence.get('effects', [])
                   if row.get('parameter') == name and row.get('conditions') == conditions]
        delta = matches[0].get('maximum_coordinate_delta') if len(matches) == 1 else None
        if type(delta) not in (int, float) or not math.isfinite(delta) or delta <= 1e-6:
            raise WorkflowError(f'{profile}: missing/ineffective geometry for {name} at {conditions}')


class UniqueLoader(yaml.SafeLoader):
    pass


def unique_mapping(loader, node):
    result = {}
    for key_node, value_node in node.value:
        key = loader.construct_object(key_node)
        if not isinstance(key, str) or key in result:
            raise WorkflowError(f'duplicate or non-string YAML key: {key!r}')
        result[key] = loader.construct_object(value_node)
    return result


UniqueLoader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, unique_mapping)


def unique_json(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise WorkflowError(f'duplicate JSON key: {key}')
        result[key] = value
    return result


def read_json(path):
    try:
        return json.loads(Path(path).read_text(encoding='utf-8-sig'), object_pairs_hook=unique_json,
                          parse_constant=lambda value: (_ for _ in ()).throw(WorkflowError(f'nonfinite JSON: {value}')))
    except (OSError, json.JSONDecodeError) as error:
        raise WorkflowError(f'{path}: {error}') from error


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False,
                                     separators=(',', ':'), allow_nan=False).encode()).hexdigest()


def within(path, root):
    return path == root or root in path.parents


def relative_path(value, label):
    path = PurePosixPath(value)
    if not value or '\\' in value or ':' in value or path.is_absolute() or '..' in path.parts or str(path) == '.':
        raise WorkflowError(f'{label}: expected a nonempty relative path without traversal: {value!r}')
    return path


def child_path(root, value, label):
    path = root / relative_path(value, label)
    if not within(path.resolve(), root.resolve()):
        raise WorkflowError(f'{label}: symlink escapes root: {path}')
    if any(part.is_symlink() for part in (path, *path.parents) if within(part, root)):
        raise WorkflowError(f'{label}: output/artifact path contains a symlink: {path}')
    return path


def snapshot(path, required=False):
    path = Path(path)
    if not path.exists():
        if required:
            raise WorkflowError(f'missing artifact/input: {path}')
        return None
    if path.is_symlink():
        raise WorkflowError(f'artifact/resource symlinks are not allowed: {path}')
    if path.is_file():
        return {'type': 'file', 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
    if not path.is_dir():
        raise WorkflowError(f'not a regular file or directory: {path}')
    files = {}
    for item in sorted(path.rglob('*')):
        if item.is_symlink() or not (item.is_file() or item.is_dir()):
            raise WorkflowError(f'nonregular directory artifact member: {item}')
        if item.is_file():
            files[item.relative_to(path).as_posix()] = hashlib.sha256(item.read_bytes()).hexdigest()
    return {'type': 'directory', 'files': files, 'sha256': digest(files)}


class Workflow:
    def __init__(self, config=DEFAULT_CONFIG):
        self.path = Path(config).resolve()
        try:
            self.data = yaml.load(self.path.read_text(encoding='utf-8-sig'), Loader=UniqueLoader)
            jsonschema.Draft202012Validator(read_json(SCHEMA)).validate(self.data)
        except (OSError, yaml.YAMLError, jsonschema.ValidationError) as error:
            raise WorkflowError(f'{self.path}: {error}') from error
        self.tasks = self.data['tasks']
        self.resources = {}
        for name, value in self.data['resources'].items():
            # Every package resolves resources from its own skill root. No
            # legacy agent-tools fallback or cross-skill resource dependency.
            relative = relative_path(value, 'resource ' + name)
            target = (self.path.parent / relative).resolve()
            if not within(target, self.path.parent):
                raise WorkflowError(f'resource {name}: outside skill root: {value}')
            if not target.is_file():
                raise WorkflowError(f'resource {name}: missing file: {target}')
            self.resources[name] = target
        self.order = self._topological_order()
        self.ancestors = {}
        for name in self.order:
            parents = self.tasks[name]['needs']
            self.ancestors[name] = set(parents).union(*(self.ancestors[p] for p in parents))
        self._validate_links()

    def _topological_order(self):
        for name, task in self.tasks.items():
            for dependency in task['needs']:
                if dependency not in self.tasks:
                    raise WorkflowError(f'{name}: unknown dependency {dependency}')
        remaining, result = set(self.tasks), []
        while remaining:
            ready = sorted(name for name in remaining if set(self.tasks[name]['needs']) <= set(result))
            if not ready:
                raise WorkflowError(f'dependency cycle: {", ".join(sorted(remaining))}')
            result.extend(ready)
            remaining.difference_update(ready)
        return result

    def _resource(self, name, label):
        if name not in self.resources:
            raise WorkflowError(f'{label}: unknown resource {name}')
        return self.resources[name]

    def _validate_links(self):
        paths = []
        for name, task in self.tasks.items():
            for label, ref in task['inputs'].items():
                if 'input' in ref and ref['input'] not in self.data['inputs']:
                    raise WorkflowError(f'{name}.{label}: unknown input {ref["input"]}')
                if 'resource' in ref:
                    self._resource(ref['resource'], name + '.' + label)
                if 'artifact' in ref:
                    producer, output = ref['artifact'].split('.')
                    if producer not in self.ancestors[name]:
                        raise WorkflowError(f'{name}.{label}: artifact producer must be an explicit dependency ancestor: {producer}')
                    if output not in self.tasks[producer]['outputs']:
                        raise WorkflowError(f'{name}.{label}: unknown artifact {ref["artifact"]}')
                    if 'path' in ref:
                        relative_path(ref['path'], name + '.' + label)
                        if self.tasks[producer]['outputs'][output]['type'] != 'directory':
                            raise WorkflowError(f'{name}.{label}: artifact subpath requires a directory')
            for label, output in task['outputs'].items():
                path = relative_path(output['path'], name + '.' + label)
                for owner, existing in paths:
                    if path == existing or path in existing.parents or existing in path.parents:
                        raise WorkflowError(f'output ownership overlap: {name}.{label} and {owner}')
                paths.append((name + '.' + label, path))
                if 'required_files' in output and output['type'] != 'directory':
                    raise WorkflowError(f'{name}.{label}: required_files only applies to directory outputs')
                for member in output.get('required_files', []):
                    relative_path(member, name + '.' + label)
                for check in output.get('checks', []):
                    self._resource(check['schema'], name + '.' + label)
                    if output['type'] == 'directory' and 'path' not in check:
                        raise WorkflowError(f'{name}.{label}: directory schema check needs a file path')
                    if output['type'] == 'file' and 'path' in check:
                        raise WorkflowError(f'{name}.{label}: file schema check cannot select a subpath')
                    if 'path' in check:
                        relative_path(check['path'], name + '.' + label)
            if task['kind'] != 'tool':
                self._resource(task['prompt'], name)
                if task['model'] not in self.data['models']:
                    raise WorkflowError(f'{name}: unknown model profile {task["model"]}')
            else:
                entry = self._resource(task['command']['entry'], name)
                parts = entry.relative_to(self.path.parent).parts
                shared = len(parts) >= 2 and parts[0] == 'tools'
                step = (len(parts) >= 3 and re.fullmatch(r'[1-9][0-9]*\..+', parts[0])
                        and 'tools' in parts[1:-1])
                if not (shared or step):
                    raise WorkflowError(f'{name}: executable entry must be in skill tools or numbered step tools')
                for arg in task['command']['args']:
                    if isinstance(arg, dict):
                        key = 'input' if 'input' in arg else 'output'
                        if arg[key] not in task[key + 's']:
                            raise WorkflowError(f'{name}: unknown command {key} {arg[key]}')
                        if 'path' in arg:
                            relative_path(arg['path'], name + ' command')
                            if task['outputs'][arg['output']]['type'] != 'directory':
                                raise WorkflowError(f'{name}: command subpath requires a directory output')
            if task['kind'] == 'review':
                if task['report'] not in task['outputs'] or task['outputs'][task['report']]['type'] != 'file':
                    raise WorkflowError(f'{name}: review report must name a file output')
                if 'coverage' in task:
                    report_input = task['coverage']['report_input']
                    if report_input not in task['inputs'] or 'artifact' not in task['inputs'][report_input]:
                        raise WorkflowError(f'{name}: visual coverage report must name an upstream artifact input')
                    if 'controls_input' in task['coverage']:
                        controls_input = task['coverage']['controls_input']
                        if controls_input not in task['inputs'] or 'artifact' not in task['inputs'][controls_input]:
                            raise WorkflowError(f'{name}: capability coverage controls must name an upstream artifact input')
                for ancestor in self.ancestors[name]:
                    upstream = self.tasks[ancestor]
                    if upstream['kind'] == 'agent' and upstream['session'] == task['session']:
                        raise WorkflowError(f'{name}: reviewer session must be independent of author {ancestor}')
            for target in task.get('repair', {}).get('targets', []):
                if target not in self.ancestors[name] or self.tasks[target]['kind'] != 'agent':
                    raise WorkflowError(f'{name}: repair target must be an upstream author agent: {target}')

    def descendants(self, targets):
        return {name for name in self.tasks if name in targets or self.ancestors[name].intersection(targets)}

    def bind(self, run_root, values):
        return Run(self, Path(run_root).resolve(), values)


class Run:
    def __init__(self, workflow, root, values):
        self.workflow, self.root = workflow, root
        if any(within(root, protected) for protected in (workflow.path.parent, TOOLS)):
            raise WorkflowError('run root must not be inside workflow or shared tool sources')
        if root.exists() and not root.is_dir():
            raise WorkflowError(f'run root is not a directory: {root}')
        unknown = set(values) - set(workflow.data['inputs'])
        if unknown:
            raise WorkflowError(f'unknown input bindings: {sorted(unknown)}')
        self.values = {}
        for name, spec in workflow.data['inputs'].items():
            value = values.get(name)
            if value is None:
                if spec['required']:
                    raise WorkflowError(f'missing required input: {name}')
            elif spec['type'] == 'file':
                value = str(Path(value).resolve())
                if not Path(value).is_file():
                    raise WorkflowError(f'input {name}: missing file {value}')
            elif not isinstance(value, str):
                raise WorkflowError(f'input {name}: expected text')
            self.values[name] = value
        self.outputs = {}
        protected = [Path(v) for k, v in self.values.items() if v is not None and workflow.data['inputs'][k]['type'] == 'file']
        protected += list(workflow.resources.values()) + [workflow.path]
        for name, task in workflow.tasks.items():
            self.outputs[name] = {}
            for label, output in task['outputs'].items():
                path = child_path(root, output['path'], name + '.' + label)
                if any(within(p, path) for p in protected):
                    raise WorkflowError(f'output would overwrite an input/resource: {path}')
                self.outputs[name][label] = str(path)

    def inputs(self, name):
        result = {}
        for label, ref in self.workflow.tasks[name]['inputs'].items():
            if 'input' in ref:
                result[label] = self.values[ref['input']]
            elif 'resource' in ref:
                result[label] = str(self.workflow.resources[ref['resource']])
            else:
                producer, output = ref['artifact'].split('.')
                path = Path(self.outputs[producer][output])
                result[label] = str(child_path(path, ref['path'], label) if 'path' in ref else path)
        return result

    def signature(self, name):
        task = self.workflow.tasks[name]
        bound, inputs = self.inputs(name), {}
        for label, ref in task['inputs'].items():
            value = bound[label]
            is_text = 'input' in ref and self.workflow.data['inputs'][ref['input']]['type'] == 'text'
            inputs[label] = {'value': value, 'content': None if value is None or is_text else snapshot(value)}
        resources = {task['prompt']} if task['kind'] != 'tool' else {task['command']['entry']}
        resources.update(check['schema'] for output in task['outputs'].values() for check in output.get('checks', []))
        capability_gate = 'capability_profile' in task.get('coverage', {}) or any(
            'capability_profile' in check for output in task['outputs'].values() for check in output.get('checks', []))
        return digest({'task': task, 'inputs': inputs,
                       'resources': {key: snapshot(self.workflow.resources[key], True) for key in resources},
                       **({'capability_gate': snapshot(Path(__file__), True)} if capability_gate else {}),
                       'model': self.workflow.data['models'].get(task.get('model')),
                       'dependencies': {dep: {key: snapshot(path) for key, path in self.outputs[dep].items()} for dep in task['needs']}})

    def output_snapshots(self, name, required=False):
        result = {}
        for label, path in self.outputs[name].items():
            result[label] = snapshot(path, required)
            if result[label] is not None and result[label]['type'] != self.workflow.tasks[name]['outputs'][label]['type']:
                raise WorkflowError(f'{name}.{label}: artifact has wrong filesystem type')
        return result

    def new_state(self):
        return {'schema_version': '0.2.0', 'document_type': 'expression_run_state',
                'workflow_id': self.workflow.data['id'], 'run_root': str(self.root), 'tasks': {}, 'repairs': {}, 'retries': {}}

    def validate_state(self, state):
        if not isinstance(state, dict) or set(state) != {'schema_version', 'document_type', 'workflow_id', 'run_root', 'tasks', 'repairs', 'retries'}:
            raise WorkflowError('invalid run state fields')
        if any(state.get(k) != v for k, v in self.new_state().items() if k not in ('tasks', 'repairs', 'retries')):
            raise WorkflowError('run state identity/version/root mismatch')
        if not all(isinstance(state[key], dict) for key in ('tasks', 'repairs', 'retries')):
            raise WorkflowError('invalid state task/repair maps')
        for name, entry in state['tasks'].items():
            if name not in self.workflow.tasks or not isinstance(entry, dict) or entry.get('status') not in ('succeeded', 'failed', 'blocked', 'revise'):
                raise WorkflowError(f'invalid state task entry: {name}')
            if entry['status'] == 'succeeded' and not {'signature', 'outputs'} <= set(entry):
                raise WorkflowError(f'incomplete successful state entry: {name}')
            if entry['status'] == 'revise' and (not isinstance(entry.get('targets'), list) or not entry['targets']
                    or not set(entry['targets']) <= set(self.workflow.tasks[name].get('repair', {}).get('targets', []))):
                raise WorkflowError(f'invalid revision target set: {name}')
        for name, history in state['repairs'].items():
            if name not in self.workflow.tasks or not isinstance(history, list):
                raise WorkflowError(f'invalid repair history: {name}')
            policy = self.workflow.tasks[name].get('repair', {})
            if len(history) > policy.get('max_rounds', 0):
                raise WorkflowError(f'repair budget exceeded in saved state: {name}')
            for item in history:
                if not isinstance(item, dict) or set(item) != {'targets', 'reason'} or not isinstance(item['targets'], list) or not item['targets'] or not set(item['targets']) <= set(policy.get('targets', [])) or not isinstance(item['reason'], str) or not item['reason'].strip():
                    raise WorkflowError(f'invalid repair history item: {name}')
        for name, history in state['retries'].items():
            if name not in self.workflow.tasks or not isinstance(history, list) or any(not isinstance(reason, str) or not reason.strip() for reason in history):
                raise WorkflowError(f'invalid retry history: {name}')
            if len(history) > self.workflow.tasks[name].get('retry', {}).get('max_rounds', 0):
                raise WorkflowError(f'retry budget exceeded in saved state: {name}')

    def plan(self, state=None):
        state = state or self.new_state()
        self.validate_state(state)
        result, succeeded = [], set()
        for name in self.workflow.order:
            task, previous = self.workflow.tasks[name], state['tasks'].get(name)
            parents_ready = set(task['needs']) <= succeeded
            valid = bool(previous and previous['status'] == 'succeeded' and parents_ready
                         and previous['signature'] == self.signature(name)
                         and previous['outputs'] == self.output_snapshots(name))
            if valid:
                status, reason = 'succeeded', 'verified input and artifact hashes'
                succeeded.add(name)
            elif previous and previous['status'] in ('failed', 'blocked', 'revise'):
                status, reason = previous['status'], previous.get('reason', 'requires a recorded directed repair')
            elif parents_ready:
                status, reason = 'ready', 'no current successful record' if not previous else 'inputs or outputs changed'
            else:
                status, reason = 'waiting', 'dependencies: ' + ', '.join(p for p in task['needs'] if p not in succeeded)
            row = {'id': name, 'kind': task['kind'], 'status': status, 'reason': reason,
                   'needs': task['needs'], 'inputs': self.inputs(name), 'outputs': self.outputs[name]}
            if task['kind'] == 'tool':
                command = task['command']
                argv = [command['runtime'], str(self.workflow.resources[command['entry']])]
                for arg in command['args']:
                    if isinstance(arg, str):
                        argv.append(arg)
                    elif 'input' in arg:
                        value = row['inputs'][arg['input']]
                        if value is None:
                            raise WorkflowError(f'{name}: a required command argument resolves to an absent optional input')
                        argv.append(value)
                    else:
                        path = Path(row['outputs'][arg['output']])
                        argv.append(str(child_path(path, arg['path'], name) if 'path' in arg else path))
                row['argv'] = argv
            else:
                row.update(prompt=str(self.workflow.resources[task['prompt']]), session=task['session'],
                           model=self.workflow.data['models'][task['model']])
            if 'repair' in task:
                row['repair'] = {**task['repair'], 'rounds_used': len(state['repairs'].get(name, []))}
            if 'retry' in task:
                row['retry'] = {**task['retry'], 'rounds_used': len(state['retries'].get(name, []))}
            result.append(row)
        return {'schema_version': '0.2.0', 'document_type': 'expression_execution_plan',
                'workflow_id': self.workflow.data['id'], 'config': str(self.workflow.path), 'run_root': str(self.root),
                'inputs': self.values, 'ready': [r['id'] for r in result if r['status'] == 'ready'],
                'complete': len(succeeded) == len(result), 'tasks': result}

    def validate_artifacts(self, name):
        self.output_snapshots(name, True)
        for label, spec in self.workflow.tasks[name]['outputs'].items():
            base = Path(self.outputs[name][label])
            for member in spec.get('required_files', []):
                member_path = child_path(base, member, label)
                if not member_path.is_file():
                    raise WorkflowError(f'{name}.{label}: missing required file {member_path}')
            for check in spec.get('checks', []):
                path = child_path(base, check['path'], label) if 'path' in check else base
                schema_path = self.workflow.resources[check['schema']]
                schema = read_json(schema_path)
                # Schemas are local declared resources; no network resolution.
                def local_schema(uri):
                    from urllib.parse import unquote, urlparse
                    target = Path(unquote(urlparse(uri).path)).resolve()
                    if not within(target, self.workflow.path.parent):
                        raise WorkflowError(f'schema reference outside resource roots: {uri}')
                    return read_json(target)
                def no_network(uri):
                    raise WorkflowError(f'network schema references are not permitted: {uri}')
                resolver = jsonschema.RefResolver(schema_path.as_uri(), schema,
                                                  handlers={'file': local_schema, 'http': no_network, 'https': no_network})
                try:
                    document = read_json(path)
                    jsonschema.validators.validator_for(schema)(schema, resolver=resolver).validate(document)
                except jsonschema.ValidationError as error:
                    raise WorkflowError(f'{name}.{label} {path}: {error.message}') from error
                if 'capability_profile' in check:
                    validate_capability_profile(document, check['capability_profile'])

    def validate_visual_coverage(self, name, report):
        """Check claimed review coverage against real scanner images, not scores.

        This prevents numeric scan success or a contact sheet alone from being
        recorded as visual acceptance. It cannot replace a reviewer looking at
        the images: that remains an explicit agent responsibility.
        """
        policy = self.workflow.tasks[name].get('coverage')
        if policy is None:
            return
        scan_path = Path(self.inputs(name)[policy['report_input']])
        scan = read_json(scan_path)
        if 'capability_profile' in policy:
            validate_capability_evidence(scan, policy['capability_profile'])
            if report.get('capability_profile') != policy['capability_profile']:
                raise WorkflowError(f'{name}: reviewer must identify the required capability profile')
        cases = scan.get('visual_cases')
        if not isinstance(cases, list) or not cases:
            raise WorkflowError(f'{name}: scanner must declare actual visual_cases')
        if 'capability_profile' in policy:
            controls = read_json(self.inputs(name)[policy['controls_input']])
            validate_capability_profile(controls, policy['capability_profile'])
            defaults = {parameter: spec['default'] for parameter, spec in controls['parameters'].items()}
            parameter_order = tuple(defaults)
            observed = set()
            for case in cases:
                values = case.get('parameters') if isinstance(case, dict) else None
                if (not isinstance(values, dict) or set(values) != set(defaults)
                        or any(type(value) not in (int, float) or not math.isfinite(value) for value in values.values())):
                    raise WorkflowError(f'{name}: visual cases must contain complete numeric parameter values')
                observed.add(tuple(values[parameter] for parameter in parameter_order))
            for group in BASIC_FACE_V1_GROUPS:
                region = next(r for r in controls['regions']
                              if len(r['axes']) == len(group) and {a['parameter'] for a in r['axes']} == set(group))
                for coordinates in product(*(a['keys'] for a in region['axes'])):
                    values = {**defaults, **{a['parameter']: value for a, value in zip(region['axes'], coordinates)}}
                    if tuple(values[parameter] for parameter in parameter_order) not in observed:
                        raise WorkflowError(f'{name}: missing actual visual case for {region["id"]} grid {coordinates}')
        expected = {}
        parameters = set()
        for case in cases:
            if (not isinstance(case, dict) or not isinstance(case.get('id'), str) or not case['id']
                    or not isinstance(case.get('parameters'), dict) or not case['parameters']
                    or not isinstance(case.get('image'), str)):
                raise WorkflowError(f'{name}: invalid scanner visual case')
            if case['id'] in expected:
                raise WorkflowError(f'{name}: duplicate scanner visual case {case["id"]}')
            image = child_path(scan_path.parent, case['image'], name + ' scanner image')
            if not image.is_file() or image.suffix.lower() not in ('.png', '.jpg', '.jpeg', '.webp', '.svg'):
                raise WorkflowError(f'{name}: missing actual scanner image {image}')
            expected[case['id']] = (case['parameters'], image)
            parameters.update(case['parameters'])
        seen = set()
        for case in report.get('checked_cases', []):
            case_id = case['id']
            if case_id in seen or case_id not in expected:
                raise WorkflowError(f'{name}: duplicate or unknown reviewed visual case {case_id}')
            seen.add(case_id)
            values, image = expected[case_id]
            if case['parameters'] != values:
                raise WorkflowError(f'{name}: reviewed parameters differ from scanner case {case_id}')
            if child_path(self.root, case['image'], name + ' reviewed image') != image:
                raise WorkflowError(f'{name}: reviewed image differs from scanner case {case_id}')
            if report['verdict'] == 'pass' and case.get('result') != 'pass':
                raise WorkflowError(f'{name}: passing review contains failed visual case {case_id}')
        continuous = report.get('continuous_review', {})
        for evidence in continuous.get('evidence', []):
            if not child_path(self.root, evidence, name + ' continuous evidence').is_file():
                raise WorkflowError(f'{name}: missing continuous review evidence {evidence}')
        if report['verdict'] == 'pass':
            missing = set(expected) - seen
            if missing:
                raise WorkflowError(f'{name}: unreviewed boundary/intermediate cases: {sorted(missing)}')
            if not continuous.get('performed') or not continuous.get('evidence'):
                raise WorkflowError(f'{name}: passing review requires an actual continuous preview check')
            missing_parameters = parameters - set(continuous.get('parameter_ids', []))
            if missing_parameters:
                raise WorkflowError(f'{name}: unreviewed continuous parameters: {sorted(missing_parameters)}')

    def record(self, state, name, status, reason=''):
        if name not in self.workflow.tasks:
            raise WorkflowError(f'unknown task: {name}')
        row = next(r for r in self.plan(state)['tasks'] if r['id'] == name)
        if row['status'] != 'ready':
            raise WorkflowError(f'{name}: task is {row["status"]}, not ready')
        task = self.workflow.tasks[name]
        # A ready task can still refer to a missing member of an existing bundle.
        for label, ref in task['inputs'].items():
            value = row['inputs'][label]
            if value is not None and not ('input' in ref and self.workflow.data['inputs'][ref['input']]['type'] == 'text'):
                snapshot(value, True)
        output = deepcopy(state)
        entry = {'status': status, 'reason': reason}
        if status == 'succeeded':
            self.validate_artifacts(name)
            if task['kind'] == 'review':
                report = read_json(self.outputs[name][task['report']])
                if report.get('task_id') != name or report.get('verdict') not in ('pass', 'revise', 'blocked'):
                    raise WorkflowError(f'{name}: invalid review task identity or verdict')
                issues = report.get('issues', [])
                for evidence in report.get('evidence', []) + [issue['evidence'] for issue in issues]:
                    evidence_path = child_path(self.root, evidence, name + ' evidence')
                    if not evidence_path.is_file():
                        raise WorkflowError(f'{name}: missing review evidence {evidence_path}')
                if report['verdict'] == 'pass' and issues:
                    raise WorkflowError(f'{name}: passing review cannot contain unresolved issues')
                self.validate_visual_coverage(name, report)
                if report['verdict'] == 'revise':
                    targets = {issue.get('target') for issue in issues}
                    if not targets or not targets <= set(task['repair']['targets']):
                        raise WorkflowError(f'{name}: revision issues need declared repair targets')
                    entry.update(status='revise', targets=sorted(targets), reason=report.get('summary', 'visual revision required'))
                elif report['verdict'] == 'blocked':
                    entry.update(status='blocked', reason=report.get('summary', 'missing required evidence'))
            if entry['status'] == 'succeeded':
                entry.update(signature=self.signature(name), outputs=self.output_snapshots(name, True))
        elif status not in ('failed', 'blocked') or not reason.strip():
            raise WorkflowError('failure/blocked records require a reason; allowed statuses: succeeded, failed, blocked')
        output['tasks'][name] = entry
        return output

    def retry(self, state, name, reason):
        self.validate_state(state)
        if name not in self.workflow.tasks:
            raise WorkflowError(f'unknown retry task: {name}')
        policy = self.workflow.tasks[name].get('retry')
        if not policy or state['tasks'].get(name, {}).get('status') not in ('failed', 'blocked'):
            raise WorkflowError(f'{name}: retry needs a failed/blocked task and explicit retry policy; revise requires repair')
        if not reason.strip():
            raise WorkflowError('retry requires the concrete changed condition')
        if len(state['retries'].get(name, [])) >= policy['max_rounds']:
            raise WorkflowError(f'{name}: retry budget exhausted ({policy["max_rounds"]})')
        output = deepcopy(state)
        output['retries'].setdefault(name, []).append(reason)
        for affected in self.workflow.descendants({name}):
            output['tasks'].pop(affected, None)
        return output

    def repair(self, state, name, targets, reason):
        self.validate_state(state)
        if name not in self.workflow.tasks:
            raise WorkflowError(f'unknown repair gate: {name}')
        task = self.workflow.tasks[name]
        policy = task.get('repair')
        entry = state['tasks'].get(name, {})
        if not policy or entry.get('status') not in ('failed', 'revise', 'blocked'):
            raise WorkflowError(f'{name}: repair requires a failed/revise/blocked gate with a declared policy')
        if not targets or len(targets) != len(set(targets)) or not set(targets) <= set(policy['targets']):
            raise WorkflowError(f'{name}: unknown, empty, or duplicate repair targets')
        if entry.get('status') == 'revise' and set(targets) != set(entry['targets']):
            raise WorkflowError(f'{name}: repair must address exactly the reviewer target set {entry["targets"]}')
        if not reason.strip():
            raise WorkflowError('repair requires a concrete reason')
        rounds = state['repairs'].get(name, [])
        if len(rounds) >= policy['max_rounds']:
            raise WorkflowError(f'{name}: repair budget exhausted ({policy["max_rounds"]}); report the concrete unresolved issue')
        output = deepcopy(state)
        output['repairs'].setdefault(name, []).append({'targets': list(targets), 'reason': reason})
        for affected in self.workflow.descendants(set(targets)):
            output['tasks'].pop(affected, None)
        return output

    def write(self, path, data):
        path = Path(path).resolve()
        if not within(path, self.root) or path == self.root:
            raise WorkflowError('plan/state files must be inside the run root')
        for task_outputs in self.outputs.values():
            if any(within(path, Path(artifact)) or within(Path(artifact), path) for artifact in task_outputs.values()):
                raise WorkflowError('plan/state files must not overlap task artifacts')
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_name(path.name + '.tmp')
        if temporary.is_symlink():
            raise WorkflowError('refusing a symlink temporary state file')
        temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        temporary.replace(path)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['validate', 'plan', 'record', 'repair', 'retry'])
    parser.add_argument('--config', type=Path, default=DEFAULT_CONFIG)
    parser.add_argument('--run-root', type=Path)
    parser.add_argument('--input', action='append', default=[], metavar='NAME=PATH')
    parser.add_argument('--text', action='append', default=[], metavar='NAME=TEXT')
    parser.add_argument('--state', type=Path)
    parser.add_argument('--out', type=Path)
    parser.add_argument('--task')
    parser.add_argument('--status', choices=['succeeded', 'failed', 'blocked'])
    parser.add_argument('--target', action='append', default=[])
    parser.add_argument('--reason', default='')
    args = parser.parse_args(argv)
    try:
        workflow = Workflow(args.config)
        if args.action == 'validate':
            print(json.dumps({'valid': True, 'workflow_id': workflow.data['id'], 'order': workflow.order}, ensure_ascii=False))
            return 0
        if not args.run_root:
            raise WorkflowError('--run-root is required')
        bindings = {}
        for kind, values in [('file', args.input), ('text', args.text)]:
            for value in values:
                name, sep, content = value.partition('=')
                if not sep or name in bindings or workflow.data['inputs'].get(name, {}).get('type') != kind:
                    raise WorkflowError(f'invalid/duplicate {kind} input binding: {value}')
                bindings[name] = content
        run = workflow.bind(args.run_root, bindings)
        state = read_json(args.state) if args.state and args.state.exists() else run.new_state()
        if args.action == 'plan':
            result = run.plan(state)
            if args.out:
                run.write(args.out, result)
        else:
            if not args.state or not args.task:
                raise WorkflowError('--state and --task are required for record/repair/retry')
            if args.action == 'record':
                if not args.status:
                    raise WorkflowError('--status is required for record')
                result = run.record(state, args.task, args.status, args.reason)
            elif args.action == 'repair':
                result = run.repair(state, args.task, args.target, args.reason)
            else:
                result = run.retry(state, args.task, args.reason)
            run.write(args.state, result)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    except (WorkflowError, OSError, ValueError) as error:
        print(f'expression workflow: {error}', file=sys.stderr)
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
