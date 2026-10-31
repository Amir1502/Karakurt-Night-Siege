import * as THREE from 'three';
import {createAttackCues} from './attackCues.js';

// One fixed slot per possible live enemy. No lights, geometry or timers are allocated per attack.
export function createAttackWarnings(scene){
  const group=new THREE.Group();group.name='attack-warnings';scene.add(group);
  const cues=createAttackCues(),ringGeometry=new THREE.RingGeometry(1.08,1.2,32);
  const arrowGeometry=new THREE.BufferGeometry();
  arrowGeometry.setAttribute('position',new THREE.Float32BufferAttribute([-.42,0,.4,0,0,1.55,.42,0,.4],3));
  const markMaterial=new THREE.MeshBasicMaterial({color:'#ffbc70',side:THREE.DoubleSide,transparent:true,opacity:.85,depthWrite:false,toneMapped:false});
  const dustMaterial=new THREE.SpriteMaterial({color:'#b9a27e',transparent:true,opacity:.24,depthWrite:false});
  const slots=Array.from({length:40},(_,i)=>{
    const root=new THREE.Group();root.name='attack-warning-'+i;root.visible=false;group.add(root);
    const ring=new THREE.Mesh(ringGeometry,markMaterial),arrow=new THREE.Mesh(arrowGeometry,markMaterial);
    ring.name='landing-mark';ring.rotation.x=-Math.PI/2;ring.position.y=.025;arrow.position.y=.025;
    const dust=[-.5,.5].map(x=>{const sprite=new THREE.Sprite(dustMaterial);sprite.position.set(x,.22,-.1);sprite.scale.set(.9,.5,1);return sprite;});
    root.add(ring,arrow,...dust);return {root,ring,arrow,dust};
  });
  return {
    install(assets){dustMaterial.map=assets.textures.get('fx');dustMaterial.needsUpdate=true;},
    update(s){
      const {marks}=cues.update(s);
      slots.forEach((v,i)=>{
        const mark=marks[i];v.root.visible=Boolean(mark);if(!mark)return;
        v.root.userData.kind=mark.kind;v.root.userData.entity=mark.id;
        v.root.position.set(mark.x,0,mark.z);
        v.root.rotation.y=mark.yaw;
        v.ring.visible=mark.kind==='landing';v.arrow.visible=mark.kind==='charge';
        v.dust.forEach(d=>{d.visible=mark.kind==='charge'&&mark.windup;});
      });
    },
    reset(){cues.reset();slots.forEach(v=>{v.root.visible=false;});},
    dispose(){group.removeFromParent();group.clear();ringGeometry.dispose();arrowGeometry.dispose();markMaterial.dispose();dustMaterial.dispose();}
  };
}
