import {visible} from '../sim/physics.js';
import {HUD} from '../data/hud.js';

export function supplyDirection(s,camera,viewport){
  const crate=s.supply,p=s.player;
  if(s.phase!=='wave'||!crate||crate.expiresAt<=s.time||viewport.width<=0||viewport.height<=0)return null;
  const dx=crate.x-p.x,dz=crate.z-p.z,dy=crate.y+.4-p.y-1.65;
  const right=dx*Math.cos(p.yaw)-dz*Math.sin(p.yaw),forward=-dx*Math.sin(p.yaw)-dz*Math.cos(p.yaw);
  const depth=forward*Math.cos(p.pitch)+dy*Math.sin(p.pitch),up=dy*Math.cos(p.pitch)-forward*Math.sin(p.pitch);
  const tangent=Math.tan(camera.fov*Math.PI/360),x=right/(tangent*camera.aspect),y=-up/tangent;
  if(depth>0&&Math.abs(x)<=depth*.9&&Math.abs(y)<=depth*.9&&visible(p,crate))return null;
  const screenY=depth<=0?Math.max(Math.abs(depth),Math.abs(y),1):y;
  const angle=Math.atan2(x,-screenY);
  const insetX=Math.min(HUD.pointerInset,viewport.width*.2),insetY=Math.min(HUD.pointerInset,viewport.height*.25);
  return {x:.5+Math.sin(angle)*(.5-insetX/viewport.width),y:.5-Math.cos(angle)*(.5-insetY/viewport.height),angle};
}

export function createHudAwareness(){
  let direction=null,damageUntil=0,critical=false,noticeUntil=0,soundAt=-Infinity;
  function read(s){
    const active=['build','wave'].includes(s.phase),p=s.player;
    const danger=active&&s.shelterIntegrity>0&&s.shelterIntegrity<HUD.criticalThreshold;
    const right=direction?direction.x*Math.cos(p.yaw)-direction.z*Math.sin(p.yaw):0;
    const forward=direction?-direction.x*Math.sin(p.yaw)-direction.z*Math.cos(p.yaw):0;
    return {damageAngle:active&&direction&&s.time<damageUntil?Math.atan2(right,forward):null,critical:danger,criticalNotice:danger&&s.time<noticeUntil};
  }
  return {
    hit(event,time){
      const d=event.direction;
      if(event.amount<=0||!d||!Number.isFinite(d.x)||!Number.isFinite(d.z)||Math.hypot(d.x,d.z)<1e-6)return;
      direction={x:d.x,z:d.z};damageUntil=time+HUD.damageLifetime;
    },
    update(s){
      const danger=['build','wave'].includes(s.phase)&&s.shelterIntegrity>0&&s.shelterIntegrity<HUD.criticalThreshold;
      let criticalSound=false;
      if(danger){
        if(!critical)noticeUntil=s.time+HUD.criticalNotice;
        if(s.time-soundAt>=HUD.criticalInterval){criticalSound=true;soundAt=s.time;noticeUntil=s.time+HUD.criticalNotice;}
      }else noticeUntil=0;
      critical=danger;return {...read(s),criticalSound};
    },
    read,
    reset(){direction=null;damageUntil=noticeUntil=0;critical=false;soundAt=-Infinity;}
  };
}
