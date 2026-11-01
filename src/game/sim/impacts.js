import { COMBAT_FEEL } from '../data/combatFeel.js';

export function recordImpact(s,target,amount,source){
  target.hitTime=s.time??0;target.hitAmount=amount;
  s.impacts??=[];s.impactSerial??=0;
  const prior=s.impacts.find(h=>h.target===target.id&&h.time===(s.time??0)&&h.source===source);
  if(prior)prior.amount+=amount;
  else {s.impacts.push({serial:++s.impactSerial,target:target.id,time:s.time??0,source,amount,x:target.x,y:(target.y??0)+(target.aimHeight??target.height),z:target.z});if(s.impacts.length>COMBAT_FEEL.impactLimit)s.impacts.shift();}
}
