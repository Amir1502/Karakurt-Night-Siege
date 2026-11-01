import { RECOIL } from '../data/combatFeel.js';

const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
const window=(p,a,b,c,d)=>smooth((p-a)/(b-a))*(1-smooth((p-c)/(d-c)));

export function recoilPose(slot,age){
  const r=RECOIL[slot-1],decay=age>=0&&age<1?Math.exp(-age*r.recovery):0;
  return {z:r.kick*decay,pitch:r.pitch*decay};
}

export function weaponPose(slot,progress,shotAge){
  const p=clamp(progress),out=window(p,.08,.25,.67,.95),seat=window(p,.72,.78,.84,.94);
  const pump=window(shotAge,.075,.13,.22,.34);
  const pose={hand:[0,0,0],magazine:[0,0,0],slide:0,valve:0,tilt:out*.17};
  if(!out&&!pump)return pose;
  if(slot===1||slot===3){
    pose.hand=[-.055*out,-.07*out,.065*out];
    pose.magazine=[-.025*out,0,-.18*out];
    pose.slide=-.045*seat;
  } else if(slot===2){
    const load=out*Math.sin(p*Math.PI*6)**2;
    pose.hand=[-.055*out,-.04*out,.09*load+.1*pump];pose.slide=-.12*pump;
  } else if(slot===4){
    pose.hand=[-.055*out,.015*out,.07*out];pose.valve=out*Math.sin(p*Math.PI*4)*.55;
  }
  return pose;
}

export function createWeaponMotion(view,slot){
  const names=['hand_l','magazine','slide'],nodes=names.map(n=>view.root.getObjectByName(n));
  const bind=nodes.map(n=>n?{p:n.position.clone(),q:n.quaternion.clone()}:null);
  let saved=null,duration=0,serial=-1;
  function restore(){if(!saved)return;nodes.forEach((n,i)=>{if(n){n.position.copy(saved[i].p);n.quaternion.copy(saved[i].q);}});saved=null;}
  return {
    restore,
    apply(s){
      const ammo=s.weapons[slot-1];if(s.reloadSerial!==serial){serial=s.reloadSerial;duration=ammo.reload;}
      const progress=ammo.reload>0&&duration>0?1-ammo.reload/duration:0;
      const age=s.lastShot?.slot===slot?s.time-s.lastShot.time:100,pose=weaponPose(slot,progress,age);
      saved=nodes.map(n=>n?{p:n.position.clone(),q:n.quaternion.clone()}:null);
      // These assets share a magazine-style reload clip. Pump/tank weapons must not eject that part.
      if(ammo.reload>0&&slot>=2&&slot!==3){nodes.forEach((n,i)=>{if(n){n.position.copy(bind[i].p);n.quaternion.copy(bind[i].q);}});}
      if(nodes[0])nodes[0].position.add({x:pose.hand[0],y:pose.hand[1],z:pose.hand[2]});
      if(nodes[1]&&(slot===1||slot===3))nodes[1].position.add({x:pose.magazine[0],y:pose.magazine[1],z:pose.magazine[2]});
      if(nodes[2]){nodes[2].position.y+=pose.slide;nodes[2].rotateY(pose.valve);}
      return pose;
    },
    reset(){restore();serial=-1;duration=0;},
  };
}
