import { NEST, NEST_POINTS } from '../data/nests.js';
import { creditScrap } from './runStats.js';
import { recordImpact } from './impacts.js';

export function damageNest(s,nest,amount){
  if(!nest||nest.health<=0||!Number.isFinite(amount)||amount<=0)return 0;
  const applied=Math.min(nest.health,amount);nest.health-=applied;s.hitSerial++;recordImpact(s,nest,applied,'player');return applied;
}

export function updateNest(s,combatElapsed,spawnBrood){
  if(s.phase!=='wave'){s.nest=null;return;}
  if(s.nest?.health<=0){
    const amount=creditScrap(s,NEST.reward,'nest');s.nestNotice={kind:'destroyed',time:s.time,amount,text:`Гнездо уничтожено · +${amount} деталей`};s.nest=null;return;
  }
  if(!s.nest&&s.wave>=NEST.firstWave&&s.nestWave!==s.wave&&combatElapsed+1e-9>=NEST.delay){
    const start=(s.wave-NEST.firstWave)%NEST_POINTS.length;
    const point=NEST_POINTS.map((_,i)=>NEST_POINTS[(start+i)%NEST_POINTS.length]).find(p=>Math.hypot(p.x-s.player.x,p.z-s.player.z)>NEST.radius+1&&!(s.spiders??[]).some(e=>Math.hypot(e.x-p.x,e.z-p.z)<NEST.radius+e.radius+.3));
    if(!point)return;
    s.nestWave=s.wave;s.nest={id:`nest:${s.wave}`,wave:s.wave,...point,y:0,health:NEST.health,maxHealth:NEST.health,radius:NEST.radius,height:NEST.height,aimHeight:NEST.aimHeight,emitted:0,nextSpawnAt:s.time+NEST.firstSpawn};
    s.nestNotice={kind:'spawned',time:s.time,text:'Паучье гнездо · Уничтожьте кокон, чтобы остановить выводок'};
  }
  const n=s.nest;if(!n||n.emitted>=NEST.maxBirths||s.time+1e-9<n.nextSpawnAt)return;
  if(s.spiders.filter(e=>e.health>0).length>=NEST.enemyLimit||s.spiders.filter(e=>e.health>0&&e.broodNest===n.id).length>=NEST.maxAlive)return;
  if(spawnBrood(n)===false)return;
  n.emitted++;n.nextSpawnAt=s.time+NEST.interval;
}
