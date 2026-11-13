'use strict';
(() => {
  const $=id=>document.getElementById(id),section=$('device-gallery'),stage=$('gallery-open'),photo=$('gallery-photo'),viewer=$('photo-viewer'),viewport=$('zoom-viewport'),canvas=$('zoom-canvas'),zoomPhoto=$('zoom-photo');
  let slides=[],index=0,product=null,scale=1,failed=false,gesture=null,suppressClick=false;
  const points=new Map();let pinchDistance=0,drag=null;
  const safe=art=>art&&typeof art.path==='string'&&/^assets\/products\/[a-z0-9-]+\.(?:png|jpg|webp)$/.test(art.path)&&[art.width,art.height].every(n=>Number.isFinite(n)&&n>0);
  function frame(img,art){
    img.removeAttribute('style');img.parentElement.removeAttribute('style');
    const f=art.framing||{x:0,y:0,width:art.width,height:art.height};
    if(![f.x,f.y,f.width,f.height].every(Number.isFinite)||f.x<0||f.y<0||f.width<=0||f.height<=0||f.x+f.width>art.width||f.y+f.height>art.height)return;
    const crop=img.parentElement;crop.style.aspectRatio=f.width+'/'+f.height;crop.style.setProperty('--photo-ratio',String(f.width/f.height));
    img.style.width=art.width/f.width*100+'%';img.style.height=art.height/f.height*100+'%';img.style.left=-f.x/f.width*100+'%';img.style.top=-f.y/f.height*100+'%';
  }
  const src=art=>art.path+(typeof art.sha256==='string'?'?v='+art.sha256.slice(0,12):'');
  function draw(img,art){frame(img,art);img.src=src(art);img.alt=product.model+', '+product.color+' · '+art.label;}
  function select(next){
    if(!slides.length)return;index=(next+slides.length)%slides.length;failed=false;
    draw(photo,slides[index]);photo.hidden=false;$('gallery-empty').hidden=true;stage.disabled=false;
    const label=slides[index].label;$('gallery-caption').textContent=label;$('gallery-counter').textContent=(index+1)+' / '+slides.length;
    for(const [i,b] of [...$('gallery-thumbs').children].entries())b.setAttribute('aria-pressed',String(i===index));
    if(viewer.open){draw(zoomPhoto,slides[index]);resetZoom();updateViewerLabel();}
  }
  function updateViewerLabel(){$('zoom-title').textContent=product.model+' · '+product.color;$('zoom-counter').textContent=(index+1)+' / '+slides.length+' · '+slides[index].label;}
  function move(step){select(index+step);}
  function resetZoom(){scale=1;canvas.style.width='100%';canvas.style.height='100%';viewport.scrollLeft=0;viewport.scrollTop=0;updateZoom();}
  function updateZoom(){$('zoom-level').textContent=Math.round(scale*100)+'%';$('zoom-out').disabled=scale<=1;$('zoom-in').disabled=scale>=4;viewport.classList.toggle('is-zoomed',scale>1);}
  function setZoom(next,clientX,clientY){
    next=Math.max(1,Math.min(4,next));const rect=viewport.getBoundingClientRect(),x=clientX===undefined?viewport.clientWidth/2:clientX-rect.left,y=clientY===undefined?viewport.clientHeight/2:clientY-rect.top;
    const left=(viewport.scrollLeft+x)*next/scale-x,top=(viewport.scrollTop+y)*next/scale-y;scale=next;
    canvas.style.width=scale*100+'%';canvas.style.height=scale*100+'%';viewport.scrollLeft=left;viewport.scrollTop=top;updateZoom();
  }
  function openZoom(){if(failed||!slides.length)return;draw(zoomPhoto,slides[index]);resetZoom();updateViewerLabel();viewer.showModal();}
  function show(device,picture){
    if(viewer.open)viewer.close();product=device;index=0;slides=[];
    if(safe(picture)){
      const high=(Array.isArray(picture.gallery)?picture.gallery:[]).find(art=>safe(art)&&art.model===device.model&&art.color===device.color&&art.label==='Vista general en alta resolución');
      const general=high||picture;slides.push({...general,label:'Vista general'});
      for(const art of (Array.isArray(picture.gallery)?picture.gallery:[]).slice(0,6))if(safe(art)&&art.model===device.model&&art.color===device.color&&!slides.some(s=>s.path===art.path))slides.push({...art,label:typeof art.label==='string'?art.label.slice(0,60):'Otra perspectiva'});
      // The official Apple comparison photo contains both sides. Offer honest
      // close-ups from that photo when individual manufacturer views are absent.
      if(slides.length===1&&device.manufacturer==='Apple'&&/compare_iphone/.test(picture.sourceImage||'')){
        const w=general.width,h=general.height;
        slides.push({...general,label:'Detalle de cámaras',framing:{x:0,y:0,width:Math.ceil(w*.57),height:Math.ceil(h*.56)}});
        slides.push({...general,label:'Detalle de pantalla',framing:{x:Math.floor(w*.37),y:0,width:w-Math.floor(w*.37),height:h}});
      }else if(slides.length===1){
        const base=general.framing||{x:0,y:0,width:general.width,height:general.height};
        slides.push({...general,label:'Detalle superior',framing:{...base,height:Math.ceil(base.height*.6)}});
        const offset=Math.floor(base.height*.4);slides.push({...general,label:'Detalle inferior',framing:{...base,y:base.y+offset,height:base.height-offset}});
      }
    }
    section.setAttribute('aria-label','Fotos de '+device.model+', '+device.color);
    $('gallery-thumbs').replaceChildren();$('gallery-thumbs').hidden=slides.length<2;
    for(const [i,art] of slides.entries()){
      const b=document.createElement('button');b.type='button';b.className='gallery-thumb';b.setAttribute('aria-label',art.label);b.setAttribute('aria-pressed',String(i===0));
      const crop=document.createElement('span');crop.className='gallery-crop';const img=document.createElement('img');img.alt='';img.loading='lazy';img.decoding='async';img.draggable=false;crop.append(img);b.append(crop);frame(img,art);img.src=src(art);b.addEventListener('click',()=>select(i));$('gallery-thumbs').append(b);
    }
    for(const id of ['gallery-prev','gallery-next','zoom-prev','zoom-next'])$(id).hidden=slides.length<2;
    $('gallery-controls').hidden=!slides.length;stage.hidden=!slides.length;$('gallery-empty').hidden=Boolean(slides.length);
    $('gallery-empty').textContent='Foto de este color pendiente';
    if(slides.length)select(0);
  }
  photo.addEventListener('error',()=>{failed=true;photo.hidden=true;stage.disabled=true;$('gallery-empty').hidden=false;$('gallery-empty').textContent='No pudimos cargar esta foto. Puedes probar otra vista.';});
  zoomPhoto.addEventListener('error',()=>{viewer.close();});
  $('gallery-prev').addEventListener('click',()=>move(-1));$('gallery-next').addEventListener('click',()=>move(1));
  $('zoom-prev').addEventListener('click',()=>move(-1));$('zoom-next').addEventListener('click',()=>move(1));
  stage.addEventListener('click',e=>{if(suppressClick&&e.detail!==0){suppressClick=false;return;}suppressClick=false;openZoom();});
  stage.addEventListener('pointerdown',e=>{gesture={id:e.pointerId,x:e.clientX,y:e.clientY};suppressClick=false;stage.setPointerCapture(e.pointerId);});
  stage.addEventListener('pointerup',e=>{if(!gesture||gesture.id!==e.pointerId)return;const x=e.clientX-gesture.x,y=e.clientY-gesture.y;gesture=null;if(Math.abs(x)>40&&Math.abs(x)>Math.abs(y)*1.3){suppressClick=true;move(x>0?-1:1);}});
  stage.addEventListener('pointercancel',()=>{gesture=null;});
  section.addEventListener('keydown',e=>{if(slides.length>1&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();move(e.key==='ArrowLeft'?-1:1);}});
  $('zoom-close').addEventListener('click',()=>viewer.close());$('zoom-in').addEventListener('click',()=>setZoom(scale+.5));$('zoom-out').addEventListener('click',()=>setZoom(scale-.5));$('zoom-reset').addEventListener('click',resetZoom);
  viewer.addEventListener('close',()=>{points.clear();drag=null;pinchDistance=0;resetZoom();});
  viewer.addEventListener('click',e=>{if(e.target===viewer){const r=viewer.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)viewer.close();}});
  viewer.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();move(e.key==='ArrowLeft'?-1:1);}else if(e.key==='+'||e.key==='='){e.preventDefault();setZoom(scale+.5);}else if(e.key==='-'){e.preventDefault();setZoom(scale-.5);}else if(e.key==='0')resetZoom();});
  viewport.addEventListener('wheel',e=>{e.preventDefault();setZoom(scale*(e.deltaY<0?1.15:1/1.15),e.clientX,e.clientY);},{passive:false});
  viewport.addEventListener('dblclick',e=>setZoom(scale>1?1:2.5,e.clientX,e.clientY));
  viewport.addEventListener('pointerdown',e=>{if(e.button!==0)return;points.set(e.pointerId,{x:e.clientX,y:e.clientY});viewport.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY};pinchDistance=0;});
  viewport.addEventListener('pointermove',e=>{
    if(!points.has(e.pointerId))return;points.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(points.size===2){const [a,b]=[...points.values()],distance=Math.hypot(a.x-b.x,a.y-b.y);if(pinchDistance>0)setZoom(scale*distance/pinchDistance,(a.x+b.x)/2,(a.y+b.y)/2);pinchDistance=distance;drag=null;}
    else if(drag){if(scale>1){viewport.scrollLeft-=e.clientX-drag.x;viewport.scrollTop-=e.clientY-drag.y;}drag.x=e.clientX;drag.y=e.clientY;}
  });
  function endPointer(e){const swipe=points.size===1&&scale===1&&drag&&e.type==='pointerup'?{x:e.clientX-drag.startX,y:e.clientY-drag.startY}:null;points.delete(e.pointerId);pinchDistance=0;drag=null;if(swipe&&Math.abs(swipe.x)>45&&Math.abs(swipe.x)>Math.abs(swipe.y)*1.3)move(swipe.x>0?-1:1);}
  viewport.addEventListener('pointerup',endPointer);viewport.addEventListener('pointercancel',endPointer);
  window.LunivoProductGallery={show};
})();
