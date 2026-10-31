import { DT, SITE, randomGenerator, updatePlayer } from './physics.js';
import { updateWeapons } from './combat.js';
import { updateEnemies } from './enemies.js';
import { unlock, interact, offer } from './economy.js';
import { placeTrap, triggerTraps } from './traps.js';
import { endlessWave } from './endlessWaves.js';
import { createRunStats, creditScrap } from './runStats.js';
export { getRunSummary } from './runStats.js';
import { updateSupply } from './supply.js';
import { createPreparationHold } from './preparation.js';
export function createSim(config, { seed = 1 } = {}) {
  const slots = ['pistol_makarov', 'shotgun_trench', 'smg_scorpion', 'flamethrower_torch', 'turret_sentry'];
  config = { ...config, weapons: slots.map(id => config.weapons.find(w => w.id === id)) };
  let s, events=[], previous={}, random, eliteRandom, queue=[], phaseTick=0, combatTick=0, nextId=1, runId=0, releaseAt=0;
  const emit=(type,payload)=>events.push({type,payload:{runId,tick:s.tick,elapsed:s.time,...structuredClone(payload)}});
  const preparationHold=createPreparationHold();let earlyCountdownAt=null;
  const waveDefinition=()=>config.waves[s.wave>10?8:s.wave-1];
  function schedule() {
    queue=[];
    const definition=s.wave>10?endlessWave(waveDefinition(),s.wave):waveDefinition();
    s.endlessScenario=definition.scenario??null;
    definition.spawns.forEach((g,index)=>{for(let k=0;k<g.count;k++) queue.push({at:g.delay+k*g.interval,index,k,spiderId:g.spiderId});});
    queue.sort((a,b)=>a.at-b.at||a.index-b.index||a.k-b.k);
  }
  function reset() {
    const bestTime=s?.bestTime||0; runId++; random=randomGenerator(seed); eliteRandom=randomGenerator(seed ^ 0x5eed); events=[]; previous={};phaseTick=0;combatTick=0;nextId=1;releaseAt=0;
    preparationHold.reset();earlyCountdownAt=null;
    s={phase:'build',subphase:'build',time:0,tick:0,wave:1,clearedWaves:0,kills:0,scrap:60,bestTime,shelterIntegrity:100,stats:createRunStats(),
      player:{x:4.8,z:5.8,y:0,vy:0,yaw:0,pitch:0,health:100,stamina:100,rest:0,contactSafe:0,running:false,dashTime:0,dashCooldown:0,dashX:0,dashZ:0},
      spiders:[],turrets:[],webs:[],boss:null,activeSlot:1,switchTime:0,shotSerial:0,hitSerial:0,reloadSerial:0,turretShotSerial:0,
      traps:[],trapStock:0,trapSerial:0,trapEffects:[],
      supply:null,supplyWave:0,supplyPickup:null,
      weapons:config.weapons.map(w=>({id:w.id,level:1,modification:null,unlocked:false,magazine:0,reserve:0,reload:0,cooldown:0})),
      lastAction:null,lastShot:null,warnings:[],remaining:config.waves[0].buildTime,startHold:0,result:null};
    unlock(s,config);schedule();
  }
  function spawn(q) {
    const d=config.spiders.find(x=>x.id===q.spiderId), sector=(s.wave+q.index+q.k)%Math.min(4,Math.ceil(s.wave/3)+1);
    const angle=sector*Math.PI/2+(random()-.5)*.8, radius=32+random()*4;
    const position={x:Math.sin(angle)*radius,y:0,z:Math.cos(angle)*radius};
    const health=d.health*(s.wave>10?1+.1*(s.wave-10):1);
    const e={id:nextId++,generation:runId,spiderId:d.id,...position,health,maxHealth:health,
      radius:Math.max(.55,d.scale*.65),height:Math.max(.65,d.scale*.65),yaw:0,state:'walk',timer:0,cooldown:0,spitCooldown:6,
      aggro:0,target:'shelter',enraged:false,lastSource:'player',attack:null};
    // Separate draws preserve spawn positions and weapon spread, including before wave 4.
    if(s.wave>=4&&eliteRandom()<.08) {e.elite=true;e.health*=2;e.maxHealth*=2;}
    s.spiders.push(e);
    emit('spider:spawn',{entity:{id:e.id,generation:e.generation},spiderId:e.spiderId,waveIndex:s.wave,spawnToken:`${runId}:${s.wave}:${q.index}:${q.k}`,position,...(e.elite?{elite:true}:{})});
  }
  function step(input={}) {
    if(s.phase==='victory'&&input.action==='endless') {
      s.wave=11;s.phase='build';s.subphase='build';s.result=null;phaseTick=combatTick=releaseAt=0;previous={};
      earlyCountdownAt=null;preparationHold.cancel(s);
      s.remaining=waveDefinition().buildTime;s.warnings=[];schedule();return;
    }
    if(s.phase==='victory'||s.phase==='defeat') return;
    s.tick++;s.time=s.tick*DT;s.bestTime=Math.max(s.bestTime,Math.floor(s.time));
    updatePlayer(s,input,previous);
    phaseTick++;
    const wave=waveDefinition();
    if(preparationHold.update(s,input)&&phaseTick*DT<wave.buildTime)earlyCountdownAt=phaseTick;
    if(s.phase==='build') {
      const elapsed=phaseTick*DT;
      const countdownAt=earlyCountdownAt===null?wave.buildTime:earlyCountdownAt*DT;
      s.subphase=elapsed+1e-9<countdownAt?'build':'countdown';
      if(s.subphase!=='build')s.startHold=0;
      s.remaining=Math.max(0,s.subphase==='build'?countdownAt-elapsed:earlyCountdownAt===null?wave.buildTime+wave.startDelay-elapsed:wave.startDelay-(phaseTick-earlyCountdownAt)*DT);
      if(elapsed+1e-9>=countdownAt+wave.startDelay) {
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
    if(input.KeyQ&&!previous.KeyQ) interact(s,'ammo',SITE);
    if(input.KeyU&&!previous.KeyU) interact(s,'upgrade',SITE);
    if(input.KeyZ&&!previous.KeyZ) interact(s,'mod_narrow',SITE);
    else if(input.KeyX&&!previous.KeyX) interact(s,'mod_wide',SITE);
    if(input.KeyT&&!previous.KeyT) interact(s,'trap',SITE);
    if(input.KeyG&&!previous.KeyG) placeTrap(s);
    s.trapEffects=s.trapEffects.filter(t=>t.until>s.time);
    if(s.phase==='wave') {triggerTraps(s);updateEnemies(s,config,emit);}
    for(const e of s.spiders.filter(e=>e.health<=0)) {
      const scrapDrop=config.spiders.find(d=>d.id===e.spiderId).scrapDrop*(e.elite?3:1);
      creditScrap(s,scrapDrop,e.lastSource);s.kills++;s.stats.kills[e.lastSource]++;
      emit('spider:death',{entity:{id:e.id,generation:e.generation},spiderId:e.spiderId,waveIndex:s.wave,scrapDrop,source:e.lastSource,position:{x:e.x,y:e.y,z:e.z}});
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
      else {s.wave++;s.phase='build';s.subphase='build';phaseTick=0;releaseAt=0;earlyCountdownAt=null;s.remaining=waveDefinition().buildTime;unlock(s,config);schedule();}
    }
    updateSupply(s,(combatTick-1)*DT);
    previous={...input};
  }
  reset();
  return {step,getState:()=>structuredClone({...s,interaction:offer(s)}),drainEvents:()=>{const e=events;events=[];return e;},restart:reset,cancelPreparationHold:()=>preparationHold.cancel(s)};
}
