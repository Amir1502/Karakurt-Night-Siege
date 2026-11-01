import * as THREE from 'three';
import { PALETTE as P } from './palette.js';

export function createNestView(scene){
  const root=new THREE.Group();root.name='spider-nest';scene.add(root);
  const cocoonGeometry=new THREE.IcosahedronGeometry(.8,2),threadGeometry=new THREE.TorusGeometry(.8,.013,3,32),coreGeometry=new THREE.IcosahedronGeometry(.55,1);
  const silk=new THREE.MeshStandardMaterial({color:P.sandLit,roughness:.95}),thread=new THREE.MeshStandardMaterial({color:P.moon,roughness:1}),coreMaterial=new THREE.MeshStandardMaterial({color:P.karakurtRed,roughness:.65,emissive:P.karakurtRed,emissiveIntensity:.14});
  const body=new THREE.Mesh(cocoonGeometry,silk);body.position.y=.85;body.scale.set(1,1.02,.85);root.add(body);
  const core=new THREE.Mesh(coreGeometry,coreMaterial);core.position.set(.32,.86,.16);root.add(core);
  for(let i=0;i<10;i++){const m=new THREE.Mesh(threadGeometry,thread);m.position.y=.85;m.rotation.set(i*.61,i*.37,i*.19);m.scale.set(1,1.02,.86);root.add(m);}
  const points=[];
  for(let i=0;i<10;i++){const a=i*Math.PI/5,x=Math.cos(a),z=Math.sin(a);points.push(x*.25,.65,z*.25,x*1.3,.03,z*1.3);points.push(x*1.3,.03,z*1.3,Math.cos(a+.628)*1.3,.03,Math.sin(a+.628)*1.3);}
  const webGeometry=new THREE.BufferGeometry();webGeometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
  const webMaterial=new THREE.LineBasicMaterial({color:P.moon,transparent:true,opacity:.7});root.add(new THREE.LineSegments(webGeometry,webMaterial));
  const barGeometry=new THREE.PlaneGeometry(1,.08),backMaterial=new THREE.MeshBasicMaterial({color:P.chitin}),barMaterial=new THREE.MeshBasicMaterial({color:P.karakurtRed});
  const health=new THREE.Group(),back=new THREE.Mesh(barGeometry,backMaterial),fill=new THREE.Mesh(barGeometry,barMaterial);fill.position.z=.002;health.add(back,fill);health.position.y=1.9;root.add(health);
  let lastId=null,lastNotice=null,brokenUntil=0,lastPosition=new THREE.Vector3();
  const debrisRoot=new THREE.Group();debrisRoot.name='nest-fragments';scene.add(debrisRoot);
  const debris=Array.from({length:8},()=>{const m=new THREE.Mesh(coreGeometry,silk);m.scale.set(.14,.08,.12);debrisRoot.add(m);return m;});
  function reset(){root.visible=false;debrisRoot.visible=false;lastId=lastNotice=null;brokenUntil=0;}
  function update(s,camera,noFlash){
    const n=s.nest;root.visible=Boolean(n&&n.health>0);
    if(root.visible){lastId=n.id;lastPosition.set(n.x,0,n.z);root.position.copy(lastPosition);
      const pulse=noFlash?1:1+.018*Math.sin(s.time*3);body.scale.set(pulse,1.02*pulse,.85*pulse);body.rotation.z=n.health<50?.08:0;core.visible=n.health<60;
      health.visible=camera.position.distanceTo(root.position)<12;health.quaternion.copy(camera.quaternion);fill.scale.x=Math.max(.001,n.health/n.maxHealth);fill.position.x=-(1-fill.scale.x)/2;
    } else if(lastId&&s.nestNotice?.kind==='destroyed'&&s.nestNotice.time!==lastNotice){lastNotice=s.nestNotice.time;brokenUntil=s.time+1.2;debrisRoot.position.copy(lastPosition);lastId=null;}
    debrisRoot.visible=!noFlash&&s.time<brokenUntil;
    if(debrisRoot.visible){const age=1.2-(brokenUntil-s.time);debris.forEach((m,i)=>{const a=i*Math.PI/4;m.position.set(Math.cos(a)*age*.7,Math.max(.04,Math.sin(age*Math.PI/1.2)*.4),Math.sin(a)*age*.7);m.rotation.set(age*2,i,age*3);});}
  }
  reset();return {update,reset,dispose(){root.removeFromParent();debrisRoot.removeFromParent();cocoonGeometry.dispose();threadGeometry.dispose();coreGeometry.dispose();silk.dispose();thread.dispose();coreMaterial.dispose();webGeometry.dispose();webMaterial.dispose();barGeometry.dispose();backMaterial.dispose();barMaterial.dispose();}};
}
