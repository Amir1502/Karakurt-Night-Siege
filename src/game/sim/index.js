import { DT, SITE, randomGenerator, updatePlayer } from './physics.js';
import { updateWeapons } from './combat.js';
import { updateEnemies } from './enemies.js';
import { unlock, interact, offer } from './economy.js';
export function createSim(config, { seed = 1 } = {}) {
  const slots = ['pistol_makarov', 'shotgun_trench', 'smg_scorpion', 'flamethrower_torch', 'turret_sentry'];
  config = { ...config, weapons: slots.map(id => config.weapons.find(w => w.id === id)) };
  let s, events=[], previous={}, random, queue=[], phaseTick=0, combatTick=0, nextId=1, runId=0, releaseAt=0;
  const emit=(type,payload)=>events.push({type,payload:{runId,tick:s.tick,elapsed:s.time,...structuredClone(payload)}});
  function schedule() {
    queue=[];
    config.waves[s.wave-1].spawns.forEach((g,index)=>{for(let k=0;k<g.count;k++) queue.push({at:g.delay+k*g.interval,index,k,spiderId:g.spiderId});});
    queue.sort((a,b)=>a.at-b.at||a.index-b.index||a.k-b.k);
  }
  function reset() {
    const bestTime=s?.bestTime||0; runId++; random=randomGenerator(seed); events=[]; previous={};phaseTick=0;combatTick=0;nextId=1;releaseAt=0;
    s={phase:'build',subphase:'build',time:0,tick:0,wave:1,clearedWaves:0,kills:0,scrap:60,bestTime,shelterIntegrity:100,
      player:{x:4.8,z:5.8,y:0,vy:0,yaw:0,pitch:0,health:100,stamina:100,rest:0,contactSafe:0,running:false},
      spiders:[],turrets:[],webs:[],boss:null,activeSlot:1,switchTime:0,shotSerial:0,hitSerial:0,reloadSerial:0,turretShotSerial:0,
      weapons:config.weapons.map(w=>({id:w.id,unlocked:false,magazine:0,reserve:0,reload:0,cooldown:0})),
      lastAction:null,lastShot:null,warnings:[],remaining:config.waves[0].buildTime,result:null};
    unlock(s,config);schedule();
  }
  function spawn(q) {
    const d=config.spiders.find(x=>x.id===q.spiderId), sector=(s.wave+q.index+q.k)%Math.min(4,Math.ceil(s.wave/3)+1);
    const angle=sector*Math.PI/2+(random()-.5)*.8, radius=32+random()*4;
    const position={x:Math.sin(angle)*radius,y:0,z:Math.cos(angle)*radius};
    const e={id:nextId++,generation:runId,spiderId:d.id,...position,health:d.health,maxHealth:d.health,
      radius:Math.max(.55,d.scale*.65),height:Math.max(.65,d.scale*.65),yaw:0,state:'walk',timer:0,cooldown:0,spitCooldown:6,
      aggro:0,target:'shelter',enraged:false,lastSource:'player',attack:null};
    s.spiders.push(e);
    emit('spider:spawn',{entity:{id:e.id,generation:e.generation},spiderId:e.spiderId,waveIndex:s.wave,spawnToken:`${runId}:${s.wave}:${q.index}:${q.k}`,position});
  }
  function step(input={}) {
    if(s.phase==='victory'||s.phase==='defeat') return;
    s.tick++;s.time=s.tick*DT;s.bestTime=Math.max(s.bestTime,Math.floor(s.time));
    updatePlayer(s,input,previous);
    phaseTick++;
    const wave=config.waves[s.wave-1];
    if(s.phase==='build') {
      const elapsed=phaseTick*DT;
      s.subphase=elapsed+1e-9<wave.buildTime?'build':'countdown';
      s.remaining=Math.max(0,(s.subphase==='build'?wave.buildTime:wave.buildTime+wave.startDelay)-elapsed);
      if(elapsed+1e-9>=wave.buildTime+wave.startDelay) {
        s.phase='wave';s.subphase='combat';combatTick=0;
        emit('wave:start',{waveIndex:s.wave,plannedCount:queue.length});
      }
    }
    if(s.phase==='wave') {
      const elapsed=combatTick*DT;
      s.warnings=queue.filter(q=>q.at>elapsed&&q.at<=elapsed+2).slice(0,4).map(q=>({sector:(s.wave+q.index+q.k)%Math.min(4,Math.ceil(s.wave/3)+1),in:q.at-elapsed}));
      while(queue.length && queue[0].at<=elapsed+1e-9 && s.spiders.length<40 && elapsed>=releaseAt) {
        const q=queue.shift(); spawn(q); if(elapsed-q.at>.05) releaseAt=elapsed+.25;
      }
      combatTick++;
    }
    updateWeapons(s,config,input,previous,emit,random);
    if(input.KeyE&&!previous.KeyE) interact(s,input.action,SITE);
    if(s.phase==='wave') updateEnemies(s,config,emit);
    for(const e of s.spiders.filter(e=>e.health<=0)) {
      s.scrap=Math.min(999999,s.scrap+config.spiders.find(d=>d.id===e.spiderId).scrapDrop);s.kills++;
      emit('spider:death',{entity:{id:e.id,generation:e.generation},spiderId:e.spiderId,waveIndex:s.wave,scrapDrop:config.spiders.find(d=>d.id===e.spiderId).scrapDrop,source:e.lastSource,position:{x:e.x,y:e.y,z:e.z}});
    }
    s.spiders=s.spiders.filter(e=>e.health>0);
    const boss=s.spiders.find(e=>e.spiderId==='widow_queen');s.boss=boss?{id:boss.id,health:boss.health,maxHealth:boss.maxHealth,enraged:boss.enraged}:null;
    if(s.player.health<=0||s.shelterIntegrity<=0) {
      const reason=s.player.health<=0?(s.shelterIntegrity<=0?'both':'health'):'shelter';
      s.phase='defeat';s.result=reason;emit('run:lose',{reason,waveIndex:s.wave,clearedWaves:s.clearedWaves,kills:s.kills});
    } else if(s.phase==='wave'&&!queue.length&&!s.spiders.length) {
      s.clearedWaves=s.wave;s.player.health=Math.min(100,s.player.health+25);s.webs=[];
      emit('wave:clear',{waveIndex:s.wave,clearedWaves:s.clearedWaves});
      if(s.wave===10) {s.phase='victory';emit('run:win',{clearedWaves:10,kills:s.kills,health:s.player.health,shelterIntegrity:s.shelterIntegrity});}
      else {s.wave++;s.phase='build';s.subphase='build';phaseTick=0;releaseAt=0;s.remaining=config.waves[s.wave-1].buildTime;unlock(s,config);schedule();}
    }
    previous={...input};
  }
  reset();
  return {step,getState:()=>structuredClone({...s,interaction:offer(s)}),drainEvents:()=>{const e=events;events=[];return e;},restart:reset};
}
