"""Scoped correspondence check; reuses the prior independent local proof, not its runtime."""
from pathlib import Path
import copy, hashlib, json, re, xml.etree.ElementTree as ET

OUT = Path(__file__).resolve().parent
R = OUT.parents[4]
M = R / 'refinement/groups/head/rear_hair_left/2.直属拆分与色块/2.2.直属轮廓色块'
REVIEW = OUT.parent
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
paths = {
    'candidate': R / 'block-layers/groups.svg',
    'frozen_candidate': M / '返修-01-local-notch/candidate.svg',
    'input_parent': M / '返修-01-local-notch/input-parent.svg',
    'historical_candidate': M / 'candidate-v1.svg',
    'bounds': M / '轮廓检查.json',
    'groups': R / 'structure/groups.json',
    'base_reference': R / 'references/base-subject.png',
    'line_reference': R / 'references/line-reference.png',
    'rendering': R / 'structure/rendering.json',
    'character': R / 'refinement/character.svg',
    'old_proof': REVIEW / 'independent-geometry-and-aa.json',
    'coverage_proof': REVIEW / 'additional-local-geometry.json',
}
hashes = {k: sha(p) for k,p in paths.items()}
assert hashes['candidate'] == hashes['frozen_candidate'] == 'a85a4204cd039e292828afa5b78ca1153bfb955a1d1b15e448c59c5e8b06ce41'
assert hashes['historical_candidate'] == '4b7179f7b86559b499efcb8213760934949e75f1a5194fb5e647ef6ac4e02ddf'
assert hashes['input_parent'] == '8063d357dfa2398bb808f7ce9ae3dd0e3949f89cb157ab675cc31a389944b7a1'
assert hashes['bounds'] == 'd6e08fdc849943794d0a1f4902f6916fac59a4f2fc43c60912f13a21b535e62e'
docs = {k: ET.parse(paths[k]).getroot() for k in ['candidate','input_parent','historical_candidate']}
maps = {k: {e.get('id'): e for e in r.iter() if e.get('id')} for k,r in docs.items()}
C,P,H = (maps[k] for k in ['candidate','input_parent','historical_candidate'])
IDS = ['group-head-rear-hair-left-inner-back-curtain','group-head-rear-hair-left-outer-back-curtain','part-head-rear-hair-left-occipital-root','part-head-rear-hair-left-central-back-tail']
old = 'C 165 1381 188 1354 209 1328 C 201 1364 204 1400 212 1428'
new = 'C 165 1381 178 1354 196 1325 C 193 1359 198 1400 212 1428'

def raw_group(path, identity):
    s = path.read_text()
    match = re.search(r'<g\b[^>]*\bid="'+re.escape(identity)+r'"[^>]*>', s)
    assert match, identity
    depth = 0
    for tag in re.finditer(r'<(/?)g\b[^>]*>', s[match.start():]):
        depth += -1 if tag.group(1) else 1
        if depth == 0:
            return s[match.start():match.start()+tag.end()]
    raise AssertionError('Unclosed group '+identity)

def normalized(e):
    return (e.tag, tuple(sorted(e.attrib.items())), (e.text or '').strip(), tuple(normalized(c) for c in e))

component_records = []
for i,identity in enumerate(IDS):
    historical = raw_group(paths['historical_candidate'],identity)
    current = raw_group(paths['candidate'],identity)
    expected = historical.replace(old,new) if i == 1 else historical
    assert current == expected, identity
    component_records.append({'id':identity,'historical_fragment_sha256':hashlib.sha256(historical.encode()).hexdigest(),'current_fragment_sha256':hashlib.sha256(current.encode()).hexdigest(),'byte_identical':current==historical,'only_expected_two_curves_changed':current==expected if i==1 else None})

stripped = copy.deepcopy(docs['candidate'])
for e in stripped.iter():
    for child in list(e):
        if child.get('id') in IDS: e.remove(child)
assert normalized(stripped) == normalized(docs['input_parent'])
pid='head-rear-left-main'; cid='head-rear-hair-left-outer-back-curtain-outer-main'
for k in [pid,cid]:
    assert C[k].attrib == {a:(v.replace(old,new) if a=='d' else v) for a,v in H[k].attrib.items()}
assert normalized(C['group-head-rear-hair-left']) == normalized(P['group-head-rear-hair-left'])
# All parent paths, resources, styles and clip geometry are unchanged except the known main-path edit.
expected_parent = copy.deepcopy(H['group-head-rear-hair-left'])
for e in expected_parent.iter():
    if e.get('id') == pid: e.set('d',e.get('d').replace(old,new))
assert normalized(expected_parent) == normalized(C['group-head-rear-hair-left'])
assert docs['candidate'].attrib == docs['historical_candidate'].attrib
for identity in IDS:
    # The four containers remain direct children of the viewport, as in the old reviewed candidate.
    assert identity in [e.get('id') for e in docs['candidate']]
    assert identity in [e.get('id') for e in docs['historical_candidate']]

def segments(d):
    tokens=re.findall(r'[A-Za-z]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?',d)
    i=0; pos=start=None; out=[]
    while i<len(tokens):
        cmd=tokens[i];i+=1
        if cmd=='Z':
            if pos!=start:out.append(('Z',(pos,start)))
            pos=start;continue
        n={'M':2,'L':2,'C':6,'H':1,'V':1}[cmd]
        v=tuple(float(x) for x in tokens[i:i+n]);i+=n
        if cmd=='M':pos=start=v;continue
        end=(v[0],pos[1]) if cmd=='H' else (pos[0],v[0]) if cmd=='V' else v[-2:]
        out.append((cmd,(pos,tuple(v[:2]),tuple(v[2:4]),end) if cmd=='C' else (pos,end)))
        pos=end
    return out

ps,cs=segments(C[pid].get('d')),segments(C[cid].get('d'))
hp,hc=segments(H[pid].get('d')),segments(H[cid].get('d'))
changes=[]
for label,a,b in [('parent',hp,ps),('outer',hc,cs)]:
    assert len(a)==len(b)
    deltas=[i for i in range(len(a)) if a[i]!=b[i]]
    assert deltas==[21,22]
    ymin=min(p[1] for i in deltas for s in [a[i],b[i]] for p in s[1])
    ymax=max(p[1] for i in deltas for s in [a[i],b[i]] for p in s[1])
    changes.append({'scope':label,'changed_segment_indices':deltas,'old_and_new_control_hull_y':[ymin,ymax]})

proof=json.loads(paths['old_proof'].read_text())
raw=json.loads(paths['bounds'].read_text())
assert proof['candidate_sha256']==hashes['historical_candidate']
assert raw['status']=='fail' and raw['scale']==4 and raw['alpha_threshold']==128
assert [r['outside_samples'] for r in raw['results']]==[0,3,0,0]
maker_raw=json.loads((M/'返修-01-local-notch/raw-edge-and-coverage.json').read_text())
raw_records=[]
for prior,current in zip(proof['four_raw_samples_geometry'][:3],maker_raw['outer_raw_samples']):
    assert current=={k:prior[k] for k in ['x','y','parent_alpha','child_alpha']}
    pts=tuple(tuple(float(v) for v in p) for p in prior['control_points'])
    assert ps[prior['parent_segment_index']]==cs[prior['child_segment_index']]==('C',pts)
    assert float(prior['center'][1])<1325
    raw_records.append({'sample':current,'parent_segment':prior['parent_segment_index'],'child_segment':prior['child_segment_index'],'complete_segment_in_current_xml':True,'points_in_traversal_order':pts,'old_left_membership':prior['left_membership_parent_child'],'old_right_membership':prior['right_membership_parent_child'],'prior_other_boundary_distance_lower_bound':min(prior['parent_other_boundary']['minimum_lower_bound'],prior['child_other_boundary']['minimum_lower_bound']),'reuse_reason':'Only changed segments are within y=1325..1428 in old and current curves; all boundaries and fill/clip/style semantics at this horizontal slice are unchanged.'})
coverage=json.loads(paths['coverage_proof'].read_text())
coverage_reuse=[]
ins=segments(C['head-rear-hair-left-inner-back-curtain-inner-main'].get('d'))
for site in coverage['coverage_sites']:
    for boundary in site['nearest_original_boundaries']:
        pts=tuple(tuple(float(v) for v in p) for p in boundary['segment']['p'])
        assert ps[boundary['parent_index']]==('C',pts)
        for i in boundary['outer_matches']:assert cs[i]==('C',pts)
        for i in boundary['inner_matches']:assert ins[i]==('C',pts)
    assert site['sample_center'][1]<1325
    coverage_reuse.append({'sample_center':site['sample_center'],'complete_boundaries_still_match_current_xml':True,'prior_partition_memberships':site['probe_interval_memberships'],'reuse_reason':'All current relevant paths and fill semantics match old proof, except two curves whose whole control hull is below y=1325; neither curve can cross this horizontal slice.'})
assert maker_raw['coverage_without_parent']['missing_samples']==[{'x':x['x'],'y':x['y'],'parent_alpha':x['parent_alpha'],'child_alpha':x['children_alpha']} for x in proof['children_union_raster']['less']['samples']]
result={
    'logical_identity':'group_child_layers:head/rear_hair_left:review',
    'recovery_worker':'/root/workflow_runner/review_rear_left',
    'method':'Focused repair recheck with current XML correspondence; previous independent proof and visual judgments retained, not recomputed or attributed to the recovery worker.',
    'hashes':hashes,'components':component_records,
    'current_outside_scopes_equal_frozen_input':True,
    'parent_unchanged_from_formally_repaired_input':True,
    'historical_parent_only_two_curves_changed':True,
    'root_attributes_container_ancestry_fill_clip_and_styles_preserved':True,
    'changes':changes,'raw_status':'fail','raw_counts':[0,3,0,0],
    'raw_proof_applicability':raw_records,'coverage_proof_applicability':coverage_reuse,
    'coverage_without_parent':maker_raw['coverage_without_parent'],
    'coverage_statistics_source':'Fresh maker raster evidence bound to the exact current candidate; not independently rerun in this focused recheck.',
    'limitation':'Exact correspondence reuses prior local proof only; this is not a new full-plane numerical proof and does not rewrite tool RAW FAIL.',
    'check_preparation_note':'First run stopped before evidence output due to a manually specified segment-index off-by-one. Actual parsed before/after segments were inspected; corrected zero-based indices are 21 and 22. No input was changed.'
}
(OUT/'xml-and-proof-applicability.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'verified':True,'candidate':hashes['candidate'],'unchanged_children':3,'outer_changed_segments':[21,22],'raw_status':raw['status'],'raw_counts':[r['outside_samples'] for r in raw['results']]},ensure_ascii=False))
