#!/usr/bin/env python3
"""Check structural completeness of the final artifact set; visual review is separate."""
import collections
import hashlib
import json
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent
SVG_NS = '{http://www.w3.org/2000/svg}'
issues = []
groups = set()
parts = set()


def walk(nodes, prefix=''):
    for node in nodes:
        path = '/'.join(filter(None, (prefix, node['name'])))
        groups.add(path)
        for part in node.get('parts', []):
            parts.add(path + '/' + part['name'])
        walk(node.get('groups', []), path)


def check_frozen_reviews(ledger):
    """Verify immutable evidence, including retained unsuccessful review rounds."""
    checked_entries = 0
    checked_files = 0
    for group_path, entries in ledger.get('groups', {}).items():
        for index, entry in enumerate(entries, 1):
            context = {'group': group_path, 'review_round': index}
            if (entry.get('worker') != f'group_child_layers:{group_path}:review'
                    or not entry.get('worker_id')):
                issues.append({**context, 'invalid_review_identity': True})
            for kind in ('report', 'candidate'):
                relative = entry.get('frozen_' + kind)
                expected = entry.get(kind + '_sha256', '')
                if not isinstance(relative, str) or not isinstance(expected, str):
                    issues.append({**context, 'invalid_frozen_evidence': kind})
                    continue
                path = ROOT / relative
                if (Path(relative).is_absolute() or not path.resolve().is_relative_to(ROOT)
                        or not re.fullmatch(r'[0-9a-f]{64}', expected)):
                    issues.append({**context, 'invalid_frozen_evidence': kind})
                    continue
                if not path.is_file():
                    issues.append({**context, 'missing_frozen_evidence': relative})
                    continue
                actual = hashlib.sha256(path.read_bytes()).hexdigest()
                checked_files += 1
                if actual != expected:
                    issues.append({**context, 'changed_frozen_evidence': relative,
                                   'expected_sha256': expected, 'actual_sha256': actual})
            checked_entries += 1
    return {'entries': checked_entries, 'files': checked_files}


def check_svg(path, expected_parts, expected_groups, allow_nested_bindings=False):
    tree = ET.parse(path)
    root = tree.getroot()
    ids = [node.get('id') for node in root.iter() if node.get('id')]
    duplicate_ids = sorted(k for k, n in collections.Counter(ids).items() if n > 1)
    if duplicate_ids:
        issues.append({'file': str(path), 'duplicate_ids': duplicate_ids})
    id_set = set(ids)
    part_bindings = set()
    group_bindings = set()
    physical_counts = {'part': collections.Counter(), 'group': collections.Counter()}
    resources = {'defs', 'clipPath', 'mask', 'pattern', 'marker', 'symbol'}

    def inspect_physical(node, in_resource=False, ancestor_bindings=None):
        ancestor_bindings = dict(ancestor_bindings or {})
        tag = node.tag.rsplit('}', 1)[-1]
        in_resource = in_resource or tag in resources
        if not in_resource:
            for kind, attribute in (('part', 'data-part-path'), ('group', 'data-group-path')):
                if node.get(attribute):
                    binding = node.get(attribute)
                    if not allow_nested_bindings or ancestor_bindings.get(kind) != binding:
                        physical_counts[kind][binding] += 1
                    ancestor_bindings[kind] = binding
                    if tag != 'g' or not node.get('id'):
                        issues.append({'file': str(path), 'invalid_physical_container': node.get(attribute)})
        for child in node:
            inspect_physical(child, in_resource, ancestor_bindings)

    inspect_physical(root)
    bitmap_count = 0
    for node in root.iter():
        tag = node.tag.rsplit('}', 1)[-1]
        if tag == 'image':
            bitmap_count += 1
        if tag == 'style':
            issues.append({'file': str(path), 'style_element': True})
        if node.get('data-part-path'):
            part_bindings.add(node.get('data-part-path'))
        if node.get('data-group-path'):
            group_bindings.add(node.get('data-group-path'))
        for key, value in node.attrib.items():
            for target in re.findall(r'url\(\s*[\'\"]?#([^\'\")\s]+)', value):
                if target not in id_set:
                    issues.append({'file': str(path), 'unresolved_reference': target})
            if key.rsplit('}', 1)[-1] == 'href':
                if value.startswith('#') and value[1:] not in id_set:
                    issues.append({'file': str(path), 'unresolved_href': value})
                elif not value.startswith('#'):
                    issues.append({'file': str(path), 'external_href': value})
    if bitmap_count:
        issues.append({'file': str(path), 'embedded_images': bitmap_count})
    for label, expected, actual, allowed in (
            ('part', expected_parts, part_bindings, parts),
            ('group', expected_groups, group_bindings, groups)):
        missing = sorted(expected - actual)
        unknown = sorted(actual - allowed)
        if missing or unknown:
            issues.append({'file': str(path), 'binding_type': label,
                           'missing': missing, 'unknown': unknown})
        ambiguous = {binding: count for binding, count in physical_counts[label].items() if count != 1}
        if ambiguous:
            issues.append({'file': str(path), 'binding_type': label, 'ambiguous_physical_containers': ambiguous})
    viewbox = [float(v) for v in root.get('viewBox', '').replace(',', ' ').split()]
    if viewbox != [0.0, 0.0, 895.0, 1758.0]:
        issues.append({'file': str(path), 'unexpected_viewbox': viewbox})
    return {'file': str(path.relative_to(ROOT)), 'ids': len(ids),
            'part_bindings': len(part_bindings), 'group_bindings': len(group_bindings),
            'embedded_images': bitmap_count, 'viewbox': viewbox}


try:
    document = json.loads((ROOT / 'structure/groups.json').read_text(encoding='utf-8'))
    walk(document['groups'])
    state = json.loads((ROOT / 'structure/groups.dispatch.json').read_text(encoding='utf-8'))
    if state.get('active') or state.get('publishing') or state.get('rejection'):
        issues.append({'dispatch': 'not fully published'})
    unfinished = sorted(path for path in groups
                        if state.get('nodes', {}).get(path, {}).get('status') != 'done')
    if unfinished:
        issues.append({'unfinished_groups': unfinished})
    ledger = json.loads((ROOT / 'structure/review-ledger.json').read_text(encoding='utf-8'))
    frozen_reviews = check_frozen_reviews(ledger)
    unreviewed = sorted(path for path in groups
                        if not ledger.get('groups', {}).get(path)
                        or ledger['groups'][path][-1]['status'] != 'pass')
    if unreviewed:
        issues.append({'groups_without_passing_independent_review': unreviewed})
    guide = check_svg(ROOT / 'block-layers/groups.svg', parts, groups, allow_nested_bindings=True)
    artwork = check_svg(ROOT / 'refinement/character.svg', parts, set())
    report = {'status': 'pass' if not issues else 'fail',
              'scope': 'structure, bindings, ids, local references, frozen review hashes and dispatch completion; artistic accuracy is separately reviewed',
              'physical_groups': len(groups), 'physical_parts': len(parts),
              'frozen_reviews': frozen_reviews,
              'guide': guide, 'artwork': artwork, 'issues': issues}
except (KeyError, OSError, ValueError, ET.ParseError) as exc:
    report = {'status': 'error', 'error': str(exc)}

destination = ROOT / 'validation/complete-artifacts.json'
destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, ensure_ascii=False, indent=2))
sys.exit(0 if report['status'] == 'pass' else 1)
