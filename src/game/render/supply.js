import * as THREE from 'three';

export function createSupplyView(scene){
  const root=new THREE.Group();root.name='playable-supply';root.visible=false;scene.add(root);
  const geometry=new THREE.RingGeometry(.54,.62,32);
  const material=new THREE.MeshBasicMaterial({color:'#8ee6d1',side:THREE.DoubleSide,transparent:true,opacity:.85,depthWrite:false,toneMapped:false});
  const mark=new THREE.Mesh(geometry,material);mark.name='supply-mark';mark.rotation.x=-Math.PI/2;mark.position.y=.025;
  let lod0,lod1;
  return {
    install(assets){
      const original=assets.get('camp_props')?.scene.getObjectByName('supply_crate');
      if(!original)throw new Error('E2 supply unavailable: supply_crate');
      const model=original.clone(true);lod0=model.getObjectByName('supply_crate_LOD0');lod1=model.getObjectByName('supply_crate_LOD1');
      if(!lod0||!lod1)throw new Error('E2 supply missing LOD pair');
      root.clear();model.position.set(0,0,0);root.add(model,mark);root.visible=false;
    },
    update(s){
      root.visible=Boolean(s.supply)&&s.phase==='wave';if(!root.visible)return;
      root.position.set(s.supply.x,-.035,s.supply.z);
      const near=Math.hypot(s.supply.x-s.player.x,s.supply.z-s.player.z)<12;lod0.visible=near;lod1.visible=!near;
    },
    reset(){root.visible=false;},
    dispose(){root.removeFromParent();root.clear();geometry.dispose();material.dispose();}
  };
}
