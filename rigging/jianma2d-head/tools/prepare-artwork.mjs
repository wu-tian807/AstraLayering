/** Display-only preparation on a clone. Never change source paths, colors or topology. */
export function prepareArtwork(svg){
 const shadow=svg.querySelector('#fx_body5_face_on_neck');
 if(!shadow||shadow.getAttribute('mask')!=='url(#outfit_inner_collar_neck_occlusion)')throw Error('Unexpected neck/collar source contract');
 // The collar is a separate layer. Baking its silhouette into a moving
 // neck texture makes that hole move with the head. Draw the real collar
 // over the complete neck instead; the source SVG itself remains unchanged.
 shadow.removeAttribute('mask');
 // Preserve the original jaw projection, but detach it from the neck raster so
 // it follows the chin. Receiver clipping is performed on the posed GPU mesh.
 const neck=svg.querySelector('#neck');neck.after(shadow);
 const receivers=[];
 for(const g of svg.children){
  if(g.localName!=='g')continue;
  const id=g.id;
  if(id==='fx_body5_face_on_neck'||id==='fx_forehead_jewel_on_face'||id.startsWith('fx_hair')&&(id.endsWith('_on_face')||id.endsWith('_on_ear'))){
   const clip=g.getAttribute('clip-path');if(!clip)throw Error('Missing original receiver clip: '+id);
   receivers.push({target:id,operation:'defer-receiver-clip-to-posed-mesh',originalClip:clip});g.removeAttribute('clip-path');
  }
 }

 // The neutral mouth's duplicated skin fills hide a complete cavity. The moving
 // face already supplies that skin. Reuse the exact fill paths as an occlusion
 // mask, retaining the cavity aperture, original lip artwork and local shadows.
 const ns='http://www.w3.org/2000/svg',mask=document.createElementNS(ns,'mask');
 mask.id='head_preview_mouth_occlusion';mask.setAttribute('maskUnits','userSpaceOnUse');
 mask.setAttribute('x','420');mask.setAttribute('y','225');mask.setAttribute('width','50');mask.setAttribute('height','45');
 const rect=document.createElementNS(ns,'rect');for(const [k,v] of Object.entries({x:420,y:225,width:50,height:45,fill:'white'}))rect.setAttribute(k,String(v));mask.append(rect);
 for(const side of ['upper','lower']){
  const original=svg.querySelector('#mouth_'+side+'_skin_complete_shape');if(!original)throw Error('Missing mouth skin occluder');
  const silhouette=original.cloneNode(true);silhouette.removeAttribute('id');silhouette.setAttribute('fill','black');mask.append(silhouette);
  svg.querySelector('#mouth_'+side+'_skin').style.display='none';
 }
 svg.querySelector('#mouth defs').append(mask);
 for(const id of ['mouth_inside','mouth_teeth_upper','mouth_teeth_lower','mouth_tongue'])svg.querySelector('#'+id).setAttribute('mask','url(#'+mask.id+')');
 return [...receivers,
  {target:shadow.id,operation:'defer-collar-occlusion-to-draw-order',originalMask:'outfit_inner_collar_neck_occlusion'},
  {target:'mouth',operation:'reuse-skin-occluder-paths-as-cavity-mask',preserved:'original lip lines, aperture, local color and shadows'},
 ];
}
