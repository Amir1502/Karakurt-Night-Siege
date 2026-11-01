import * as THREE from 'three';
import { COMBAT_FEEL as FX } from '../data/combatFeel.js';
import { PALETTE as P } from './palette.js';
const C={brass:P.fire,shell:P.karakurtRed,smoke:P.sandLit,chips:P.chitin,flame:P.embers,core:P.fire};

export function createCombatEffects(scene){
  const root=new THREE.Group();root.name='combat-effects';scene.add(root);
  const shellGeometry=new THREE.CylinderGeometry(.014,.014,.05,6),chipGeometry=new THREE.IcosahedronGeometry(.035,0);
  const brass=new THREE.MeshStandardMaterial({color:C.brass,metalness:.65,roughness:.4}),shellMaterial=new THREE.MeshStandardMaterial({color:C.shell,roughness:.6});
  const chipMaterial=new THREE.MeshStandardMaterial({color:C.chips,roughness:.8});
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
  const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(32,32,0,32,32,32);gradient.addColorStop(0,'rgba(255,255,255,.6)');gradient.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
  const smokeTexture=new THREE.CanvasTexture(canvas);
  const shells=Array.from({length:FX.shellCount},()=>particle(new THREE.Mesh(shellGeometry,brass)));
  const chips=Array.from({length:FX.chipCount},()=>particle(new THREE.Mesh(chipGeometry,chipMaterial)));
  const smoke=Array.from({length:FX.smokeCount},()=>particle(new THREE.Sprite(new THREE.SpriteMaterial({color:C.smoke,map:smokeTexture,transparent:true,depthWrite:false,opacity:0}))));
  const flame=new THREE.Group();flame.name='flamethrower-stream';root.add(flame);
  const flameGeometry=new THREE.SphereGeometry(1,8,6),outer=new THREE.MeshBasicMaterial({color:C.flame,transparent:true,opacity:.26,depthWrite:false,toneMapped:false}),inner=new THREE.MeshBasicMaterial({color:C.core,transparent:true,opacity:.55,depthWrite:false,toneMapped:false});
  for(let i=0;i<7;i++){const m=new THREE.Mesh(flameGeometry,i%2?outer:inner);m.position.z=-.3-i*.5;m.scale.set(.085+i*.055,.075+i*.048,.4);flame.add(m);}
  flame.visible=false;
  let shot=0,impact=0,si=0,ci=0,mi=0;
  const worldQuaternion=new THREE.Quaternion(),offset=new THREE.Vector3(),velocity=new THREE.Vector3();
  function particle(mesh){mesh.visible=false;root.add(mesh);return {mesh,left:0,life:0,v:new THREE.Vector3()};}
  function launch(p,position,v,life){p.mesh.position.copy(position);p.v.copy(v);p.left=p.life=life;p.mesh.visible=true;}
  function reset(){[...shells,...chips,...smoke].forEach(p=>{p.left=0;p.mesh.visible=false;});flame.visible=false;shot=impact=si=ci=mi=0;}
  function update(s,dt,muzzle,camera,noFlash){
    if(s.shotSerial!==shot){
      shot=s.shotSerial;
      if(s.lastShot?.slot===s.activeSlot&&s.activeSlot<4){
        camera.getWorldQuaternion(worldQuaternion);offset.set(.1,-.04,.16).applyQuaternion(worldQuaternion).add(muzzle);
        velocity.set(1.6+Math.random()*.7,.8+Math.random()*.6,.35).applyQuaternion(worldQuaternion);
        const p=shells[si++%shells.length];p.mesh.material=s.activeSlot===2?shellMaterial:brass;p.mesh.scale.setScalar(s.activeSlot===2?1.5:1);launch(p,offset,velocity,1.6);
        if(!noFlash){const m=smoke[mi++%smoke.length];launch(m,muzzle,new THREE.Vector3(0,.4,0),.65);}
      }
    }
    for(const hit of s.impacts??[]){if(hit.serial<=impact)continue;impact=hit.serial;if(noFlash)continue;
      for(let i=0;i<3;i++)launch(chips[ci++%chips.length],{x:hit.x,y:hit.y,z:hit.z},new THREE.Vector3((Math.random()-.5)*1.4,.5+Math.random(),(Math.random()-.5)*1.4),.3);
    }
    for(const p of [...shells,...chips]){p.left=Math.max(0,p.left-dt);p.mesh.visible=p.left>0;if(!p.left)continue;p.v.y-=dt*5;p.mesh.position.addScaledVector(p.v,dt);p.mesh.rotation.x+=dt*9;p.mesh.rotation.z+=dt*6;if(p.mesh.position.y<.035){p.mesh.position.y=.035;p.v.set(0,0,0);}}
    for(const p of smoke){p.left=Math.max(0,p.left-dt);p.mesh.visible=!noFlash&&p.left>0;if(!p.mesh.visible)continue;p.mesh.position.addScaledVector(p.v,dt);const age=1-p.left/p.life;p.mesh.material.opacity=.25*(1-age);p.mesh.scale.setScalar(.1+age*.5);}
    flame.visible=s.activeSlot===4&&s.lastShot?.slot===4&&s.time-s.lastShot.time<.12;
    if(flame.visible){flame.position.copy(muzzle);camera.getWorldQuaternion(flame.quaternion);flame.children.forEach((m,i)=>{const pulse=noFlash?1:1+.06*Math.sin(s.time*17+i);m.scale.x=(.085+i*.055)*pulse;m.scale.y=(.075+i*.048)*pulse;});}
  }
  return {update,reset,dispose(){root.removeFromParent();shellGeometry.dispose();chipGeometry.dispose();flameGeometry.dispose();brass.dispose();shellMaterial.dispose();chipMaterial.dispose();outer.dispose();inner.dispose();smoke.forEach(p=>p.mesh.material.dispose());smokeTexture.dispose();}};
}
