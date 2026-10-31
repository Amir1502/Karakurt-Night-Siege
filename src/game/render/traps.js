import * as THREE from 'three';

// Six slots cover three live traps plus their short spent marks during the next preparation.
export function createTrapViews(scene) {
  const group=new THREE.Group();group.name='playable-traps';scene.add(group);
  const geometry=new THREE.RingGeometry(.68,.73,32);
  const ready=new THREE.MeshBasicMaterial({color:'#8ee6d1',side:THREE.DoubleSide,depthWrite:false,toneMapped:false});
  const spent=new THREE.MeshBasicMaterial({color:'#ffbc70',side:THREE.DoubleSide,depthWrite:false,toneMapped:false});
  const slots=[];
  function reset(){slots.forEach(v=>{v.root.visible=false;});}
  return {
    install(assets){
      group.clear();slots.length=0;
      const prototype=assets.get('camp_props')?.scene.getObjectByName('bear_trap');
      if(!prototype)throw new Error('E2 trap unavailable: bear_trap');
      for(let i=0;i<6;i++) {
        const root=new THREE.Group(),model=prototype.clone(true),mark=new THREE.Mesh(geometry,ready);
        const lod0=model.getObjectByName('bear_trap_LOD0'),lod1=model.getObjectByName('bear_trap_LOD1');
        if(!lod0||!lod1)throw new Error('E2 trap missing LOD pair');
        model.position.set(0,0,0);mark.rotation.x=-Math.PI/2;mark.position.y=.02;
        root.add(model,mark);root.visible=false;group.add(root);slots.push({root,model,mark,lod0,lod1});
      }
    },
    update(s){
      const entries=[...(s.traps??[]),...(s.trapEffects??[]).filter(t=>t.until>s.time)];
      slots.forEach((v,i)=>{
        const trap=entries[i];v.root.visible=Boolean(trap);if(!trap)return;
        v.root.position.set(trap.x,-.03,trap.z);v.root.rotation.y=trap.yaw;
        const active=trap.until===undefined;v.model.visible=active;v.mark.material=active?ready:spent;
        v.mark.scale.setScalar(active?1:1.15);
        const near=Math.hypot(trap.x-s.player.x,trap.z-s.player.z)<12;v.lod0.visible=near;v.lod1.visible=!near;
      });
    },
    reset,
    dispose(){group.removeFromParent();group.clear();slots.length=0;geometry.dispose();ready.dispose();spent.dispose();},
  };
}
