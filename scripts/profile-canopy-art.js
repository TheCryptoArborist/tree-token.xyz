// Use the game's alpha-connected growth isolation, keeping the original atlas unchanged.
export function extractAncientOak(image,makeCanvas){
 const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height,count=width*height;if(!count||count>8000000)throw Error('Invalid defender atlas.');
 const source=makeCanvas(width,height),context=source.getContext('2d');context.drawImage(image,0,0);const data=context.getImageData(0,0,width,height).data;
 const labels=new Int32Array(count),stack=new Int32Array(count),parts=[];let label=0;
 for(let pixel=0;pixel<count;pixel++){if(labels[pixel]||data[pixel*4+3]<180)continue;label++;let pending=1,size=0,x0=width,y0=height,x1=0,y1=0;stack[0]=pixel;labels[pixel]=label;
  while(pending){const at=stack[--pending],x=at%width,y=Math.floor(at/width);size++;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);for(const next of [x?at-1:-1,x<width-1?at+1:-1,y?at-width:-1,y<height-1?at+width:-1])if(next>=0&&!labels[next]&&data[next*4+3]>=180){labels[next]=label;stack[pending++]=next;}}
  parts.push({label,size,x0,y0,x1,y1});
 }
 const bodies=parts.sort((a,b)=>b.size-a.size).slice(0,3).sort((a,b)=>a.x0-b.x0);if(bodies.length!==3||bodies.some(b=>b.size<1000))throw Error('Missing defender growth silhouettes.');
 const owners=new Int8Array(label+1);owners.fill(-1);bodies.forEach((b,i)=>owners[b.label]=i);
 for(const part of parts)if(owners[part.label]<0&&part.size>=24){const x=(part.x0+part.x1)/2,y=(part.y0+part.y1)/2;let nearest=0,distance=Infinity;bodies.forEach((b,i)=>{const dx=x-Math.max(b.x0,Math.min(x,b.x1)),dy=y-Math.max(b.y0,Math.min(y,b.y1)),score=dx*dx+dy*dy+.01*(x-(b.x0+b.x1)/2)**2;if(score<distance){distance=score;nearest=i;}});owners[part.label]=nearest;}
 const mask=new Uint8Array(count);let x0=width,y0=height,x1=0,y1=0;
 for(let at=0;at<count;at++){if(data[at*4+3]<30)continue;let owner=owners[labels[at]];const x=at%width,y=Math.floor(at/width);if(owner<0&&data[at*4+3]<180){for(let dy=-2;dy<=2&&owner<0;dy++)for(let dx=-2;dx<=2&&owner<0;dx++)if(x+dx>=0&&x+dx<width&&y+dy>=0&&y+dy<height)owner=owners[labels[at+dy*width+dx]];}if(owner!==2)continue;mask[at]=1;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
 if(x1<=x0||y1<=y0)throw Error('Ancient Oak silhouette unavailable.');const padding=8,w=x1-x0+1,h=y1-y0+1,out=makeCanvas(w+padding*2,h+padding*2),c=out.getContext('2d'),pixels=c.createImageData(out.width,out.height);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const at=(y+y0)*width+x+x0;if(mask[at])pixels.data.set(data.subarray(at*4,at*4+4),((y+padding)*out.width+x+padding)*4);}c.putImageData(pixels,0,0);return out;
}
const cache=new Map();
export function ancientOakArtwork(url,loadImage){if(!cache.has(url)){const pending=(async()=>{const image=await loadImage(url),canvas=extractAncientOak(image,(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;});return loadImage(canvas.toDataURL('image/png'));})();cache.set(url,pending);pending.catch(()=>cache.delete(url));}return cache.get(url);}
