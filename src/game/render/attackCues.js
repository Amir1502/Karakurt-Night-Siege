// Presentation derives from authoritative attack states, never from a second attack clock.
export function createAttackCues(){
  let previous=new Map();
  return {
    update(s){
      const marks=[],sounds=[],next=new Map();
      if(s.phase==='wave')for(const e of s.spiders){
        const key=`${e.generation}:${e.id}`;
        if(e.health<=0||e.stun>0||!e.attack)continue;
        next.set(key,e.state);
        if(e.spiderId==='tarantula_brute'&&e.state==='windup'&&previous.get(key)!=='windup')sounds.push('charge_windup');
        const charge=e.spiderId==='tarantula_brute'&&['windup','charge'].includes(e.state);
        const landing=e.spiderId==='jumper_wolf'&&['windup','jump'].includes(e.state);
        if(charge||landing){
          const fixed=e.state==='charge'&&Number.isFinite(e.attack.dx)&&Number.isFinite(e.attack.dz);
          const yaw=charge?Math.atan2(fixed?e.attack.dx:e.attack.x-e.x,fixed?e.attack.dz:e.attack.z-e.z):0;
          marks.push({id:key,kind:charge?'charge':'landing',x:charge?e.x:e.attack.x,z:charge?e.z:e.attack.z,targetX:e.attack.x,targetZ:e.attack.z,yaw,windup:e.state==='windup'});
        }
      }
      previous=next;return {marks,sounds};
    },
    reset(){previous.clear();}
  };
}
