import * as THREE from 'three';
import { BARRICADE_SITES } from '../data/barricades.js';
import { PALETTE as P } from './palette.js';

export function createBarricadeViews(scene){
  const root=new THREE.Group();root.name='camp-barricades';scene.add(root);
  const box=new THREE.BoxGeometry(1,1,1),wood=new THREE.MeshStandardMaterial({color:P.sandNight,roughness:.95}),cut=new THREE.MeshStandardMaterial({color:P.sandLit,roughness:1}),metal=new THREE.MeshStandardMaterial({color:P.chitin,metalness:.5,roughness:.6}),mark=new THREE.MeshBasicMaterial({color:P.fire,transparent:true,opacity:.6,depthWrite:false});
  const views=BARRICADE_SITES.map(site=>{
    const group=new THREE.Group();group.name=`barricade-${site.id}`;group.position.set(site.x,0,site.z);if(site.halfZ>site.halfX)group.rotation.y=Math.PI/2;root.add(group);
    const intact=new THREE.Group(),damaged=new THREE.Group(),ruins=new THREE.Group(),outline=new THREE.Group();group.add(intact,damaged,ruins,outline);
    function beam(parent,x,y,z,sx,sy,sz,material,rz=0){const m=new THREE.Mesh(box,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.rotation.z=rz;parent.add(m);return m;}
    for(const parent of [intact,damaged]){
      for(const side of [-1,1])beam(parent,side*1.35,.55,0,.12,1.1,.3,metal);
      for(let i=0;i<5;i++){
        if(parent===damaged&&i===3){beam(parent,-.9,.78,0,1.05,.16,.15,cut,-.15);beam(parent,1,.73,0,.8,.16,.15,cut,.19);}
        else beam(parent,0,.13+i*.2,0,3,.17,.15,wood,(i%2?1:-1)*.012);
      }
      beam(parent,0,.57,-.09,2.7,.12,.12,cut,.28);
    }
    for(let i=0;i<7;i++)beam(ruins,(i-3)*.36,.045+(i%2)*.035,Math.sin(i*2)*.4,.65,.08,.15,i%2?wood:cut,0).rotation.y=i*.75;
    for(let i=0;i<6;i++)beam(outline,-1.35+i*.54,.014,0,.27,.02,.12,mark);
    return {site,group,intact,damaged,ruins,outline};
  });
  function reset(){views.forEach(v=>{v.intact.visible=v.damaged.visible=v.ruins.visible=v.outline.visible=false;v.group.rotation.z=0;});}
  function update(s){
    for(const v of views){const b=s.barricades?.find(b=>b.id===v.site.id),health=b?.health??0;
      v.intact.visible=health>60;v.damaged.visible=health>0&&health<=60;v.ruins.visible=Boolean(b)&&health<=0;
      v.outline.visible=s.phase==='build'&&s.subphase==='build'&&health<=0;
      const age=s.time-(b?.hitTime??-1);v.group.rotation.z=age>=0&&age<.15?Math.sin(age*60)*.012:0;
    }
  }
  reset();return {update,reset,dispose(){root.removeFromParent();box.dispose();wood.dispose();cut.dispose();metal.dispose();mark.dispose();}};
}
