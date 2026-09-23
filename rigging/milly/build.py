from pathlib import Path
from lxml import etree as E
import copy,json,re,hashlib,shutil
ROOT=Path(__file__).resolve().parent
SOURCE=ROOT.parent.parent/'outputs/milly_v1/step05-base-character/05-2_局部色彩与材质.svg'
NS='http://www.w3.org/2000/svg'; T=lambda n:'{'+NS+'}'+n
r=E.parse(str(SOURCE)).getroot()
def find(id):return r.xpath('//*[@id=$i]',i=id)[0]
def el(tag,id=None,**attrs):
 e=E.Element(T(tag));
 if id:e.set('id',id)
 for k,v in attrs.items():e.set(k.replace('_','-'),str(v))
 return e
def path(parent,id,d,fill='none',stroke=None,w=1):
 e=el('path',id,d=d,fill=fill)
 if stroke:e.set('stroke',stroke);e.set('stroke-width',str(w));e.set('stroke-linecap','round');e.set('stroke-linejoin','round')
 parent.append(e);return e
# Drop the reference background and pre-existing cast shadows. Keep the approved colour/material work.
for e in list(r.xpath('//*[@id="background" or @data-kind="cast"]')):e.getparent().remove(e)
# Lift resource definitions out of drawable groups so the live geometry can be changed without resource collisions.
for d in list(r.xpath('.//*[local-name()="defs"]')):
 if d.getparent()!=r:
  d.getparent().remove(d);r.insert(0,d)
# Independent eyes: the eye opening is the mask, while irises/pupils/highlights stay full-size.
for side in ['left','right']:
 eye=find('eye-'+side);lid=find('eye-'+side+'-eyelid')
 aperture=('M440.5 219.1 C448.5 212.3 455.6 207.8 465 208.4 C472.4 208.4 478.9 211.8 483.9 217.8 C481.9 230.9 472 239.2 462.1 238 C452.5 236.7 444.1 229.3 440.5 222 Z' if side=='left' else 'M528.2 217.6 C532.4 212.2 538.8 208.7 546.3 208.4 C556.5 207.9 564.7 212.3 573 220 L573 221.6 C567 229.9 558.3 237.3 547 238.3 C538 239 529.5 230.9 528.2 217.6 Z')
 cp=el('clipPath','rig-eye-'+side+'-clip',clipPathUnits='userSpaceOnUse'); path(cp,'rig-eye-'+side+'-aperture',aperture,'white');eye.insert(0,cp)
 inner=el('g','rig-eye-'+side+'-interior',clip_path='url(#rig-eye-'+side+'-clip)');eye.insert(1,inner)
 for name in ['sclera','iris','pupil']:
  q=find('eye-'+side+'-'+name);q.getparent().remove(q);inner.append(q)
 for q in list(lid):
  if q.get('id') not in ['eye-'+side+'-lash-ink','eye-'+side+'-lid-crease','eye-'+side+'-lower-lid-ink']:lid.remove(q)
 # Independent glint group, no pupil movement baked into the eye white.
 pupil=find('eye-'+side+'-pupil'); glint=el('g','rig-eye-'+side+'-highlight')
 for q in list(pupil):
  if 'highlight' in q.get('id','') or 'reflections' in q.get('id',''):pupil.remove(q);glint.append(q)
 reflections=find('s52-'+side+'-eye-reflections');reflections.getparent().remove(reflections);glint.append(reflections)
 inner.append(glint)
# Mouth interior gets full overscan, with independent upper/lower lips, upper/lower teeth and tongue.
mouth=find('mouth');mouth.clear();mouth.set('id','mouth');mouth.set('data-part','mouth')
cp=el('clipPath','rig-mouth-clip',clipPathUnits='userSpaceOnUse');path(cp,'rig-mouth-aperture','M492.73 263.69 Q505.6 261.89 518.47 263.69 Q515.896 275.6 505.6 275.6 Q495.304 275.6 492.73 263.69 Z','white');mouth.append(cp)
inside=el('g','rig-mouth-interior',clip_path='url(#rig-mouth-clip)');mouth.append(inside)
path(inside,'rig-mouth-cavity','M480 249 L533 249 L533 290 L480 290 Z','#834b4a')
path(inside,'rig-mouth-tongue','M482 272.6 Q505 265.6 531 272.6 L531 283.6 L482 283.6 Z','#e89d96')
path(inside,'rig-mouth-upper-teeth','M481 256 L532 256 L532 264.9 Q506 266.2 481 264.9 Z','#fff5e7')
path(inside,'rig-mouth-lower-teeth','M486 277.1 Q506 275.4 529 277.1 L529 283.6 L486 283.6 Z','#fff1e6')
path(mouth,'rig-mouth-upper-lip','M492.73 263.69 Q505.6 261.89 518.47 263.69','none','#71443c',.9)
path(mouth,'rig-mouth-lower-lip','M492.73 263.69 Q495.304 275.6 505.6 275.6 Q515.896 275.6 518.47 263.69','none','#895349',.85)
# Hair is divided into overlapping geometric pieces. Every fragment retains the source artwork and contour.
manifest=[]
def split_hair(id,regions):
 source=find(id);idx=r.index(source);r.remove(source)
 for j,poly in enumerate(regions):
  wrapper=el('g',f'rig-{id}-{j+1}',data_rig='hair',data_hair=id,data_index=j,data_part=f'{id}-strand-{j+1}')
  clip=el('clipPath',f'rig-cut-{id}-{j}',clipPathUnits='userSpaceOnUse');path(clip,f'rig-cut-path-{id}-{j}',poly,'white');wrapper.append(clip)
  art=copy.deepcopy(source)
  for n in art.iter():
   if n.get('id'):n.set('id',f'piece-{id}-{j}-'+n.get('id'))
  art.set('clip-path',f'url(#rig-cut-{id}-{j})');wrapper.append(art);r.insert(idx+j,wrapper)
  manifest.append({'id':wrapper.get('id'),'source':id,'type':'overlapping vector hair strand','pivot':[505,80]})
# Full scalp underlap prevents the skin from showing through as the bangs spread.
base=el('g','rig-hair-underlap',data_rig='hair',data_hair='hair-underlap',data_index=0)
path(base,'rig-scalp-fill','M436 190 C427 120 463 59 505 64 C548 61 578 122 574 190 L561 190 C550 181 543 179 532 190 L519 188 L494 190 L478 188 L459 190 Z','#F8A05C')
r.insert(r.index(find('hair-bangs')),base)
# Deliberate overlap across adjacent masks leaves hidden art under each seam.
bounds=[425,446,471,492,524,546,566,588]
regions=[]
for a,b in zip(bounds,bounds[1:]):
 regions.append(f'M{a-2} 40 L{b+2} 40 L{b+2} 225 L{a-2} 225 Z')
split_hair('hair-bangs',regions)
split_hair('hair-left',['M340 20 L510 20 L510 142 L420 200 L415 325 L340 325 Z','M400 175 L445 120 L515 35 L520 150 L443 230 L445 326 L401 326 Z','M417 177 L479 87 L515 50 L520 160 L475 325 L422 325 Z'])
split_hair('hair-right',['M505 20 L680 20 L680 330 L617 330 L601 178 Z','M500 35 L575 105 L632 200 L627 330 L576 330 L563 178 Z','M499 55 L536 89 L588 168 L593 330 L538 330 L520 155 Z'])
split_hair('hair-back',['M350 25 L463 25 L467 330 L350 330 Z','M461 25 L553 25 L553 330 L461 330 Z','M551 25 L660 25 L660 330 L551 330 Z'])
# A shared crown underlap protects the split roots during yaw; it is covered at neutral.
crown=el('g','rig-hair-crown',data_rig='hair',data_hair='hair-crown',data_index=0)
path(crown,'rig-crown-fill','M407 166 C410 122 442 66 477 56 Q495 49 506 60 Q527 48 551 64 C583 86 606 122 615 170 L570 177 L442 177 Z','#F8A05C')
r.insert(r.index(find('body-core')),crown)
# A complete rear garment, hidden behind the torso, and two side returns cover yaw reveals.
back=el('g','rig-garment-back',data_rig='garment-back',data_part='garment-back')
back_outline=find('bodysuit-shape').get('d')
back_outline='M427.3 341 L444.2 338 Q505.7 380 568.8 338 L585.8 341'+back_outline.split('L585.8 341',1)[1]
path(back,'rig-garment-back-panel',back_outline,'#e6e5ef','#8e8389',.8)
path(back,'rig-garment-back-neck-binding','M444.2 341 Q505.7 383 568.8 341','none','#9e96a5',1)
r.insert(r.index(find('body-core')),back)
for side in ['left','right']:
 g=el('g','rig-garment-side-'+side,data_rig='garment-side-'+side,data_part='garment-side-'+side)
 d=('M426 341 L440 341 Q438 391 425 428 Q423 462 440 517 Q449 545 439 575 Q420 617 398 650 L411 648 Q432 615 450 577 Q459 548 450 517 Q435 462 433 430 Q446 385 440 338 Z' if side=='left' else 'M586 341 L572 341 Q574 391 587 428 Q589 462 572 517 Q563 545 573 575 Q592 617 615 650 L601 648 Q580 615 562 577 Q553 548 562 517 Q577 462 579 430 Q566 385 572 338 Z')
 path(g,'rig-side-return-'+side,d,'#e3e2ed','#9a90a1',.6);r.insert(r.index(find('bodysuit')),g)
# Optional pleated-skirt test accessory: front/rear rings and three actual physics zones.
skirtback=el('g','rig-skirt-back',data_rig='skirt-back',data_part='skirt-back',**{'class':'skirt-part'})
path(skirtback,'rig-skirt-back-panel','M438 552 Q504 580 574 552 L638 802 Q505 835 375 802 Z','#555766','#363746',1)
r.insert(r.index(find('leg-left')),skirtback)
skirt=el('g','rig-skirt-front',data_rig='skirt-front',data_part='skirt-front',**{'class':'skirt-part'})
path(skirt,'rig-skirt-front-panel','M438 550 Q505 561 573 550 L638 795 Q570 818 506 814 Q435 818 375 795 Z','#555663','#363440',1.3)
for j in range(11):
 x=441+j*12.4;xb=384+j*23
 path(skirt,f'rig-skirt-pleat-{j}',f'M{x} 556 L{xb} 795 L{xb+13} 802 L{x+5} 557 Z','#666873' if j%2==0 else '#41434f')
path(skirt,'rig-skirt-waist','M438 549 Q505 560 573 549 L576 567 Q505 579 435 567 Z','#494b59','#393842',1)
r.insert(r.index(find('bodysuit'))+1,skirt)
# Assign motion domains, preserving source-local labels and IDs.
for g in list(r):
 if g.tag!=T('g') or g.get('data-rig'):continue
 id=g.get('id','');domain='body'
 if id in ['head-face','ear-left','ear-right']:domain='face' if id=='head-face' else id
 elif id in ['head-face-features','head-face-brows-front']:domain='features'
 elif id.startswith('hair'):domain='hair';g.set('data-hair',id);g.set('data-index','0')
 elif id.startswith('arm-') or id.startswith('hand-'):domain='limb-left' if 'left' in id else 'limb-right'
 elif id.startswith('leg-'):domain='legs'
 elif id=='bodysuit':domain='garment-front'
 g.set('data-rig',domain)
# Give every moving material mask its own local copy and the same deformation domain.
mask_number=0
for group in [g for g in r if g.tag==T('g')]:
 for node in list(group.xpath('.//*[@clip-path]')):
  ref=node.get('clip-path','')
  if not ref.startswith('url(#s5'):continue
  old=ref[5:-1];found=r.xpath('//*[@id=$i]',i=old)
  if not found:continue
  clone=copy.deepcopy(found[0]);new=f'rig-local-mask-{mask_number}';mask_number+=1
  clone.set('id',new)
  for part in clone.iter():
   if part is not clone and part.get('id'):part.set('id',new+'-'+part.get('id'))
  node.insert(0,clone);node.set('clip-path','url(#'+new+')')
# Curves only for deterministic point deformation, including masks and the small material ellipses.
for e in list(r.iter()):
 tag=e.tag.split('}')[-1]
 if tag in ['ellipse','circle']:
  cx=float(e.get('cx',0));cy=float(e.get('cy',0));rx=float(e.get('rx',e.get('r',0)));ry=float(e.get('ry',e.get('r',0)));k=.5522847498
  d=f'M{cx+rx} {cy} C{cx+rx} {cy+k*ry} {cx+k*rx} {cy+ry} {cx} {cy+ry} C{cx-k*rx} {cy+ry} {cx-rx} {cy+k*ry} {cx-rx} {cy} C{cx-rx} {cy-k*ry} {cx-k*rx} {cy-ry} {cx} {cy-ry} C{cx+k*rx} {cy-ry} {cx+rx} {cy-k*ry} {cx+rx} {cy} Z'
  e.tag=T('path');
  for key in ['cx','cy','rx','ry','r']:e.attrib.pop(key,None)
  e.set('d',d)
# Metadata is deliverable, not hidden application state.
style=el('style','rig-default-visibility');style.text='.skirt-part{display:none}.show-skirt .skirt-part{display:inline}';r.insert(0,style)
r.set('id','milly-svg');r.set('data-stage','06-animation-rig');r.set('viewBox','260 20 500 1490')
svg=E.tostring(r,encoding='unicode')
(ROOT/'milly-animation.svg').write_text(svg)
manifest += [{'id':g.get('id'),'domain':g.get('data-rig')} for g in r if g.get('data-rig')]
(ROOT/'rig-manifest.json').write_text(json.dumps({'source':str(SOURCE),'sourceSHA256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'parts':manifest,'note':'Left/right source IDs are screen-side; UI uses character-side, as in the tutorial. Skirt is an optional newly drawn test accessory.'},ensure_ascii=False,indent=2))
html=(ROOT/'template.html').read_text().replace('<!--MODEL-->',svg).replace('/*MOTION_DATA*/','const MOTION='+ (ROOT/'motion-tracks.json').read_text()+';').replace('/*RIG_CODE*/',(ROOT/'rig.js').read_text())
(ROOT/'index.html').write_text(html)
if not (ROOT/'reference.mp4').exists():shutil.copyfile('/Users/wutian/Downloads/1124230907-1-208.mp4',ROOT/'reference.mp4')
print('Built',ROOT/'index.html','hair pieces',17,'size',len(html))
