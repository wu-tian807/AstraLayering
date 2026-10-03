"""Exercise the real workflow parser, artifact lifecycle and bounded DAG repair.

No model generation is performed. Programmatic geometry has separate rig tests.
"""
from copy import deepcopy
from html.parser import HTMLParser
from itertools import product
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest

import yaml
import jsonschema

TOOLS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(TOOLS))
from workflow_plan import (Workflow, WorkflowError, read_json, validate_capability_profile,
                           validate_capability_evidence, BASIC_FACE_V1_GROUPS, BASIC_FACE_V1_PARAMETERS)

ROOT = TOOLS.parent
SVG = TOOLS / 'tests/fixtures/contract-fixture.svg'


def basic_face_fixture(document_type='boundary_recipe', corrective_key=False):
    """Small synthetic topology for schema/gate tests, never character acceptance."""
    parameters = {name: {'type': 'number', 'label': name, **spec}
                  for name, spec in BASIC_FACE_V1_PARAMETERS.items()}
    result = {'schema_version': '0.3.0', 'document_type': document_type,
              'character_id': 'fixture', 'capability_profile': 'basic-face-v1',
              'parameters': parameters, 'regions': []}
    if document_type == 'boundary_recipe':
        result['source_sha256'] = '0' * 64
    else:
        result.update(svg='character.svg', focus=[0, 0, 10, 10], bindings=[], source={'svg_sha256': '0' * 64,
            'recipe_sha256': '1' * 64, 'generator': 'boundary-keyforms-v1'})
    for index, group in enumerate(BASIC_FACE_V1_GROUPS):
        axes = [{'parameter': name, 'keys': sorted(set(parameters[name][key]
                 for key in ('min', 'default', 'max')))} for name in group]
        if corrective_key and index == 2:
            axes[0]['keys'].insert(1, -.5)
        cells = list(product(*(axis['keys'] for axis in axes)))
        region = {'id': 'joint_' + str(index), 'space': 'group_' + str(index),
                  'bounds': [0, 0, 10, 10], 'axes': axes}
        if document_type == 'boundary_recipe':
            region.update(source={'kind': 'aperture', 'path': 'path_' + str(index), 'x': [2, 8]},
                          keyforms=[{'at': list(cell), 'identity': True} for cell in cells],
                          bindings=[{'selector': '#path_' + str(index), 'role': 'aperture'}])
        else:
            result['bindings'].append({'region': region['id'], 'target': {'svg_id': 'path_' + str(index)},
                'role': 'aperture', 'property': 'd', 'commands': ['M', 'L'], 'rest': [2, 3, 8, 3],
                'keyforms': [[2, 3 + sum(cell), 8, 3] for cell in cells],
                'default_source_passthrough': True, 'source_value': 'M2 3 L8 3'})
        result['regions'].append(region)
    return result


def basic_face_scan_evidence():
    effects = [{'parameter': name, 'conditions': {}, 'maximum_coordinate_delta': 2}
               for name in BASIC_FACE_V1_PARAMETERS]
    effects.extend({'parameter': 'eye.' + side + '.curve',
                    'conditions': {'eye.' + side + '.open': 0}, 'maximum_coordinate_delta': 1}
                   for side in ('left', 'right'))
    return {'capability_profile': 'basic-face-v1', 'capabilities': {
        'profile': 'basic-face-v1', 'parameters': list(BASIC_FACE_V1_PARAMETERS), 'effects': effects}}


class BoundaryContractTests(unittest.TestCase):
    def setUp(self):
        self.recipe_schema = read_json(ROOT / 'contracts/boundary-recipe.schema.json')
        self.rig_schema = read_json(ROOT / 'contracts/boundary-rig.schema.json')
        parameter = {'type': 'number', 'label': '开合', 'min': 0, 'max': 1, 'default': 1}
        axes = [{'parameter': 'eye.open', 'keys': [0, 1]}]
        self.recipe = {'schema_version': '0.3.0', 'document_type': 'boundary_recipe', 'character_id': 'fixture',
            'source_sha256': '0' * 64, 'parameters': {'eye.open': parameter}, 'regions': [{
                'id': 'eye', 'space': 'eye_group', 'axes': axes, 'source': {'kind': 'aperture', 'path': 'eye_white', 'x': [2, 8]},
                'bounds': [0, 0, 10, 10], 'keyforms': [{'at': [0], 'upper': [[2, 5], [4, 6], [6, 6], [8, 5]],
                                                     'lower': [[2, 5], [4, 6], [6, 6], [8, 5]]}, {'at': [1], 'identity': True}],
                'bindings': [{'selector': '#eye_white', 'role': 'aperture', 'subdivisions': 8}],
                'paints': [{'svg_id': 'eye_gradient', 'role': 'upper', 'anchor': [5, 4]}]}],
            'resources': [{'svg_id': 'existing_mask', 'element_index': 0, 'tag': 'rect', 'attributes': {'x': -2, 'width': 14}}]}
        self.rig = {'schema_version': '0.3.0', 'document_type': 'boundary_rig', 'character_id': 'fixture',
            'svg': 'character.svg', 'source': {'svg_sha256': '0' * 64, 'recipe_sha256': '1' * 64, 'generator': 'boundary-keyforms-v1'},
            'parameters': {'eye.open': parameter}, 'focus': [0, 0, 10, 10],
            'regions': [{'id': 'eye', 'space': 'eye_group', 'bounds': [0, 0, 10, 10], 'axes': axes}],
            'bindings': [{'region': 'eye', 'target': {'svg_id': 'eye_white'}, 'role': 'aperture', 'property': 'd',
                'commands': ['M', 'L'], 'rest': [2, 3, 8, 3], 'keyforms': [[2, 5, 8, 5], [2, 3, 8, 3]],
                'default_source_passthrough': True, 'source_value': 'M2 3 L8 3'}]}

    def test_valid_boundary_and_compiled_contracts(self):
        for schema, document in ((self.recipe_schema, self.recipe), (self.rig_schema, self.rig)):
            jsonschema.Draft202012Validator.check_schema(schema)
            jsonschema.Draft202012Validator(schema).validate(document)
        binding = self.recipe['regions'][0]['bindings'][0]
        binding.pop('subdivisions')
        binding.update(mode='translate', anchor=[5, 5], key_offsets=[{'at': [0], 'offset': [0, 1]}, {'at': [1], 'offset': [0, 0]}])
        jsonschema.Draft202012Validator(self.recipe_schema).validate(self.recipe)

    def test_recipe_rejects_presets_ambiguous_forms_and_ignored_fields(self):
        edits = [
            lambda d: d.update(expressions={}),
            lambda d: d['regions'][0]['keyforms'][1].update(upper=[[0, 0]] * 4),
            lambda d: d['regions'][0]['keyforms'][1].update(identity=False),
            lambda d: d['regions'][0]['keyforms'][0]['lower'].pop(),
            lambda d: d['regions'][0]['source'].update(kind='seam'),
            lambda d: d['regions'][0]['bindings'][0].update(mode='translate'),
            lambda d: d['regions'][0]['bindings'][0].update(role='surafce'),
            lambda d: d['regions'][0]['bindings'][0].update(anchor=[1, 2]),
        ]
        for edit in edits:
            with self.subTest(edit=edit):
                value = deepcopy(self.recipe); edit(value)
                with self.assertRaises(jsonschema.ValidationError):
                    jsonschema.Draft202012Validator(self.recipe_schema).validate(value)

    def test_runtime_contract_separates_paths_matrices_and_indexed_targets(self):
        edits = [
            lambda d: d['bindings'][0].pop('commands'),
            lambda d: d['bindings'][0].update(property='transform'),
            lambda d: d['bindings'][0]['target'].update(path_index=0, element_index=0, tag='path'),
            lambda d: d['bindings'][0]['target'].update(element_index=0),
            lambda d: d['focus'].__setitem__(2, 0),
            lambda d: d['source'].update(svg_sha256='wrong'),
        ]
        for edit in edits:
            with self.subTest(edit=edit):
                value = deepcopy(self.rig); edit(value)
                with self.assertRaises(jsonschema.ValidationError):
                    jsonschema.Draft202012Validator(self.rig_schema).validate(value)
        b = self.rig['bindings'][0]
        b.pop('commands'); b.update(property='transform', rest=[1, 0, 0, 1, 0, 0],
            keyforms=[[1, 0, 0, 1, 0, 1], [1, 0, 0, 1, 0, 0]], source_value=None)
        jsonschema.Draft202012Validator(self.rig_schema).validate(self.rig)
        b['keyforms'][0].pop()
        with self.assertRaises(jsonschema.ValidationError):
            jsonschema.Draft202012Validator(self.rig_schema).validate(self.rig)

    def test_resource_overrides_cannot_modify_arbitrary_svg_attributes(self):
        for attributes in ({'fill': 'red'}, {'width': -1}, {'height': 0}, {}):
            with self.subTest(attributes=attributes):
                self.recipe['resources'][0]['attributes'] = attributes
                with self.assertRaises(jsonschema.ValidationError):
                    jsonschema.Draft202012Validator(self.recipe_schema).validate(self.recipe)


class BasicFaceProfileTests(unittest.TestCase):
    def test_full_profile_and_generic_partial_contracts_remain_distinct(self):
        for kind, filename in (('boundary_recipe', 'boundary-recipe.schema.json'),
                               ('boundary_rig', 'boundary-rig.schema.json')):
            schema = read_json(ROOT / 'contracts' / filename)
            fixture = basic_face_fixture(kind)
            jsonschema.Draft202012Validator(schema).validate(fixture)
            validate_capability_profile(fixture, 'basic-face-v1')
            partial = deepcopy(fixture)
            partial['parameters'] = {key: partial['parameters'][key] for key in BASIC_FACE_V1_GROUPS[0]}
            partial['regions'] = partial['regions'][:1]
            if kind == 'boundary_rig':
                partial['bindings'] = partial['bindings'][:1]
            with self.assertRaises(jsonschema.ValidationError):
                jsonschema.Draft202012Validator(schema).validate(partial)
            with self.assertRaises(WorkflowError):
                validate_capability_profile(partial, 'basic-face-v1')
            del partial['capability_profile']
            jsonschema.Draft202012Validator(schema).validate(partial)
            with self.assertRaises(WorkflowError):
                validate_capability_profile(partial, 'basic-face-v1')

    def test_profile_rejects_missing_renamed_or_incorrect_axes_and_joint_regions(self):
        edits = [
            lambda d: d['parameters'].pop('brow.left.curve'),
            lambda d: d['parameters'].update({'eye_curve': d['parameters'].pop('eye.left.curve')}),
            lambda d: d['parameters']['mouth.open'].update(max=.1),
            lambda d: d['parameters']['eye.left.open'].update(default=0),
            lambda d: d['regions'].append(deepcopy(d['regions'][0])),
            lambda d: d['regions'][2]['axes'].pop(),
            lambda d: d['regions'][2]['axes'][0].update(keys=[-1, 1]),
        ]
        for kind, filename in (('boundary_recipe', 'boundary-recipe.schema.json'),
                               ('boundary_rig', 'boundary-rig.schema.json')):
            schema = read_json(ROOT / 'contracts' / filename)
            for edit in edits:
                with self.subTest(kind=kind, edit=edit):
                    fixture = basic_face_fixture(kind); edit(fixture)
                    with self.assertRaises(jsonschema.ValidationError):
                        jsonschema.Draft202012Validator(schema).validate(fixture)
                    with self.assertRaises(WorkflowError):
                        validate_capability_profile(fixture, 'basic-face-v1')

    def test_profile_requires_every_authored_grid_cell_including_corrective_keys(self):
        for kind in ('boundary_recipe', 'boundary_rig'):
            fixture = basic_face_fixture(kind, corrective_key=True)
            validate_capability_profile(fixture, 'basic-face-v1')
            owner = fixture['regions'][2] if kind == 'boundary_recipe' else fixture['bindings'][2]
            self.assertEqual(len(owner['keyforms']), 36)
            owner['keyforms'].pop()
            with self.assertRaisesRegex(WorkflowError, 'incomplete.*grid'):
                validate_capability_profile(fixture, 'basic-face-v1')
        fixture = basic_face_fixture()
        fixture['regions'][2]['keyforms'][-1] = deepcopy(fixture['regions'][2]['keyforms'][0])
        with self.assertRaisesRegex(WorkflowError, 'incomplete.*grid'):
            validate_capability_profile(fixture, 'basic-face-v1')
        fixture = basic_face_fixture('boundary_rig')
        fixture['bindings'][2].update(property='gradientTransform')
        with self.assertRaisesRegex(WorkflowError, 'missing geometry'):
            validate_capability_profile(fixture, 'basic-face-v1')

    def test_scope_requires_full_capability_profile(self):
        recipe = basic_face_fixture()
        scope = {'schema_version': '0.3.0', 'character_id': 'fixture', 'source_sha256': '0' * 64,
            'capability_profile': 'basic-face-v1', 'style': 'test source',
            'public_controls': [{'id': name, 'label': name, **spec,
                'low_boundary': 'test minimum', 'high_boundary': 'test maximum', 'coupled_with': []}
                for name, spec in BASIC_FACE_V1_PARAMETERS.items()],
            'regions': [{'id': r['id'], 'parameter_ids': [a['parameter'] for a in r['axes']],
                'primary_svg_ids': ['path'], 'following_svg_ids': [], 'fixed_svg_ids': [],
                'existing_clip_ids': [], 'preserve': 'original shape', 'follow_reason': 'fixture'}
                for r in recipe['regions']],
            'preparation': {'editable_ids': [], 'protected_ids': ['path'], 'limitations': []},
            'boundary_cases': [{'id': 'neutral', 'parameters': {name: spec['default']
                for name, spec in BASIC_FACE_V1_PARAMETERS.items()}, 'regions': ['joint_0'], 'intent': 'neutral'}],
            'acceptance': ['actual motion'], 'limitations': []}
        schema = read_json(ROOT / 'contracts/scope.schema.json')
        jsonschema.Draft202012Validator(schema).validate(scope)
        validate_capability_profile(scope, 'basic-face-v1')
        for edit in (lambda d: d['public_controls'].pop(), lambda d: d['regions'].pop(),
                     lambda d: d['public_controls'].append(deepcopy(d['public_controls'][0]))):
            candidate = deepcopy(scope); edit(candidate)
            with self.assertRaises(jsonschema.ValidationError):
                jsonschema.Draft202012Validator(schema).validate(candidate)
            with self.assertRaises(WorkflowError):
                validate_capability_profile(candidate, 'basic-face-v1')

    def test_curve_keyforms_and_offset_are_only_valid_for_curve_source(self):
        schema = read_json(ROOT / 'contracts/boundary-recipe.schema.json')
        fixture = basic_face_fixture()
        region = fixture['regions'][2]
        region['source']['kind'] = 'curve'
        region['bindings'][0]['role'] = 'curve'
        region['keyforms'][0] = {'at': [-1, -1, -1], 'curve': [[2, 1], [4, 2], [6, 2], [8, 1]], 'curve_mode': 'offset'}
        jsonschema.Draft202012Validator(schema).validate(fixture)
        for edit in (lambda r: r['source'].update(kind='aperture'),
                     lambda r: r['source'].update(aperture='extra'),
                     lambda r: r['keyforms'][0].update(curve_mode='ignored'),
                     lambda r: r['keyforms'][1].update(curve_mode='offset'),
                     lambda r: r['keyforms'][0].update(upper=[[2, 1]] * 4, lower=[[2, 1]] * 4)):
            candidate = deepcopy(fixture); edit(candidate['regions'][2])
            with self.assertRaises(jsonschema.ValidationError):
                jsonschema.Draft202012Validator(schema).validate(candidate)

    def test_scan_evidence_requires_actual_effect_and_closed_eye_curve_effect(self):
        scan = basic_face_scan_evidence()
        validate_capability_evidence(scan, 'basic-face-v1')
        edits = [
            lambda d: d.pop('capability_profile'),
            lambda d: d['capabilities']['parameters'].pop(),
            lambda d: d['capabilities']['effects'].pop(),
            lambda d: d['capabilities']['effects'][0].update(maximum_coordinate_delta=0),
            lambda d: d['capabilities']['effects'][0].update(maximum_coordinate_delta=1e-6),
            lambda d: d['capabilities']['effects'][0].update(maximum_coordinate_delta=float('nan')),
            lambda d: d['capabilities']['effects'][0].update(maximum_coordinate_delta=True),
            lambda d: d['capabilities']['effects'].append(deepcopy(d['capabilities']['effects'][0])),
            lambda d: d['capabilities']['effects'][-1].update(conditions={'eye.right.open': 1}),
        ]
        for edit in edits:
            candidate = deepcopy(scan); edit(candidate)
            with self.assertRaises(WorkflowError):
                validate_capability_evidence(candidate, 'basic-face-v1')


class RealWorkflowTests(unittest.TestCase):
    def test_real_configuration_resources_and_initial_plan(self):
        workflow = Workflow()
        self.assertEqual(workflow.order[0], 'inspect')
        self.assertEqual(workflow.order[-1], 'deliver')
        self.assertEqual(workflow.order, ['inspect', 'scope', 'prepare', 'author_boundaries',
                                         'build_rig', 'scan_boundaries', 'review_boundaries', 'deliver'])
        self.assertEqual(workflow.tasks['review_boundaries']['coverage'], {'report_input': 'scan_report', 'capability_profile': 'basic-face-v1', 'controls_input': 'controls'})
        for task in workflow.tasks.values():
            for dependency in task['needs']:
                self.assertIn(dependency, workflow.tasks)
        self.assertEqual(workflow.data['models']['author'], {'model': 'gpt-6-sol', 'reasoning_effort': 'xhigh'})
        with tempfile.TemporaryDirectory(prefix='astra-real-plan-') as directory:
            run = workflow.bind(directory, {'base_svg': str(SVG), 'requirements': '保留睫毛，做忍笑'})
            plan = run.plan()
            self.assertEqual(plan['ready'], ['inspect'])
            inspect = plan['tasks'][0]
            self.assertEqual(inspect['argv'][0], 'node')
            self.assertEqual(inspect['argv'][2], '--svg')
            self.assertEqual(inspect['argv'][3], str(SVG.resolve()))
            self.assertTrue(inspect['argv'][-1].endswith('source/inspection/inventory.json'))
            scope = next(t for t in plan['tasks'] if t['id'] == 'scope')
            self.assertIsNone(scope['inputs']['reference'])
            self.assertEqual(scope['inputs']['requirements'], '保留睫毛，做忍笑')
            self.assertTrue(Path(scope['prompt']).is_file())

    def test_all_document_links_resolve_and_no_legacy_nodes_remain(self):
        for document in ROOT.rglob('*.md'):
            if {'node_modules', '.venv', '__pycache__'} & set(document.relative_to(ROOT).parts):
                continue
            for href in re.findall(r'\]\(([^)]+)\)', document.read_text(encoding='utf-8')):
                if href.startswith(('http:', 'https:', '#')):
                    continue
                target = (document.parent / href.split('#', 1)[0]).resolve()
                self.assertTrue(target.is_file(), f'{document}: {target}')
        self.assertFalse((ROOT / 'tools/expressions').exists())
        self.assertFalse((ROOT / '流程.yaml').exists())

    def test_tool_implementation_and_offline_html_dependencies_are_declared(self):
        workflow = Workflow()
        for name in ('inspect', 'build_rig', 'scan_boundaries'):
            task = workflow.tasks[name]
            bound_resources = {ref['resource'] for ref in task['inputs'].values() if 'resource' in ref}
            expected = {'source_tool', 'geometry_js', 'common_tool'}
            if name != 'inspect':
                expected |= {'boundary_runtime_js', 'controls_schema'}
            if name == 'build_rig':
                expected |= {'boundary_compiler_js', 'recipe_schema'}
            self.assertEqual(bound_resources, expected, name)
        deliver = workflow.tasks['deliver']
        copied = {workflow.resources[ref['resource']] for ref in deliver['inputs'].values() if 'resource' in ref}
        required = set(deliver['outputs']['final']['required_files'])

        class HtmlResources(HTMLParser):
            def __init__(inner):
                super().__init__()
                inner.sources = []

            def handle_starttag(inner, tag, attributes):
                if tag in ('script', 'iframe'):
                    inner.sources.extend(value for key, value in attributes if key == 'src' and value)

        queue = [workflow.resources['preview_html']]
        seen = set()
        while queue:
            source = queue.pop()
            if source in seen:
                continue
            seen.add(source)
            self.assertIn(source, copied, f'HTML dependency missing from delivery inputs: {source}')
            self.assertIn('preview/' + source.name, required)
            if source.suffix == '.html':
                parser = HtmlResources()
                parser.feed(source.read_text(encoding='utf-8'))
                for href in parser.sources:
                    if ':' not in href and not href.startswith('#'):
                        target = (source.parent / href.split('?', 1)[0].split('#', 1)[0]).resolve()
                        self.assertTrue(target.is_file(), str(target))
                        queue.append(target)

    def test_standard_workflow_gates_scope_recipe_compiled_and_delivered_controls(self):
        workflow = Workflow()
        for task, output in (('scope', 'specification'), ('author_boundaries', 'recipe'),
                             ('build_rig', 'compiled'), ('deliver', 'final')):
            checks = workflow.tasks[task]['outputs'][output]['checks']
            self.assertTrue(any(c.get('capability_profile') == 'basic-face-v1' for c in checks), task)
        coverage = workflow.tasks['review_boundaries']['coverage']
        self.assertEqual(coverage['capability_profile'], 'basic-face-v1')
        self.assertEqual(coverage['controls_input'], 'controls')

    def test_real_cli_validate_and_plan(self):
        tool = str(TOOLS / 'workflow_plan.py')
        result = subprocess.run([sys.executable, tool, 'validate'], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(json.loads(result.stdout)['valid'])
        with tempfile.TemporaryDirectory(prefix='astra-real-cli-') as directory:
            target = Path(directory) / 'plan.json'
            result = subprocess.run([sys.executable, tool, 'plan', '--run-root', directory,
                                     '--input', 'base_svg=' + str(SVG), '--out', str(target)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(read_json(target)['ready'], ['inspect'])


class PlannerTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='astra-workflow-unit-')
        self.root = Path(self.temporary.name)
        self.package = self.root / 'workflow'
        self.package.mkdir()
        (self.package / 'tools').mkdir()
        (self.package / 'tools/renderer.py').write_text('# Fixture executable; never run by planner.\n')
        self.output = self.root / 'run'
        self.source = self.root / 'original.svg'
        self.source.write_bytes(SVG.read_bytes())
        for name in ('author', 'review', 'side', 'delivery'):
            (self.package / (name + '.md')).write_text(name + ' actual prompt', encoding='utf-8')
        (self.package / 'implementation.js').write_text('const version = 1;', encoding='utf-8')
        (self.package / 'number.schema.json').write_text(json.dumps({
            '$schema': 'https://json-schema.org/draft/2020-12/schema',
            'type': 'object', 'additionalProperties': False, 'required': ['value'],
            'properties': {'value': {'type': 'number', 'minimum': 0}},
        }))
        # These generic DAG lifecycle fixtures do not opt into visual coverage.
        # The separate coverage cases below exercise the current review fields.
        review_schema = read_json(ROOT / 'contracts/review.schema.json')
        review_schema['required'] = [key for key in review_schema['required']
                                     if key not in ('checked_cases', 'continuous_review')]
        review_schema['properties']['schema_version'] = {'const': '0.2.0'}
        review_schema['properties']['task_id'] = {'const': 'review_base'}
        (self.package / 'review.schema.json').write_text(json.dumps(review_schema))
        self.config = self.package / 'workflow.yaml'
        self.data = {
            'schema_version': '0.2.0', 'document_type': 'expression_workflow', 'id': 'test_rig',
            'inputs': {'base_svg': {'type': 'file', 'required': True, 'description': 'source'},
                       'requirements': {'type': 'text', 'required': False, 'description': 'optional'}},
            'resources': {'renderer': 'tools/renderer.py',
                          'implementation': 'implementation.js',
                          'author_prompt': 'author.md', 'side_prompt': 'side.md',
                          'review_prompt': 'review.md', 'delivery_prompt': 'delivery.md',
                          'number_schema': 'number.schema.json', 'review_schema': 'review.schema.json'},
            'models': {'author': {'model': 'gpt-6-sol', 'reasoning_effort': 'xhigh'}},
            'tasks': {
                'inspect': {'kind': 'tool', 'needs': [], 'inputs': {'svg': {'input': 'base_svg'}, 'implementation': {'resource': 'implementation'}},
                            'retry': {'max_rounds': 1},
                            'outputs': {'inventory': {'path': 'inventory.json', 'type': 'file', 'checks': [{'schema': 'number_schema'}]}},
                            'command': {'runtime': 'python3', 'entry': 'renderer', 'args': [{'input': 'svg'}, {'output': 'inventory'}]}},
                'side': {'kind': 'agent', 'needs': [], 'model': 'author', 'session': 'side_writer', 'prompt': 'side_prompt',
                         'inputs': {'request': {'input': 'requirements'}}, 'outputs': {'note': {'path': 'side.txt', 'type': 'file'}}},
                'author': {'kind': 'agent', 'needs': ['inspect'], 'model': 'author', 'session': 'rig_writer', 'prompt': 'author_prompt',
                           'inputs': {'inventory': {'artifact': 'inspect.inventory'}},
                           'outputs': {'bundle': {'path': 'authored', 'type': 'directory', 'required_files': ['recipe.json'],
                                                  'checks': [{'path': 'recipe.json', 'schema': 'number_schema'}]}}},
                'review_base': {'kind': 'review', 'needs': ['author'], 'model': 'author', 'session': 'independent', 'prompt': 'review_prompt',
                                'inputs': {'recipe': {'artifact': 'author.bundle', 'path': 'recipe.json'}},
                                'outputs': {'report': {'path': 'review.json', 'type': 'file', 'checks': [{'schema': 'review_schema'}]}},
                                'report': 'report', 'repair': {'max_rounds': 2, 'targets': ['author']}},
                'deliver': {'kind': 'agent', 'needs': ['review_base', 'side'], 'model': 'author', 'session': 'delivery', 'prompt': 'delivery_prompt',
                            'inputs': {'recipe': {'artifact': 'author.bundle', 'path': 'recipe.json'}, 'review': {'artifact': 'review_base.report'}},
                            'outputs': {'final': {'path': 'final.txt', 'type': 'file'}}},
            },
        }
        self.save()

    def tearDown(self):
        self.temporary.cleanup()

    def save(self, data=None):
        self.config.write_text(yaml.safe_dump(data or self.data, sort_keys=False), encoding='utf-8')

    def run_context(self):
        return Workflow(self.config).bind(self.output, {'base_svg': str(self.source)})

    def artifact(self, run, task, output, value, member=None):
        path = Path(run.outputs[task][output])
        if member:
            path = path / member
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value) if isinstance(value, dict) else value, encoding='utf-8')

    def successful_upstream(self, run):
        state = run.new_state()
        self.artifact(run, 'inspect', 'inventory', {'value': 1})
        state = run.record(state, 'inspect', 'succeeded')
        self.artifact(run, 'side', 'note', 'unchanged independent work')
        state = run.record(state, 'side', 'succeeded')
        self.artifact(run, 'author', 'bundle', {'value': 2}, 'recipe.json')
        self.artifact(run, 'author', 'bundle', '<svg xmlns="http://www.w3.org/2000/svg"/>', 'sample.svg')
        return run.record(state, 'author', 'succeeded')

    def review(self, verdict='pass', target='author'):
        issues = [] if verdict != 'revise' else [{'target': target, 'code': 'lip_crossing',
            'description': 'lower lip crosses upper at half-open frown',
            'parameters': {'mouth.open': .5, 'mouth.form': -1}, 'svg_ids': ['mouth_contour'],
            'evidence': 'authored/sample.svg', 'suggested_change': 'adjust lower-lip guide'}]
        # The real workflow review schema names real author targets; use the
        # same named role in its report and remap fixture task consistently.
        return {'schema_version': '0.2.0', 'task_id': 'review_base', 'verdict': verdict,
                'summary': 'actual fixture review result', 'evidence': ['authored/sample.svg'],
                'issues': issues, 'limitations': []}

    def review_fixture_schema(self):
        path = self.package / 'review.schema.json'
        schema = read_json(path)
        schema['properties']['issues']['items']['properties']['target']['enum'] = ['author', 'side']
        path.write_text(json.dumps(schema))

    def test_topology_is_independent_of_mapping_order(self):
        before = Workflow(self.config).order
        data = deepcopy(self.data)
        data['tasks'] = dict(reversed(list(data['tasks'].items())))
        self.save(data)
        self.assertEqual(Workflow(self.config).order, before)
        self.assertEqual(before[:2], ['inspect', 'side'])
        self.assertLess(before.index('author'), before.index('review_base'))

    def test_invalid_topology_and_real_references(self):
        cases = [
            lambda d: d['tasks']['inspect']['needs'].append('review_base'),
            lambda d: d['tasks']['author']['needs'].append('missing'),
            lambda d: d['tasks']['author']['inputs']['inventory'].update(artifact='side.note'),
            lambda d: d['tasks']['author']['inputs']['inventory'].update(artifact='inspect.missing'),
            lambda d: d['tasks']['inspect']['inputs']['svg'].update(input='missing'),
            lambda d: d['tasks']['inspect']['command'].update(entry='missing'),
            lambda d: d['tasks']['inspect']['command']['args'].append({'input': 'missing'}),
            lambda d: d['tasks']['review_base'].update(session='rig_writer'),
            lambda d: d['tasks']['review_base'].update(coverage={'report_input': 'missing'}),
            lambda d: d['tasks']['author'].update(coverage={'report_input': 'inventory'}),
            lambda d: d['tasks']['review_base']['repair'].update(targets=['deliver']),
            lambda d: d['tasks']['review_base']['repair'].update(max_rounds=0),
            lambda d: d['tasks']['author'].update(run='.'),
            lambda d: d['tasks']['inspect'].update(prompt='author_prompt'),
            lambda d: d['tasks']['author'].update(model='missing'),
        ]
        for edit in cases:
            with self.subTest(edit=edit):
                data = deepcopy(self.data)
                edit(data)
                self.save(data)
                with self.assertRaises(WorkflowError):
                    Workflow(self.config)

    def test_step_tools_resolve_from_package_root(self):
        for resource in ('1.inspect/tools/renderer.py', '1.素材盘点/1.1.原稿/tools/renderer.py'):
            with self.subTest(resource=resource):
                entry = self.package / resource
                entry.parent.mkdir(parents=True)
                entry.write_text('# Step-owned fixture executable.\n')
                self.data['resources']['renderer'] = resource
                self.save()
                plan = Workflow(self.config).bind(self.output, {'base_svg': str(self.source)}).plan()
                task = next(task for task in plan['tasks'] if task['id'] == 'inspect')
                self.assertEqual(task['argv'][1], str(entry))

    def test_resources_cannot_reach_another_skill_even_through_a_symlink(self):
        peer = self.root / 'other-skill/tools'
        peer.mkdir(parents=True)
        (peer / 'tool.py').write_text('# Another skill owns this tool.\n')
        (self.package / 'tools/peer').symlink_to(peer, target_is_directory=True)
        for resource in ('../other-skill/tools/tool.py', 'tools/peer/tool.py'):
            with self.subTest(resource=resource):
                self.data['resources']['renderer'] = resource
                self.save()
                with self.assertRaises(WorkflowError):
                    Workflow(self.config)

    def test_executable_must_live_in_shared_or_step_tools(self):
        self.data['resources']['renderer'] = 'author.md'
        self.save()
        with self.assertRaisesRegex(WorkflowError, 'executable entry'):
            Workflow(self.config)

    def test_path_escape_overlap_and_missing_resources_are_rejected(self):
        cases = [
            lambda d: d['tasks']['author']['outputs']['bundle'].update(path='../escape'),
            lambda d: d['tasks']['author']['outputs']['bundle'].update(path='/absolute'),
            lambda d: d['tasks']['author']['outputs']['bundle'].update(path='C:\\escape'),
            lambda d: d['tasks']['author']['outputs']['bundle'].update(path='inventory.json/child'),
            lambda d: d['tasks']['review_base']['inputs']['recipe'].update(path='../other.json'),
            lambda d: d['tasks']['author']['inputs']['inventory'].update(path='child.json'),
            lambda d: d['tasks']['author']['outputs']['bundle']['required_files'].append('../escape'),
            lambda d: d['resources'].update(author_prompt='missing.md'),
            lambda d: d['resources'].update(author_prompt='../original.svg'),
        ]
        for edit in cases:
            with self.subTest(edit=edit):
                data = deepcopy(self.data)
                edit(data)
                self.save(data)
                with self.assertRaises(WorkflowError):
                    Workflow(self.config)

    def test_binding_missing_input_source_overwrite_and_symlink_escape(self):
        workflow = Workflow(self.config)
        with self.assertRaisesRegex(WorkflowError, 'required input'):
            workflow.bind(self.output, {})
        with self.assertRaisesRegex(WorkflowError, 'unknown input'):
            workflow.bind(self.output, {'base_svg': str(self.source), 'typo': 'x'})
        with self.assertRaisesRegex(WorkflowError, 'missing file'):
            workflow.bind(self.output, {'base_svg': str(self.root / 'absent')})
        with self.assertRaisesRegex(WorkflowError, 'workflow or shared tool'):
            workflow.bind(self.package / 'run', {'base_svg': str(self.source)})
        self.data['tasks']['inspect']['outputs']['inventory']['path'] = 'original.svg'
        self.save()
        with self.assertRaisesRegex(WorkflowError, 'overwrite'):
            Workflow(self.config).bind(self.root, {'base_svg': str(self.source)})
        self.save(self.data | {'tasks': self.data['tasks'] | {'inspect': {**self.data['tasks']['inspect'],
                  'outputs': {'inventory': {'path': 'inventory.json', 'type': 'file'}}}}})
        self.output.mkdir()
        (self.output / 'authored').symlink_to(self.package, target_is_directory=True)
        with self.assertRaisesRegex(WorkflowError, 'symlink escapes'):
            self.run_context()

    def test_output_schema_and_missing_directory_members_are_enforced(self):
        run = self.run_context()
        state = run.new_state()
        with self.assertRaisesRegex(WorkflowError, 'not ready'):
            run.record(state, 'author', 'succeeded')
        with self.assertRaisesRegex(WorkflowError, 'missing artifact'):
            run.record(state, 'inspect', 'succeeded')
        self.artifact(run, 'inspect', 'inventory', {'value': -1})
        with self.assertRaisesRegex(WorkflowError, 'minimum'):
            run.record(state, 'inspect', 'succeeded')
        self.artifact(run, 'inspect', 'inventory', {'value': 1})
        state = run.record(state, 'inspect', 'succeeded')
        Path(run.outputs['author']['bundle']).mkdir()
        with self.assertRaisesRegex(WorkflowError, 'missing required file'):
            run.record(state, 'author', 'succeeded')
        self.artifact(run, 'author', 'bundle', {'value': 2}, 'recipe.json')
        state = run.record(state, 'author', 'succeeded')
        self.assertEqual(next(r for r in run.plan(state)['tasks'] if r['id'] == 'author')['status'], 'succeeded')

    def test_complete_resume_and_changed_artifacts_only_invalidate_descendants(self):
        run = self.run_context()
        state = self.successful_upstream(run)
        self.artifact(run, 'review_base', 'report', self.review())
        state = run.record(state, 'review_base', 'succeeded')
        self.artifact(run, 'deliver', 'final', 'finished')
        state = run.record(state, 'deliver', 'succeeded')
        self.assertTrue(run.plan(state)['complete'])
        state_path = self.output / 'run-state.json'
        run.write(state_path, state)
        self.assertTrue(self.run_context().plan(read_json(state_path))['complete'])
        self.artifact(run, 'author', 'bundle', {'value': 3}, 'recipe.json')
        statuses = {r['id']: r['status'] for r in run.plan(state)['tasks']}
        self.assertEqual(statuses, {'inspect': 'succeeded', 'side': 'succeeded', 'author': 'ready', 'review_base': 'waiting', 'deliver': 'waiting'})

    def test_source_and_author_prompt_changes_invalidate_relevant_work(self):
        run = self.run_context()
        state = self.successful_upstream(run)
        (self.package / 'author.md').write_text('new calibration constraints')
        statuses = {r['id']: r['status'] for r in self.run_context().plan(state)['tasks']}
        self.assertEqual(statuses['inspect'], 'succeeded')
        self.assertEqual(statuses['side'], 'succeeded')
        self.assertEqual(statuses['author'], 'ready')
        self.source.write_text(self.source.read_text() + '\n<!-- revised source -->')
        statuses = {r['id']: r['status'] for r in self.run_context().plan(state)['tasks']}
        self.assertEqual(statuses['inspect'], 'ready')
        self.assertEqual(statuses['side'], 'succeeded')
        self.assertEqual(statuses['author'], 'waiting')

    def test_changed_indirect_tool_resource_invalidates_only_its_dependency_chain(self):
        run = self.run_context()
        state = self.successful_upstream(run)
        before = run.plan(state)
        tool_argv = next(row['argv'] for row in before['tasks'] if row['id'] == 'inspect')
        (self.package / 'implementation.js').write_text('const version = 2;', encoding='utf-8')
        after = self.run_context().plan(state)
        self.assertEqual(next(row['argv'] for row in after['tasks'] if row['id'] == 'inspect'), tool_argv)
        statuses = {row['id']: row['status'] for row in after['tasks']}
        self.assertEqual(statuses['inspect'], 'ready')
        self.assertEqual(statuses['side'], 'succeeded')
        self.assertEqual(statuses['author'], 'waiting')
        self.assertEqual(statuses['review_base'], 'waiting')

    def test_review_cannot_pass_issues_or_repair_an_undeclared_author(self):
        self.review_fixture_schema()
        run = self.run_context()
        state = self.successful_upstream(run)
        report = self.review('revise')
        report['verdict'] = 'pass'
        self.artifact(run, 'review_base', 'report', report)
        with self.assertRaises(WorkflowError):
            run.record(state, 'review_base', 'succeeded')
        self.artifact(run, 'review_base', 'report', self.review('revise', 'side'))
        with self.assertRaisesRegex(WorkflowError, 'declared repair targets'):
            run.record(state, 'review_base', 'succeeded')

    def test_directed_repair_respects_report_and_persistent_budget(self):
        self.review_fixture_schema()
        run = self.run_context()
        state = self.successful_upstream(run)
        for iteration in range(3):
            if iteration:
                self.artifact(run, 'author', 'bundle', {'value': 2 + iteration}, 'recipe.json')
                state = run.record(state, 'author', 'succeeded')
            self.artifact(run, 'review_base', 'report', self.review('revise'))
            state = run.record(state, 'review_base', 'succeeded')
            self.assertEqual(state['tasks']['review_base']['status'], 'revise')
            self.assertNotIn('deliver', run.plan(state)['ready'])
            with self.assertRaises(WorkflowError):
                run.repair(state, 'review_base', ['side'], 'unrelated change')
            if iteration == 2:
                with self.assertRaisesRegex(WorkflowError, 'budget exhausted'):
                    run.repair(state, 'review_base', ['author'], 'same lip issue')
            else:
                state = run.repair(state, 'review_base', ['author'], 'fix specified half-open lip guide')
                self.assertEqual(set(state['tasks']), {'inspect', 'side'})
                self.assertEqual(run.plan(state)['ready'], ['author'])
                path = self.output / 'state.json'
                run.write(path, state)
                state = read_json(path)
        self.assertEqual(len(state['repairs']['review_base']), 2)

    def test_failure_does_not_retry_without_reasoned_repair(self):
        run = self.run_context()
        state = run.new_state()
        with self.assertRaisesRegex(WorkflowError, 'reason'):
            run.record(state, 'inspect', 'failed')
        state = run.record(state, 'inspect', 'failed', 'SVG renderer unavailable')
        self.assertEqual(run.plan(state)['ready'], ['side'])
        with self.assertRaisesRegex(WorkflowError, 'declared policy'):
            run.repair(state, 'inspect', ['author'], 'unavailable renderer')
        state = run.retry(state, 'inspect', 'the renderer dependency is now available')
        self.assertEqual(run.plan(state)['ready'], ['inspect', 'side'])
        state = run.record(state, 'inspect', 'failed', 'still missing renderer')
        with self.assertRaisesRegex(WorkflowError, 'retry budget exhausted'):
            run.retry(state, 'inspect', 'retry again without a new finding')

    def test_review_requires_real_local_evidence(self):
        run = self.run_context()
        state = self.successful_upstream(run)
        for reference in ('missing.png', '../original.svg', str(self.source)):
            with self.subTest(reference=reference):
                report = self.review()
                report['evidence'] = [reference]
                self.artifact(run, 'review_base', 'report', report)
                with self.assertRaises(WorkflowError):
                    run.record(state, 'review_base', 'succeeded')

    def boundary_review_fixture(self):
        self.review_fixture_schema()
        review_task = self.data['tasks']['review_base']
        review_task['coverage'] = {'report_input': 'scan_report'}
        review_task['inputs']['scan_report'] = {'artifact': 'author.bundle', 'path': 'scan-report.json'}
        self.save()
        run = self.run_context()
        state = self.successful_upstream(run)
        cases = [
            {'id': 'neutral', 'parameters': {'mouth.open': 0, 'mouth.form': 0}, 'image': 'sample.svg', 'kind': 'neutral'},
            {'id': 'open_max', 'parameters': {'mouth.open': 1, 'mouth.form': 0}, 'image': 'maximum.svg', 'kind': 'axis_max'},
            {'id': 'intermediate', 'parameters': {'mouth.open': .5, 'mouth.form': .5}, 'image': 'middle.svg', 'kind': 'intermediate'},
        ]
        for case in cases[1:]:
            self.artifact(run, 'author', 'bundle', '<svg xmlns="http://www.w3.org/2000/svg"/>', case['image'])
        self.artifact(run, 'author', 'bundle', {'visual_cases': cases}, 'scan-report.json')
        self.artifact(run, 'author', 'bundle', {'fixture': 'recorded browser check'}, 'continuous.json')
        state = run.record(state, 'author', 'succeeded')
        observations = {key: 'fixture reviewer observation' for key in (
            'neutral_fidelity', 'eyelid_contact', 'eye_curve', 'brow_shape', 'lash_preservation', 'neighborhood_follow', 'mouth_contour', 'aperture_mask', 'usable_range')}
        report = self.review()
        report['checked_cases'] = [
            {'id': case['id'], 'parameters': case['parameters'], 'image': 'authored/' + case['image'],
             'result': 'pass', 'observations': observations} for case in cases]
        report['continuous_review'] = {'performed': True, 'parameter_ids': ['mouth.open', 'mouth.form'],
                                       'evidence': ['authored/continuous.json'], 'observations': 'fixture continuous preview'}
        return run, state, report

    def basic_face_review_fixture(self):
        self.review_fixture_schema()
        task = self.data['tasks']['review_base']
        task['coverage'] = {'report_input': 'scan_report', 'capability_profile': 'basic-face-v1', 'controls_input': 'controls'}
        task['inputs']['scan_report'] = {'artifact': 'author.bundle', 'path': 'scan-report.json'}
        task['inputs']['controls'] = {'artifact': 'author.bundle', 'path': 'controls.json'}
        self.save()
        run = self.run_context()
        state = self.successful_upstream(run)
        rig = basic_face_fixture('boundary_rig', corrective_key=True)
        scan = basic_face_scan_evidence()
        defaults = {name: spec['default'] for name, spec in rig['parameters'].items()}
        cases, seen = [], set()
        for region in rig['regions']:
            for cell in product(*(axis['keys'] for axis in region['axes'])):
                values = {**defaults, **dict(zip((a['parameter'] for a in region['axes']), cell))}
                key = tuple(values.values())
                if key in seen:
                    continue
                seen.add(key)
                case_id = 'grid_' + str(len(cases))
                cases.append({'id': case_id, 'parameters': values, 'image': case_id + '.svg', 'kind': 'authored_grid'})
                self.artifact(run, 'author', 'bundle', '<svg xmlns="http://www.w3.org/2000/svg"/>', case_id + '.svg')
        scan['visual_cases'] = cases
        self.artifact(run, 'author', 'bundle', rig, 'controls.json')
        self.artifact(run, 'author', 'bundle', scan, 'scan-report.json')
        self.artifact(run, 'author', 'bundle', {'fixture': 'browser interaction'}, 'continuous.json')
        state = run.record(state, 'author', 'succeeded')
        report = self.review()
        report['capability_profile'] = 'basic-face-v1'
        observations = {key: 'fixture observation' for key in ('neutral_fidelity', 'eyelid_contact',
            'eye_curve', 'brow_shape', 'lash_preservation', 'neighborhood_follow', 'mouth_contour', 'aperture_mask', 'usable_range')}
        report['checked_cases'] = [{**case, 'image': 'authored/' + case['image'], 'result': 'pass',
                                    'observations': observations} for case in cases]
        for case in report['checked_cases']:
            case.pop('kind')
        report['continuous_review'] = {'performed': True, 'parameter_ids': list(defaults),
                                       'evidence': ['authored/continuous.json'], 'observations': 'fixture interaction'}
        return run, state, report, scan

    def test_standard_review_requires_dynamic_authored_grid_coverage(self):
        run, state, report, scan = self.basic_face_review_fixture()
        self.artifact(run, 'review_base', 'report', report)
        accepted = run.record(state, 'review_base', 'succeeded')
        self.assertEqual(accepted['tasks']['review_base']['status'], 'succeeded')
        # The extra -.5 height key is not a default/min/max scan; it must still be reviewed.
        missing = next(c for c in scan['visual_cases'] if c['parameters']['brow.left.height'] == -.5)
        scan['visual_cases'].remove(missing)
        self.artifact(run, 'author', 'bundle', scan, 'scan-report.json')
        with self.assertRaisesRegex(WorkflowError, 'missing actual visual case.*grid'):
            run.validate_visual_coverage('review_base', report)

    def test_standard_review_rejects_false_profile_incomplete_values_and_noop_evidence(self):
        run, state, report, scan = self.basic_face_review_fixture()
        no_profile = deepcopy(report); no_profile.pop('capability_profile')
        with self.assertRaisesRegex(WorkflowError, 'reviewer must identify'):
            run.validate_visual_coverage('review_base', no_profile)
        for expected, edit in (
            ('complete numeric', lambda d: d['visual_cases'][0]['parameters'].pop('brow.left.angle')),
            ('ineffective geometry', lambda d: d['capabilities']['effects'][-1].update(maximum_coordinate_delta=0))):
            candidate = deepcopy(scan); edit(candidate)
            self.artifact(run, 'author', 'bundle', candidate, 'scan-report.json')
            with self.assertRaisesRegex(WorkflowError, expected):
                run.validate_visual_coverage('review_base', report)

    def test_visual_coverage_accepts_only_complete_parameter_and_image_mapping(self):
        run, state, report = self.boundary_review_fixture()
        self.artifact(run, 'review_base', 'report', report)
        accepted = run.record(state, 'review_base', 'succeeded')
        self.assertEqual(accepted['tasks']['review_base']['status'], 'succeeded')
        self.assertIn('deliver', run.plan(accepted)['ready'])

    def test_visual_coverage_rejects_missing_wrong_or_duplicate_cases(self):
        run, state, report = self.boundary_review_fixture()
        edits = [
            ('unreviewed', lambda r: r['checked_cases'].pop()),
            ('duplicate', lambda r: r['checked_cases'].append(deepcopy(r['checked_cases'][0]))),
            ('unknown', lambda r: r['checked_cases'][0].update(id='invented')),
            ('parameters differ', lambda r: r['checked_cases'][0].update(parameters={'mouth.open': .2})),
            ('image differs', lambda r: r['checked_cases'][1].update(image='authored/sample.svg')),
            ('continuous parameters', lambda r: r['continuous_review'].update(parameter_ids=['mouth.open'])),
            ('missing continuous', lambda r: r['continuous_review'].update(evidence=['authored/absent.png'])),
        ]
        for message, edit in edits:
            with self.subTest(message=message):
                candidate = deepcopy(report)
                edit(candidate)
                self.artifact(run, 'review_base', 'report', candidate)
                with self.assertRaisesRegex(WorkflowError, message):
                    run.record(state, 'review_base', 'succeeded')

    def test_visual_coverage_cannot_use_numeric_report_or_skip_observations(self):
        run, state, report = self.boundary_review_fixture()
        numeric_only = self.review()
        self.artifact(run, 'review_base', 'report', numeric_only)
        with self.assertRaisesRegex(WorkflowError, 'unreviewed'):
            run.record(state, 'review_base', 'succeeded')
        missing_observations = deepcopy(report)
        del missing_observations['checked_cases'][0]['observations']
        self.artifact(run, 'review_base', 'report', missing_observations)
        with self.assertRaisesRegex(WorkflowError, 'observations'):
            run.record(state, 'review_base', 'succeeded')
        no_preview = deepcopy(report)
        no_preview['continuous_review']['performed'] = False
        self.artifact(run, 'review_base', 'report', no_preview)
        with self.assertRaises(WorkflowError):
            run.record(state, 'review_base', 'succeeded')

    def test_visual_revision_can_stop_at_a_real_failure_without_faking_remaining_cases(self):
        run, state, report = self.boundary_review_fixture()
        report['verdict'] = 'revise'
        report['checked_cases'] = report['checked_cases'][:1]
        report['checked_cases'][0]['result'] = 'revise'
        report['issues'] = self.review('revise')['issues']
        report['continuous_review'] = {'performed': False, 'parameter_ids': [], 'evidence': [],
                                       'observations': 'stopped after an actual visual failure'}
        self.artifact(run, 'review_base', 'report', report)
        revised = run.record(state, 'review_base', 'succeeded')
        self.assertEqual(revised['tasks']['review_base']['status'], 'revise')
        self.assertNotIn('deliver', run.plan(revised)['ready'])

    def test_visual_scanner_manifest_requires_actual_images_and_safe_paths(self):
        run, state, report = self.boundary_review_fixture()
        for path in ('absent.png', '../escape.png', '/absolute.png', 'scan-report.json'):
            with self.subTest(path=path):
                self.artifact(run, 'author', 'bundle', {'visual_cases': [
                    {'id': 'neutral', 'parameters': {'mouth.open': 0}, 'image': path, 'kind': 'neutral'}]}, 'scan-report.json')
                current = run.record(state, 'author', 'succeeded')
                self.artifact(run, 'review_base', 'report', report)
                with self.assertRaises(WorkflowError):
                    run.record(current, 'review_base', 'succeeded')

    def test_state_identity_and_control_file_destinations_are_checked(self):
        run = self.run_context()
        state = run.new_state()
        bad = deepcopy(state)
        bad['run_root'] = str(self.root / 'other')
        with self.assertRaisesRegex(WorkflowError, 'identity'):
            run.plan(bad)
        bad = deepcopy(state)
        bad['tasks']['author'] = {'status': 'succeeded'}
        with self.assertRaisesRegex(WorkflowError, 'incomplete'):
            run.plan(bad)
        with self.assertRaisesRegex(WorkflowError, 'inside the run root'):
            run.write(self.source, state)
        with self.assertRaisesRegex(WorkflowError, 'overlap task artifacts'):
            run.write(self.output / 'authored/state.json', state)

    def test_duplicate_yaml_json_and_unknown_schema_fields_are_rejected(self):
        self.config.write_text(self.config.read_text() + '\nid: second_id\n')
        with self.assertRaisesRegex(WorkflowError, 'duplicate'):
            Workflow(self.config)
        path = self.root / 'bad.json'
        path.write_text('{"verdict":"pass", "verdict":"revise"}')
        with self.assertRaisesRegex(WorkflowError, 'duplicate'):
            read_json(path)
        path.write_text('{"value":NaN}')
        with self.assertRaisesRegex(WorkflowError, 'nonfinite'):
            read_json(path)


if __name__ == '__main__':
    unittest.main()
