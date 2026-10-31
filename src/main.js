import { createSim } from './game/sim/index.js';
import { loadConfig } from './game/data/loadConfig.js';
import { loadSave, writeSave } from './game/sim/save.js';
import { offer } from './game/sim/economy.js';
import { createWorld } from './game/world.js';
import { createAudio } from './game/audio.js';
import { loadProductionAssets, disposeProductionAssets } from './game/render/productionAssets.js';
import { interpolateState } from './game/render/interpolate.js';
import { createMouseFilter, clampSensitivity } from './game/input.js';

// Player preferences live under their own key: the progress save has a strict field set.
export const SETTINGS_KEY='svh3d.settings.v1';
export function loadSettings(storage){
  let raw={};try{raw=JSON.parse(storage?.getItem(SETTINGS_KEY)??'{}')||{};}catch{}
  const unit=(v,d)=>{const n=Number(v);return v!==null&&v!==undefined&&Number.isFinite(n)?Math.min(1,Math.max(0,n)):d;};
  return {sensitivity:clampSensitivity(raw.sensitivity??1),music:unit(raw.music,.5),sfx:unit(raw.sfx,.8)};
}

export function createEventBus(){
  const listeners=new Map(),queue=[];
  return {on(n,f){if(!listeners.has(n))listeners.set(n,new Set());listeners.get(n).add(f);return()=>listeners.get(n).delete(f);},
    emit(n,p){queue.push([n,structuredClone(p)]);},flush(){while(queue.length){const [n,p]=queue.shift();listeners.get(n)?.forEach(f=>f(p));}},clear(){queue.length=0;}};
}
export async function boot(root){
  const $=s=>root.querySelector(s),canvas=$('#game3d'),world=createWorld(canvas),bus=createEventBus();
  let storage;try{storage=localStorage;}catch{}
  const save=loadSave(storage),settings=loadSettings(storage),mouse=createMouseFilter();
  const audio=createAudio(null,bus,save.muted,{music:settings.music,sfx:settings.sfx});
  let state='loading',sim,config,assets=new Map(),keys={},mx=0,my=0,acc=0,last=0,raf,queuedPurchase=false,disposed=false;
  let current,previous,hitUntil=0,lastHit=0,soundShot=0,soundReload=0,damageUntil=0,shelterUntil=0,damage=0;
  const abort=new AbortController(),listen=(t,n,f)=>t.addEventListener(n,f,{signal:abort.signal});
  const start=$('.btn-start'),overlay=$('.overlay'),buy=$('#buy'),noFlash=$('#noflash');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');noFlash.checked=reduced.matches;world.setNoFlash(noFlash.checked);
  listen(noFlash,'change',()=>world.setNoFlash(noFlash.checked));
  function text(id,value){const el=$(id),next=String(value);if(el.textContent!==next)el.textContent=next;}
  function persist(){writeSave(storage,save);}
  function muted(){
    if(state==='running'&&!save.muted)audio.unlockFromGesture();audio.setMuted(save.muted);
    text('.btn-mute',save.muted?'M · Звук выкл':'M · Звук вкл');$('.btn-mute').setAttribute('aria-pressed',String(save.muted));persist();
  }
  function clear(){keys={};mx=my=acc=0;last=0;previous=current;}
  function panel(title,message,button){
    text('#title',title);text('#message',message);text('.btn-start',button);start.disabled=false;
    overlay.classList.remove('overlay--hidden');$('.hud').hidden=true;start.focus();
    $('#intro').hidden=['paused','victory','defeat'].includes(state);$('#controls').open=false;
  }
  function pause(){
    if(state!=='running')return;state='paused';clear();audio.suspend();document.exitPointerLock?.();
    panel('Ночь на паузе','Лагерь ждёт вашего возвращения. Таймеры остановлены.','Продолжить');
    const o=offer(current,'ammo');buy.hidden=!o.ok;buy.textContent=`Купить патроны за ${o.cost} и продолжить`;
  }
  async function lock(){
    try{await canvas.requestPointerLock();if(document.pointerLockElement===canvas)return true;}catch{}
    text('#notice','Не удалось захватить мышь. Нажмите «Продолжить» ещё раз.');queuedPurchase=false;return false;
  }
  async function resumeFromGesture(){
    const soundReady=audio.unlockFromGesture();if(!await lock()){await soundReady;audio.suspend();return false;}
    const soundOK=await soundReady;clear();state='running';text('#notice',soundOK?'':'Звук недоступен. Проверьте разрешение браузера.');
    overlay.classList.add('overlay--hidden');$('.hud').hidden=false;start.blur();buy.hidden=true;return true;
  }
  async function startNewRun(seed=1){
    if(!config||state==='loading'||state==='loaderror')return false;
    sim=createSim(config,{seed});current=sim.getState();previous=current;world.reset(seed);clear();queuedPurchase=false;
    hitUntil=lastHit=soundShot=soundReload=damageUntil=shelterUntil=damage=0;
    return resumeFromGesture();
  }
  listen(start,'click',()=>state==='loaderror'?prepareAssets():state==='paused'?resumeFromGesture():startNewRun());
  listen(buy,'click',()=>{queuedPurchase=true;resumeFromGesture();});
  listen($('.btn-mute'),'click',()=>{save.muted=!save.muted;muted();});muted();
  // Chrome may report a bogus movement burst right after the lock changes: settle the filter.
  listen(document,'pointerlockchange',()=>{mouse.reset(performance.now());if(document.pointerLockElement!==canvas)pause();});
  const sliders={sensitivity:[$('#sens'),v=>`${v.toFixed(2)}×`],music:[$('#music'),v=>`${Math.round(v*100)}%`],sfx:[$('#sfx'),v=>`${Math.round(v*100)}%`]};
  for(const [key,[input,format]] of Object.entries(sliders)){
    if(!input)continue;input.value=String(settings[key]);text(`#${input.id}-value`,format(settings[key]));
    listen(input,'input',()=>{
      settings[key]=key==='sensitivity'?clampSensitivity(input.value):Math.min(1,Math.max(0,Number(input.value)||0));
      text(`#${input.id}-value`,format(settings[key]));
      if(key==='music')audio.setMusicVolume(settings.music);if(key==='sfx')audio.setSfxVolume(settings.sfx);
      try{storage?.setItem(SETTINGS_KEY,JSON.stringify(settings));}catch{}
    });
  }
  listen(document,'pointerlockerror',()=>{text('#notice','Браузер не разрешил захват мыши. Нажмите кнопку ещё раз.');queuedPurchase=false;});
  listen(window,'blur',pause);listen(document,'visibilitychange',()=>{if(document.hidden)pause();});
  listen(window,'keydown',e=>{
    if(e.target.matches('input,select,textarea,[contenteditable]'))return;
    if(e.code==='KeyM'&&!e.repeat){save.muted=!save.muted;muted();}
    if(state!=='running')return;if(e.code==='Escape'){pause();return;}
    if(e.repeat&&!['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight'].includes(e.code))return;
    keys[e.code]=true;if(e.code==='Space')e.preventDefault();
  });
  listen(window,'keyup',e=>{keys[e.code]=false;});
  listen(canvas,'mousedown',e=>{if(state==='running'&&e.button===0)keys.fire=true;});listen(window,'mouseup',()=>{keys.fire=false;});
  // Spike-filtered, sensitivity-scaled mouse look (see src/game/input.js).
  listen(document,'mousemove',e=>{if(state!=='running'||document.pointerLockElement!==canvas)return;
    const d=mouse.accept(e.movementX,e.movementY,performance.now(),settings.sensitivity);if(d){mx+=d[0];my+=d[1];}});
  listen(window,'resize',()=>world.resize(innerWidth,innerHeight,devicePixelRatio));
  bus.on('player:damage',e=>{damage=current.time<damageUntil?damage+e.amount:e.amount;damageUntil=current.time+1;});
  bus.on('shelter:damage',()=>{shelterUntil=current.time+1.5;});
  bus.on('spider:death',()=>{save.kills++;save.bestTime=Math.max(save.bestTime,current.bestTime);persist();});
  bus.on('wave:clear',()=>{save.bestWave=Math.max(save.bestWave,current.clearedWaves);persist();});
  const result=await loadConfig();config=result.config;sim=createSim(config);current=sim.getState();previous=current;
  const labels=['ПМ','Дробовик','Скорпион','Факел','Турель'];
  const slots=labels.map((label,i)=>{const el=document.createElement('li');el.className='hud-weapon-slot';el.textContent=`${i+1} · ${label}`;$('.hud-weapon-list').append(el);return el;});
  // Русское склонение: 1 волна, 2 волны, 5 волн; 11–14 всегда «много».
  const plural=(n,one,few,many)=>{const m10=n%10,m100=n%100;return `${n} ${m10===1&&m100!==11?one:m10>=2&&m10<=4&&(m100<12||m100>14)?few:many}`;};
  text('#record',save.bestWave?`Рекорд: ${plural(save.bestWave,'волна','волны','волн')} · ${plural(save.kills,'паук','паука','пауков')}`:'Рука цела. Шалаш под вопросом.');
  function draw(s){
    if(s.shotSerial!==soundShot){soundShot=s.shotSerial;audio.play('shot',s.activeSlot);}
    audio.setIntensity(state==='running'&&s.phase!=='build');
    if(s.reloadSerial!==soundReload){soundReload=s.reloadSerial;audio.play('reload');}
    if(s.hitSerial!==lastHit){lastHit=s.hitSerial;audio.play('hit');hitUntil=s.time+(noFlash.checked?.5:.12);}
    text('#health',Math.ceil(s.player.health));$('#healthbar').value=s.player.health;text('#stamina',`Выносливость ${Math.floor(s.player.stamina)}`);
    text('#damage',s.time<damageUntil?`Урон: −${Math.ceil(damage)} HP`:'');
    text('#shelter',s.shelterIntegrity>0&&s.shelterIntegrity<1?'<1':Math.floor(s.shelterIntegrity));$('#shelterbar').value=s.shelterIntegrity;
    text('#shelter-status',s.time<shelterUntil?'Шалаш под атакой':s.shelterIntegrity<30?'Критическое состояние':s.shelterIntegrity<70?'Повреждён':'');
    text('#scrap',`Детали: ${s.scrap}`);
    text('#offer',s.interaction.ok?`E · ${s.interaction.kind==='build'?'Турель':'Ремонт'} за ${s.interaction.cost}`:s.interaction.reason);
    text('#wave',`Волна ${s.wave} / 10`);text('#phase',s.phase==='build'?`${s.subphase==='build'?'Подготовка':'До атаки'}: ${Math.ceil(s.remaining)} с`:`Пауков: ${s.spiders.length}`);
    text('#warning',s.boss?`Королева: ${Math.ceil(s.boss.health)} HP`:s.warnings.length?'Приближаются: '+s.warnings.map(w=>['С','В','Ю','З'][w.sector]).join(' · '):'');
    const a=s.weapons[s.activeSlot-1];text('#ammo',`${a.magazine} / ${a.reserve}`);text('#weapon',a.reload>0?'Перезарядка…':s.activeSlot===5?'Комплект · E для установки':`${labels[s.activeSlot-1]} · R перезарядка`);
    slots.forEach((el,i)=>{el.classList.toggle('hud-weapon-slot--active',s.activeSlot===i+1);el.setAttribute('aria-disabled',String(!s.weapons[i].unlocked));});
    $('.hud-hitmarker').hidden=s.time>=hitUntil;
  }
  function finish(s){
    state=s.phase;save.bestWave=Math.max(save.bestWave,s.clearedWaves);save.bestTime=Math.max(save.bestTime,s.bestTime);persist();
    clear();document.exitPointerLock?.();
    const reason={shelter:'Шалаш разрушен.',health:'Защитник погиб.',both:'Защитник погиб, шалаш разрушен.'}[s.result]??`Шалаш: ${Math.ceil(s.shelterIntegrity)}%.`;
    const minutes=Math.floor(s.time/60),seconds=String(Math.floor(s.time%60)).padStart(2,'0');
    panel(s.phase==='victory'?'Рассвет. Вы выжили.':'Ночь не пережита',`${reason} Волн: ${s.clearedWaves}. Пауков: ${s.kills}. Время: ${minutes}:${seconds}.`,'Повторить ночь');
  }
  function frame(now){
    if(disposed)return;const dt=last?Math.min(.1,(now-last)/1000):0;last=now;
    if(state==='running'){
      acc+=dt;
      while(acc>=1/60){
        const input={...keys,movementX:mx,movementY:my};mx=my=0;
        if(queuedPurchase){input.KeyE=true;input.action='ammo';queuedPurchase=false;}
        previous=current;sim.step(input);current=sim.getState();acc-=1/60;
        sim.drainEvents().forEach(e=>bus.emit(e.type,e.payload));bus.flush();
        if(['victory','defeat'].includes(current.phase)){finish(current);break;}
      }
    }
    draw(current);
    const view=interpolateState(previous,current,state==='running'?acc*60:1,mx,my);
    if(['ready','loading','loaderror'].includes(state))view.player={...view.player,x:10,y:1.5,z:15,yaw:.85,pitch:-.13};
    world.render(acc*60,{...view,definitions:config.spiders,visualDelta:state==='victory'?dt:0});raf=requestAnimationFrame(frame);
  }
  raf=requestAnimationFrame(frame);
  async function prepareAssets(){
    state='loading';start.disabled=true;text('#message','Подготавливаем лагерь, оружие и пауков…');text('.btn-start','Загрузка…');
    const failed=[];const loaded=await loadProductionAssets(p=>{if(!p.ok)failed.push(`${p.id}: ${p.error}`);});
    if(disposed){disposeProductionAssets(loaded);return;}
    if(failed.length){disposeProductionAssets(loaded);state='loaderror';panel('Лагерь не загрузился',failed.join('\n'),'Повторить загрузку');return;}
    world.install(loaded);disposeProductionAssets(assets);assets=loaded;state='ready';
    panel('Ночь каракурта','Дюны шевелятся. До рассвета десять волн.','Начать ночь');
    if(!matchMedia('(pointer:fine)').matches||!canvas.requestPointerLock){start.disabled=true;text('#message','Для игры нужен ПК с мышью и поддержкой Pointer Lock.');}
  }
  await prepareAssets();
  return {startNewRun,pause,resumeFromGesture,dispose(){disposed=true;audio.dispose();abort.abort();cancelAnimationFrame(raf);world.dispose();disposeProductionAssets(assets);bus.clear();}};
}
