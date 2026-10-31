import * as THREE from 'three';
import { instantiateAsset } from './render/productionAssets.js';
import { createScenery } from './render/scenery.js';
import { createTrapViews } from './render/traps.js';
import { createSupplyView } from './render/supply.js';
import { createAttackWarnings } from './render/attackWarnings.js';

const WEAPONS=['pistol_makarov','shotgun_trench','smg_scorpion','flamethrower_torch','turret_sentry'];
export function createWorld(canvas, assets = new Map()) {
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,.035,200);
  scene.matrixAutoUpdate=false;
  const animationFrustum=new THREE.Frustum(),viewProjection=new THREE.Matrix4(),animationBounds=new THREE.Sphere();
  camera.rotation.order='YXZ';scene.add(camera);
  const scenery=createScenery(scene),entities=new Map(),dead=[],pool=new Map(),projectiles=new Map();
  const trapViews=createTrapViews(scene);
  const supplyView=createSupplyView(scene);
  const attackWarnings=createAttackWarnings(scene);
  const equipment=[],installed=[];let shelter,turret,lastTime=null,previousShot=0,previousReload=0,previousTurretShot=0,slot=0,noFlash=false,flashUntil=0,hadTurret=false,turretReloading=false;
  const shadowGeometry=new THREE.CircleGeometry(.65,16),shadowMaterial=new THREE.MeshBasicMaterial({color:'#171d28',transparent:true,opacity:.3,depthWrite:false});
  const eliteGeometry=new THREE.RingGeometry(.72,.77,32),eliteMaterial=new THREE.MeshBasicMaterial({color:'#ff5a1f',side:THREE.DoubleSide,transparent:true,opacity:.85,depthWrite:false,toneMapped:false});
  const eliteEyeMaterial=new THREE.SpriteMaterial({color:'#ff5a1f',transparent:true,opacity:.95,depthWrite:false,toneMapped:false,blending:THREE.AdditiveBlending});
  const webGeometry=new THREE.IcosahedronGeometry(.16,1),webMaterial=new THREE.MeshBasicMaterial({color:'#a9e2ce'});
  const muzzleMaterial=new THREE.SpriteMaterial({color:'#ffc47a',transparent:true,opacity:.85,depthWrite:false,blending:THREE.AdditiveBlending});
  const flash=new THREE.Sprite(muzzleMaterial);flash.scale.setScalar(.22);flash.visible=false;scene.add(flash);
  const flame=new THREE.Sprite(muzzleMaterial);flame.visible=false;scene.add(flame);
  const dust=Array.from({length:12},()=>{const sprite=new THREE.Sprite(new THREE.SpriteMaterial({color:'#b9a27e',transparent:true,opacity:0,depthWrite:false}));sprite.visible=false;scene.add(sprite);return {sprite,left:0};});let dustIndex=0;
  const target=new THREE.Vector3(),muzzle=new THREE.Vector3();
  // Procedural recoil layered on top of the GLB fire clip: sharp kick, fast spring return.
  // Most of the feel is in the weapon; the camera only gets a small pitch nudge.
  const KICK=[1,1.9,.55,.12,.3],VIEW_BASE=new THREE.Vector3(.24,-.25,-.48);let kick=0,kickRoll=0,shakeLeft=0,shakeAmount=0;
  const muzzleLight=new THREE.PointLight('#ffb35c',0,7,2);scene.add(muzzleLight);

  function install(catalog) {
    reset();installed.splice(0).forEach(v=>v.dispose());equipment.length=0;assets=catalog;scenery.install(assets);
    trapViews.install(assets);
    supplyView.install(assets);
    attackWarnings.install(assets);
    shelter=instantiateAsset(assets,'shelter');if(shelter){scene.add(shelter.root);installed.push(shelter);}
    for(const id of WEAPONS){const v=instantiateAsset(assets,id);equipment.push(v);if(!v)continue;
      v.root.position.set(.24,-.25,-.48);camera.add(v.root);v.root.visible=false;installed.push(v);
      const world=v.root.getObjectByName('world_root');if(world)world.visible=false;
    }
    turret=instantiateAsset(assets,'turret_sentry');if(turret){
      turret.root.getObjectByName('view_root').visible=false;turret.root.position.set(-4.7,0,3.6);scene.add(turret.root);installed.push(turret);turret.root.visible=false;turret.lod(0);
    }
    muzzleMaterial.map=assets.textures.get('fx');muzzleMaterial.needsUpdate=true;
    eliteEyeMaterial.map=assets.textures.get('fx');eliteEyeMaterial.needsUpdate=true;
    for(const d of dust){d.sprite.material.map=assets.textures.get('fx');d.sprite.material.needsUpdate=true;}
  }
  function enemy(e,scale) {
    const stock=pool.get(e.spiderId),v=stock?.pop()??instantiateAsset(assets,e.spiderId);if(!v)return null;
    if(!v.shadow){v.shadow=new THREE.Mesh(shadowGeometry,shadowMaterial);v.shadow.rotation.x=-Math.PI/2;v.shadow.scale.setScalar(scale);}
    if(e.elite&&!v.eliteMark){
      v.eliteMark=new THREE.Mesh(eliteGeometry,eliteMaterial);v.eliteMark.rotation.x=-Math.PI/2;v.eliteMark.position.y=.025;v.root.add(v.eliteMark);
      const head=v.root.getObjectByName('socket_attack')??v.root;
      v.eliteEyes=[-1,1].map(side=>{const eye=new THREE.Sprite(eliteEyeMaterial);eye.position.set(side*.085,.09,.025);eye.scale.setScalar(.1);head.add(eye);return eye;});
    }
    if(v.eliteMark)v.eliteMark.visible=Boolean(e.elite);
    v.eliteEyes?.forEach(eye=>{eye.visible=Boolean(e.elite);});
    v.type=e.spiderId;v.enraged=false;v.phaseUntil=0;v.reset();v.root.scale.setScalar(scale);v.root.visible=true;scene.add(v.root,v.shadow);return v;
  }
  function retire(v){v.reset();v.root.removeFromParent();v.shadow.removeFromParent();if(!pool.has(v.type))pool.set(v.type,[]);pool.get(v.type).push(v);}
  function reset(){
    trapViews.reset();
    supplyView.reset();
    attackWarnings.reset();
    entities.forEach(retire);entities.clear();dead.splice(0).forEach(d=>retire(d.v));
    projectiles.forEach(m=>m.removeFromParent());projectiles.clear();equipment.forEach(v=>v?.reset());
    dust.forEach(d=>{d.left=0;d.sprite.visible=false;});dustIndex=0;
    shakeLeft=shakeAmount=0;
    turret?.reset();previousShot=previousReload=previousTurretShot=slot=0;lastTime=null;flashUntil=0;flash.visible=flame.visible=false;kick=0;muzzleLight.intensity=0;hadTurret=turretReloading=false;
  }
  function render(alpha,s) {
    const dt=lastTime===null?0:Math.max(0,Math.min(.1,s.time-lastTime));lastTime=s.time;
    camera.position.set(s.player.x,s.player.y+1.65,s.player.z);camera.rotation.set(s.player.pitch,s.player.yaw,0,'YXZ');
    shakeLeft=Math.max(0,shakeLeft-dt);
    if(!noFlash&&shakeLeft>0){const strength=shakeAmount*(shakeLeft/.25)**2;
      camera.position.x+=Math.sin(s.time*91)*strength;camera.position.y+=Math.cos(s.time*113)*strength;camera.position.z+=Math.sin(s.time*79)*strength;}
    camera.updateWorldMatrix(true,false);animationFrustum.setFromProjectionMatrix(viewProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
    const live=new Set();
    for(const e of s.spiders){
      live.add(e.id);let v=entities.get(e.id);
      if(!v){v=enemy(e,s.definitions?.find(d=>d.id===e.spiderId)?.scale??1);if(!v)continue;entities.set(e.id,v);}
      v.root.position.set(e.x,e.y,e.z);v.root.rotation.y=e.yaw;
      v.shadow.position.set(e.x,.012,e.z);v.shadow.visible=e.y<.5;
      if(e.enraged&&!v.enraged)v.phaseUntil=s.time+.8;
      const action=s.time<v.phaseUntil&&['idle','walk'].includes(e.state)?'phase_change':e.state;v.enraged=e.enraged;
      const viewDistance=camera.position.distanceTo(v.root.position);
      animationBounds.center.set(e.x,e.y+e.height/2,e.z);animationBounds.radius=Math.max(3,e.radius*4);
      // Keep nearby rigs live; distant offscreen rigs catch up before their next visible frame.
      v.play(e.stun>0?'idle':action);v.lod(viewDistance);v.update(dt,viewDistance<8||animationFrustum.intersectsSphere(animationBounds));
    }
    for(const [id,v] of entities)if(!live.has(id)){
      entities.delete(id);v.play('death');v.root.position.y=0;v.shadow.visible=true;if(v.eliteMark)v.eliteMark.visible=false;v.eliteEyes?.forEach(eye=>{eye.visible=false;});dead.push({v,left:6});
      const d=dust[dustIndex++%dust.length];d.left=.6;d.sprite.position.copy(v.root.position);d.sprite.position.y=.2;d.sprite.visible=true;
    }
    for(let i=dead.length-1;i>=0;i--){const d=dead[i];d.left-=dt;if(!d.v.finished)d.v.mixer.update(dt);
      d.v.root.position.y=-.3*(1-Math.min(1,Math.max(0,d.left)/1.5));d.v.shadow.visible=d.left>1.5;
      if(d.left<=0){retire(d.v);dead.splice(i,1);}}
    for(const d of dust){d.left=Math.max(0,d.left-dt);d.sprite.visible=d.left>0;if(!d.sprite.visible)continue;
      const age=1-d.left/.6;d.sprite.material.opacity=.5*(1-age);d.sprite.scale.setScalar(.5+age*1.5);}
    if(shelter)for(const name of ['state_intact','state_damaged','state_critical','critical_standing','critical_ruins']){
      const n=shelter.root.getObjectByName(name);if(n)n.visible=name==='state_intact'?s.shelterIntegrity>=70:name==='state_damaged'?s.shelterIntegrity>=30&&s.shelterIntegrity<70:name==='state_critical'?s.shelterIntegrity<30:name==='critical_standing'?s.shelterIntegrity>0:s.shelterIntegrity<=0;
    }
    const view=equipment[s.activeSlot-1],kit=s.activeSlot===5;
    if(slot!==s.activeSlot){equipment.forEach((v,i)=>{if(v){v.root.visible=i===s.activeSlot-1;v.reset();}});slot=s.activeSlot;view?.play(kit?'kit_equip':'equip',true,.3);}
    if(view){
      if(kit&&s.turrets.length&&!hadTurret)view.play('kit_deploy',true);
      if(s.shotSerial!==previousShot){view.play('fire',true);previousShot=s.shotSerial;flashUntil=s.time+.045;
        kick=Math.min(1.6,kick+KICK[s.activeSlot-1]);kickRoll=(Math.random()-.5)*.5;
        muzzleMaterial.rotation=Math.random()*Math.PI*2;flash.scale.setScalar(.18+Math.random()*.12*(s.activeSlot===2?1.8:1));}
      kick*=Math.exp(-dt*16);if(kick<1e-3)kick=0;
      view.root.position.set(VIEW_BASE.x+kick*.012*kickRoll,VIEW_BASE.y+kick*.018,VIEW_BASE.z+kick*.075);
      view.root.rotation.set(kick*.16,kick*.02*kickRoll,kick*.06*kickRoll);
      camera.rotation.x+=kick*.008;
      if(s.reloadSerial!==previousReload){view.play('reload',true,s.weapons[s.activeSlot-1].reload);previousReload=s.reloadSerial;}
      if(view.finished)view.play(kit?'kit_idle':'idle');view.mixer.update(dt);
      const socket=view.root.getObjectByName('socket_muzzle');camera.updateMatrixWorld(true);socket?.getWorldPosition(muzzle);
      flash.position.copy(muzzle);flash.visible=!noFlash&&s.time<flashUntil&&s.activeSlot!==4;
      muzzleLight.position.copy(muzzle);muzzleLight.intensity=flash.visible?(s.activeSlot===2?14:8):0;
      flame.visible=s.activeSlot===4&&s.time-(s.lastShot?.time??-1)<.12;
      if(flame.visible){camera.getWorldDirection(target);flame.position.copy(muzzle).addScaledVector(target,1.2);flame.scale.set(1,1.6,1);}
    }
    if(turret){
      turret.root.visible=s.turrets.length>0;
      if(turret.root.visible){if(!hadTurret)turret.play('sentry_idle');turret.root.getObjectByName('head_yaw').rotation.y=s.turrets[0].yaw;turret.lod(camera.position.distanceTo(turret.root.position));
        if(s.turrets[0].reload>0&&!turretReloading)turret.play('sentry_reload',true,s.turrets[0].reload);
        if(s.turretShotSerial!==previousTurretShot){turret.play('sentry_fire',true);previousTurretShot=s.turretShotSerial;}
        if(turret.finished)turret.play('sentry_idle');turret.mixer.update(dt);
      }
      turretReloading=(s.turrets[0]?.reload??0)>0;hadTurret=s.turrets.length>0;
    }
    const ids=new Set(s.webs.map(w=>w.id));
    for(const w of s.webs){let m=projectiles.get(w.id);if(!m){m=new THREE.Mesh(webGeometry,webMaterial);projectiles.set(w.id,m);scene.add(m);}m.position.set(w.x,w.y,w.z);}
    for(const [id,m]of projectiles)if(!ids.has(id)){m.removeFromParent();projectiles.delete(id);}
    attackWarnings.update(s);supplyView.update(s);trapViews.update(s);scenery.update(s,s.visualDelta??dt,noFlash);renderer.render(scene,camera);
  }
  return {getScene:()=>scene,getCamera:()=>camera,install,render,reset,
    shake(amount){if(noFlash||!Number.isFinite(amount)||amount<=0)return;shakeAmount=.04*amount/10;shakeLeft=.25;},
    setNoFlash(value){noFlash=Boolean(value);if(noFlash)shakeLeft=shakeAmount=0;},
    resize(w,h,dpr){camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(dpr,1.5));renderer.setSize(w,h);},
    dispose(){reset();for(const values of pool.values())for(const v of values)v.dispose();pool.clear();installed.forEach(v=>v.dispose());attackWarnings.dispose();supplyView.dispose();trapViews.dispose();scenery.dispose();shadowGeometry.dispose();shadowMaterial.dispose();eliteGeometry.dispose();eliteMaterial.dispose();eliteEyeMaterial.dispose();webGeometry.dispose();webMaterial.dispose();muzzleMaterial.dispose();dust.forEach(d=>{d.sprite.removeFromParent();d.sprite.material.dispose();});renderer.dispose();}
  };
}
