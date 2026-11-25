import test from 'node:test';
import assert from 'node:assert/strict';
import {fitFullPhoto,photoFillScale,photoDimensions,photoPanLimits} from '../scripts/profile-photo-fit.js';

for (const [name,width,height] of [['provided square portrait',320,320],['tall portrait',600,1200],['landscape photo',1600,900],['wide panorama',5000,200]]) {
  for (const rotation of [0,90,180,270]) {
    test(`${name} at ${rotation} degrees keeps every corner inside the opening and above the badge`,()=>{
      const radius=390,badgeTop=710;
      const fit=fitFullPhoto({width,height,rotation,radius,badgeTop});
      const scale=photoFillScale(width,height,rotation)*fit.zoom;
      const size=photoDimensions(width,height,rotation);
      assert(fit.zoom>0&&fit.zoom<1,'full fit can shrink below the old minimum');
      for (const x of [-size.width*scale/2,size.width*scale/2]) {
        for (const y of [-size.height*scale/2,size.height*scale/2]) {
          assert(Math.hypot(fit.x+x,fit.y+y)<radius,'corner is visible in the circle');
          assert(512+fit.y+y<=badgeTop-11.99,'photo clears badge');
        }
      }
      const limits=photoPanLimits({width,height,rotation,zoom:fit.zoom});
      assert(limits.x>=512&&limits.y>=512,'fitted photo can move horizontally and vertically');
    });
  }
}
test('without artwork the complete photo stays centered and uses the available circle',()=>{
 const fit=fitFullPhoto({width:320,height:320,radius:449});
 assert.equal(fit.x,0);assert(Math.abs(fit.y)<1e-7);
 const side=320*photoFillScale(320,320)*fit.zoom;
 assert(side>620&&side<630);
});
test('a larger badge reserves more room without cropping the photo',()=>{
 const small=fitFullPhoto({width:320,height:320,radius:390,badgeTop:780});
 const large=fitFullPhoto({width:320,height:320,radius:390,badgeTop:660});
 assert(large.zoom<small.zoom);
});
