import { createSim } from './game/sim/index.js';
import { loadConfig } from './game/data/loadConfig.js';
import { loadSave, writeSave } from './game/sim/save.js';
import { offer } from './game/sim/economy.js';
import { createWorld } from './game/world.js';
import { createAudio } from './game/audio.js';
import { loadProductionAssets, disposeProductionAssets } from './game/render/productionAssets.js';
import { interpolateState } from './game/render/interpolate.js';
import { createMouseFilter, clampSensitivity } from './game/input.js';
import { NIGHT_EVENTS } from './game/render/scenery.js';
import { createAttackCues } from './game/render/attackCues.js';
import { UPGRADE_LEVELS } from './game/data/upgrades.js';
import { getRunSummary } from './game/sim/runStats.js';
import { supplyDirection, createHudAwareness } from './game/render/hudAwareness.js';
import { getHudHints, createHudGuide } from './game/render/hudHints.js';
import { DASH } from './game/data/dash.js';
import { shotgunMod, SHOTGUN_MODS } from './game/data/weaponMods.js';
import { BENCH, distance, visible } from './game/sim/physics.js';

const SPIDER_INTRO={karakurt_spitter:'Плеватели: держитесь за укрытием',tarantula_brute:'Тараны: бьют по шалашу, стреляйте издалека',jumper_wolf:'Пауки-волки: прыгают, отходите в сторону',widow_queen:'Королева: стреляйте сзади — урон ×2'};

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
  save.bestEndless??=0;
  const audio=createAudio(null,bus,save.muted,{music:settings.music,sfx:settings.sfx});
  const attackCues=createAttackCues();
  const awareness=createHudAwareness();
  let guideAvailable=!save.bestTime&&!save.bestWave&&!save.kills,guide=createHudGuide({enabled:false});
  let viewport={width:innerWidth,height:innerHeight};
  let queenIntroduced=false;
  let state='loading',sim,config,assets=new Map(),keys={},mx=0,my=0,acc=0,last=0,raf,queuedPurchase=false,disposed=false;
  let current,previous,hitUntil=0,killUntil=0,bannerUntil=0,announcedNight=0,lastHit=0,soundShot=0,soundReload=0,damageUntil=0,shelterUntil=0,damage=0;
  const abort=new AbortController(),listen=(t,n,f)=>t.addEventListener(n,f,{signal:abort.signal});
  const start=$('.btn-start'),overlay=$('.overlay'),buy=$('#buy'),noFlash=$('#noflash');
  const endless=document.createElement('button');endless.id='continue-night';endless.type='button';endless.textContent='Продолжить ночь';endless.hidden=true;start.after(endless);
  const hitmark=$('.hud-hitmarker');hitmark.classList.add('hud-hitmark');hitmark.setAttribute('aria-hidden','true');
  const banner=document.createElement('div'),bannerTitle=document.createElement('strong'),bannerDetail=document.createElement('small');
  banner.id='wave-banner';banner.hidden=true;banner.setAttribute('role','status');banner.setAttribute('aria-live','polite');banner.setAttribute('aria-atomic','true');
  banner.append(bannerTitle,bannerDetail);$('.hud').append(banner);
  const ammoOffer=document.createElement('small');ammoOffer.id='ammo-offer';$('#offer').after(ammoOffer);
  const supplyHint=document.createElement('small');supplyHint.id='supply-hint';supplyHint.setAttribute('role','status');$('.hud-wave').append(supplyHint);
  const supplyPointer=document.createElement('div'),supplyArrow=document.createElement('span'),supplyDistance=document.createElement('small');
  supplyPointer.id='supply-pointer';supplyPointer.hidden=true;supplyPointer.setAttribute('role','img');supplyArrow.setAttribute('aria-hidden','true');supplyPointer.append(supplyArrow,supplyDistance);
  const damageDirection=document.createElement('div');damageDirection.id='damage-direction';damageDirection.hidden=true;damageDirection.setAttribute('role','img');
  const shelterAlert=document.createElement('div');shelterAlert.id='shelter-alert';shelterAlert.hidden=true;shelterAlert.setAttribute('role','status');shelterAlert.textContent='Шалаш на грани · Защитите подходы';
  $('.hud').append(supplyPointer,damageDirection,shelterAlert);
  const upgradeHint=document.createElement('small');upgradeHint.id='upgrade-offer';$('.hud-shelter').append(upgradeHint);
  const dashHint=document.createElement('small');dashHint.id='dash-state';$('#stamina').after(dashHint);
  const modHint=document.createElement('small');modHint.id='mod-offer';upgradeHint.after(modHint);
  const tacticalHelp=document.createElement('p');tacticalHelp.textContent='C + WASD · Рывок с земли: 30 выносливости, без неуязвимости. Дробовик у верстака: Z · узкая дробь, X · широкая дробь. 40 деталей, один вариант на забег.';$('#controls').append(tacticalHelp);
  const actionHint=document.createElement('small');actionHint.id='action-result';actionHint.setAttribute('role','status');$('.hud-shelter').append(actionHint);
  const results=document.createElement('section');results.id='run-results';results.hidden=true;results.setAttribute('aria-label','Итоги забега');
  const resultList=document.createElement('dl'),recommendation=document.createElement('p');recommendation.id='run-recommendation';
  const resultFields=[['waves','Отбито волн'],['time','Время забега'],['player','Убийства игроком'],['turret','Убийства турелью'],['trap','Убийства капканами'],['supplies','Подобрано ящиков'],['earned','Заработано деталей'],['spent','Потрачено деталей'],['playerDamage','Урон игроку, HP'],['shelterDamage','Суммарный урон шалашу, п.п.']];
  const resultValues=new Map(resultFields.map(([key,label])=>{const row=document.createElement('div'),term=document.createElement('dt'),value=document.createElement('dd');term.textContent=label;value.dataset.stat=key;row.append(term,value);resultList.append(row);return [key,value];}));
  results.append(resultList,recommendation);$('#message').after(results);
  const trapHint=document.createElement('small'),placeHint=document.createElement('small');
  trapHint.id='trap-offer';placeHint.id='trap-place';actionHint.before(trapHint,placeHint);
  const guideHint=document.createElement('small');guideHint.id='first-run-hint';guideHint.setAttribute('role','status');$('.hud-wave').append(guideHint);
  const startHint=document.createElement('small'),startProgress=document.createElement('progress');startHint.id='start-wave-hint';startProgress.id='start-wave-hold';startProgress.max=1;startProgress.value=0;startProgress.hidden=true;startProgress.setAttribute('aria-label','Удержание Enter для запуска отсчёта');$('.hud-wave').append(startHint,startProgress);
  const startHelp=document.createElement('p');startHelp.textContent='Enter · Удерживайте 1 секунду в подготовке, чтобы начать отсчёт. Отпустите, чтобы отменить удержание.';$('#controls').append(startHelp);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');noFlash.checked=reduced.matches;world.setNoFlash(noFlash.checked);
  listen(noFlash,'change',()=>world.setNoFlash(noFlash.checked));
  function text(id,value){const el=$(id),next=String(value);if(el.textContent!==next)el.textContent=next;}
  function showBanner(title,detail=''){bannerTitle.textContent=title;bannerDetail.textContent=detail;bannerDetail.hidden=!detail;bannerUntil=current.time+2.5;}
  function persist(){const result=writeSave(storage,save);if(!result.ok)text('#notice','Не удалось сохранить рекорд. Проверьте доступ к хранилищу браузера.');}
  function muted(){
    if(state==='running'&&!save.muted)audio.unlockFromGesture();audio.setMuted(save.muted);
    text('.btn-mute',save.muted?'M · Звук выкл':'M · Звук вкл');$('.btn-mute').setAttribute('aria-pressed',String(save.muted));persist();
  }
  function clear(){keys={};mx=my=acc=0;last=0;previous=current;}
  function panel(title,message,button){
    text('#title',title);text('#message',message);text('.btn-start',button);start.disabled=false;
    overlay.classList.remove('overlay--hidden');$('.hud').hidden=true;start.focus();
    endless.hidden=state!=='victory';
    const finished=['victory','defeat'].includes(state);results.hidden=!finished;$('#settings').hidden=finished;noFlash.closest('label').hidden=finished;
    $('#intro').hidden=['paused','victory','defeat'].includes(state);$('#controls').open=false;
  }
  function pause(){
    if(state!=='running')return;state='paused';clear();audio.suspend();document.exitPointerLock?.();
    sim.cancelPreparationHold();current=sim.getState();previous=current;
    panel('Ночь на паузе','Лагерь ждёт вашего возвращения. Таймеры остановлены.','Продолжить');
    const o=offer(current,'ammo');buy.hidden=!o.ok;buy.textContent=`Купить патроны за ${o.cost} и продолжить`;
  }
  async function lock(){
    try{await canvas.requestPointerLock();if(document.pointerLockElement===canvas)return true;}catch{}
    text('#notice','Не удалось захватить мышь. Нажмите «Продолжить» ещё раз.');queuedPurchase=false;return false;
  }
  async function resumeFromGesture(){
    const soundReady=audio.unlockFromGesture();if(!await lock()){await soundReady;audio.suspend();return false;}
    const soundOK=await soundReady;
    // Audio may unlock after the user has already released Pointer Lock.
    if(document.pointerLockElement!==canvas){queuedPurchase=false;audio.suspend();return false;}
    clear();state='running';text('#notice',soundOK?'':'Звук недоступен. Проверьте разрешение браузера.');
    overlay.classList.add('overlay--hidden');$('.hud').hidden=false;results.hidden=true;start.blur();buy.hidden=true;return true;
  }
  async function startNewRun(seed=1){
    if(!config||state==='loading'||state==='loaderror')return false;
    sim=createSim(config,{seed});current=sim.getState();previous=current;world.reset(seed);attackCues.reset();awareness.reset();queenIntroduced=false;clear();queuedPurchase=false;
    hitUntil=killUntil=bannerUntil=announcedNight=lastHit=soundShot=soundReload=damageUntil=shelterUntil=damage=0;
    guide=createHudGuide({enabled:guideAvailable});
    const started=await resumeFromGesture();if(started)guideAvailable=false;return started;
  }
  async function continueNightFromGesture(){
    if(state!=='victory'||endless.disabled)return false;endless.disabled=start.disabled=true;
    try {
      if(!await resumeFromGesture())return false;
      sim.step({action:'endless'});current=sim.getState();previous=current;endless.hidden=true;
      showBanner('Бесконечная ночь',`Волна ${current.wave} · Стая становится сильнее`);return true;
    } finally {endless.disabled=start.disabled=false;}
  }
  listen(start,'click',()=>state==='loaderror'?prepareAssets():state==='paused'?resumeFromGesture():startNewRun());
  listen(endless,'click',continueNightFromGesture);
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
    if(e.code==='Enter'||e.code==='NumpadEnter')e.preventDefault();
    if(e.repeat&&!['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight'].includes(e.code))return;
    keys[e.code]=true;if(e.code==='Space')e.preventDefault();
  });
  listen(window,'keyup',e=>{keys[e.code]=false;});
  listen(canvas,'mousedown',e=>{if(state==='running'&&e.button===0)keys.fire=true;});listen(window,'mouseup',()=>{keys.fire=false;});
  // Spike-filtered, sensitivity-scaled mouse look (see src/game/input.js).
  listen(document,'mousemove',e=>{if(state!=='running'||document.pointerLockElement!==canvas)return;
    const d=mouse.accept(e.movementX,e.movementY,performance.now(),settings.sensitivity);if(d){mx+=d[0];my+=d[1];}});
  listen(window,'resize',()=>{viewport={width:innerWidth,height:innerHeight};world.resize(innerWidth,innerHeight,devicePixelRatio);});
  bus.on('player:damage',e=>{damage=current.time<damageUntil?damage+e.amount:e.amount;damageUntil=current.time+1;world.shake(e.amount);awareness.hit(e,current.time);});
  bus.on('shelter:damage',()=>{shelterUntil=current.time+1.5;});
  bus.on('spider:spawn',e=>{
    if(e.spiderId==='widow_queen'&&!queenIntroduced){queenIntroduced=true;showBanner(`Волна ${e.waveIndex} · Королева вдов`,'Обойдите сзади · Урон ×2');}
  });
  bus.on('spider:death',e=>{if(e.source==='player')killUntil=current.time+(noFlash.checked?.5:.2);save.kills++;save.bestTime=Math.max(save.bestTime,current.bestTime);persist();});
  bus.on('wave:start',e=>{
    const seen=new Set(config.waves.slice(0,e.waveIndex-1).flatMap(w=>w.spawns.map(g=>g.spiderId)));
    const incoming=[...new Set((config.waves[e.waveIndex-1]?.spawns??[]).map(g=>g.spiderId))];
    const intro=incoming.filter(id=>!seen.has(id)).map(id=>SPIDER_INTRO[id]);
    showBanner(`Волна ${e.waveIndex}`,[NIGHT_EVENTS[e.waveIndex],...intro].filter(Boolean).join(' · '));
  });
  bus.on('wave:clear',e=>{
    showBanner(`Волна ${e.waveIndex} отбита · +25 здоровья`);save.bestWave=Math.max(save.bestWave,Math.min(10,current.clearedWaves));
    if(current.clearedWaves>10)save.bestEndless=Math.max(save.bestEndless,current.clearedWaves);persist();record();
  });
  const result=await loadConfig();config=result.config;sim=createSim(config);current=sim.getState();previous=current;
  const labels=['ПМ','Дробовик','Скорпион','Факел','Турель'];
  const slots=labels.map((label,i)=>{const el=document.createElement('li'),key=document.createElement('span'),name=document.createElement('span');el.className='hud-weapon-slot';key.textContent=String(i+1);name.textContent=label;el.append(key,name);$('.hud-weapon-list').append(el);return el;});
  // Русское склонение: 1 волна, 2 волны, 5 волн; 11–14 всегда «много».
  const plural=(n,one,few,many)=>{const m10=n%10,m100=n%100;return `${n} ${m10===1&&m100!==11?one:m10>=2&&m10<=4&&(m100<12||m100>14)?few:many}`;};
  function record(){text('#record',(save.bestWave?`Рекорд: ${plural(save.bestWave,'волна','волны','волн')} · ${plural(save.kills,'паук','паука','пауков')}`:'Рука цела. Шалаш под вопросом.')+(save.bestEndless?` · Бесконечная ночь: ${plural(save.bestEndless,'волна','волны','волн')}`:''));}
  record();
  function draw(s){
    if(s.shotSerial!==soundShot){soundShot=s.shotSerial;audio.play('shot',s.activeSlot);}
    audio.setIntensity(state==='running'&&s.phase!=='build');
    if(s.reloadSerial!==soundReload){soundReload=s.reloadSerial;audio.play('reload');}
    if(s.hitSerial!==lastHit){lastHit=s.hitSerial;audio.play('hit');hitUntil=s.time+(noFlash.checked?.5:.12);}
    text('#health',Math.ceil(s.player.health));$('#healthbar').value=s.player.health;text('#stamina',`Выносливость ${Math.floor(s.player.stamina)}`);
    text('#dash-state',s.player.dashTime>0?'Рывок':s.player.dashCooldown>0?`C · Рывок через ${s.player.dashCooldown.toFixed(1)} с`:s.player.stamina<DASH.cost?`C · Нужно ${DASH.cost} выносливости`:s.player.y>0?'C · Рывок после приземления':`C + WASD · Рывок · ${DASH.cost}`);
    text('#damage',s.time<damageUntil?`Урон: −${Math.ceil(damage)} HP`:'');
    text('#shelter',s.shelterIntegrity>0&&s.shelterIntegrity<1?'<1':Math.floor(s.shelterIntegrity));$('#shelterbar').value=s.shelterIntegrity;
    text('#shelter-status',s.shelterIntegrity<30?'Шалаш на грани':s.time<shelterUntil?'Шалаш под атакой':s.shelterIntegrity<70?'Повреждён':'');
    text('#scrap',`Детали: ${s.scrap}`);
    const hints=getHudHints(s);
    for(const [id,key] of [['#offer','offer'],['#ammo-offer','ammo'],['#upgrade-offer','upgrade'],['#trap-offer','trap'],['#trap-place','place'],['#action-result','result']]){
      text(id,hints[key]);$(id).hidden=!hints[key];
    }
    const lesson=guide.read(s);text('#first-run-hint',lesson);guideHint.hidden=!lesson;
    startHint.hidden=s.phase!=='build'||s.subphase!=='build';
    if(!startHint.hidden)text('#start-wave-hint',s.startHold>0?'Удерживайте Enter · Запуск отсчёта':'Готовы? Удерживайте Enter 1 с · Начать отсчёт');
    startProgress.hidden=startHint.hidden||!s.startHold;startProgress.value=s.startHold;
    text('#wave',`Волна ${s.wave}${s.wave>10?' · ∞':' / 10'}`);text('#phase',s.phase==='build'?`${s.subphase==='build'?'Подготовка':'До атаки'}: ${Math.ceil(s.remaining)} с`:`Пауков: ${s.spiders.length}`);
    text('#warning',s.phase==='build'&&s.endlessScenario?`${s.endlessScenario.name} · ${s.endlessScenario.hint}`:s.boss?`Королева: ${Math.ceil(s.boss.health)} HP`:s.warnings.length?'Приближаются: '+s.warnings.map(w=>['С','В','Ю','З'][w.sector]).join(' · '):'');
    const supply=s.supply,pickup=s.supplyPickup;
    text('#supply-hint',supply?`Припасы · ${Math.ceil(Math.hypot(supply.x-s.player.x,supply.z-s.player.z))} м · осталось ${Math.ceil(Math.max(0,supply.expiresAt-s.time))} с`:pickup&&s.time-pickup.time<2?`+${pickup.amount} деталей`:'');
    const a=s.weapons[s.activeSlot-1],level=UPGRADE_LEVELS[a.level-1],mod=shotgunMod(a.modification);text('#ammo',`${a.magazine} / ${a.reserve}`);text('#weapon',s.activeSlot===5?'Комплект турели':`${labels[s.activeSlot-1]} · ${level.label}${mod?` · ${mod.label}`:''}${a.reload>0?' · Перезарядка…':''}`);
    modHint.hidden=s.activeSlot!==2||s.phase!=='build'||s.subphase!=='build'||Boolean(mod)||distance(s.player,BENCH)>2.5||!visible(s.player,BENCH);
    if(!modHint.hidden)text('#mod-offer',`Z · Узкая дробь\nX · Широкая дробь\n${SHOTGUN_MODS.mod_narrow.cost} деталей · один выбор`);
    slots.forEach((el,i)=>{el.classList.toggle('hud-weapon-slot--active',s.activeSlot===i+1);el.setAttribute('aria-disabled',String(!s.weapons[i].unlocked));});
    hitmark.hidden=s.time>=Math.max(hitUntil,killUntil);hitmark.dataset.kill=String(s.time<killUntil);
    if(s.phase==='build'&&NIGHT_EVENTS[s.wave]&&announcedNight!==s.wave&&s.time>=bannerUntil){announcedNight=s.wave;showBanner(NIGHT_EVENTS[s.wave],`Событие ночи · Волна ${s.wave}`);}
    banner.hidden=s.time>=bannerUntil;
  }
  function drawAwareness(s){
    const pointer=supplyDirection(s,world.getCamera(),viewport),signals=awareness.read(s);
    supplyPointer.hidden=!pointer;
    if(pointer){
      supplyPointer.style.left=`${pointer.x*100}%`;supplyPointer.style.top=`${pointer.y*100}%`;supplyArrow.style.transform=`rotate(${pointer.angle}rad)`;
      const metres=Math.ceil(Math.hypot(s.supply.x-s.player.x,s.supply.z-s.player.z));
      supplyPointer.setAttribute('aria-label',`Направление к припасам · ${metres} м`);supplyDistance.textContent=`Припасы · ${metres} м`;
    }
    damageDirection.hidden=signals.damageAngle===null;
    if(!damageDirection.hidden){
      damageDirection.style.transform=`translate(-50%,-50%) rotate(${signals.damageAngle}rad)`;
      damageDirection.setAttribute('aria-label','Направление полученного урона');
    }
    $('.hud-shelter').dataset.critical=String(signals.critical);shelterAlert.hidden=!signals.criticalNotice;
  }
  function finish(s){
    state=s.phase;save.bestWave=Math.max(save.bestWave,Math.min(10,s.clearedWaves));save.bestTime=Math.max(save.bestTime,s.bestTime);persist();record();
    clear();document.exitPointerLock?.();
    const reason={shelter:'Шалаш разрушен.',health:'Защитник погиб.',both:'Защитник погиб, шалаш разрушен.'}[s.result]??`Шалаш: ${Math.ceil(s.shelterIntegrity)}%.`;
    const summary=getRunSummary(s),number=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1});
    const values={waves:summary.clearedWaves,time:`${Math.floor(summary.time/60)}:${String(Math.floor(summary.time%60)).padStart(2,'0')}`,...summary.kills,supplies:summary.suppliesCollected,earned:summary.scrapEarned,spent:summary.scrapSpent,playerDamage:summary.playerDamage,shelterDamage:summary.shelterDamage};
    for(const [key,value] of Object.entries(values))resultValues.get(key).textContent=typeof value==='number'?number.format(value):value;
    recommendation.textContent=summary.recommendation;
    panel(s.phase==='victory'?'Рассвет. Вы выжили.':'Ночь не пережита',reason+(save.bestEndless?` Рекорд бесконечной ночи: ${plural(save.bestEndless,'волна','волны','волн')}.`:''),'Повторить ночь');
    const title=$('#title');title.tabIndex=-1;title.focus();overlay.firstElementChild.scrollTop=0;
  }
  function frame(now){
    if(disposed)return;const dt=last?Math.min(.1,(now-last)/1000):0;last=now;
    if(state==='running'){
      acc+=dt;
      while(acc>=1/60){
        const input={...keys,movementX:mx,movementY:my};mx=my=0;
        if(queuedPurchase){input.KeyE=true;input.action='ammo';queuedPurchase=false;}
        previous=current;sim.step(input);current=sim.getState();acc-=1/60;
        attackCues.update(current).sounds.forEach(cue=>audio.play(cue));
        sim.drainEvents().forEach(e=>bus.emit(e.type,e.payload));bus.flush();
        if(awareness.update(current).criticalSound)audio.play('shelter_critical');
        if(['victory','defeat'].includes(current.phase)){finish(current);break;}
      }
    }
    draw(current);
    const view=interpolateState(previous,current,state==='running'?acc*60:1,mx,my);
    drawAwareness(view);
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
  return {startNewRun,pause,resumeFromGesture,dispose(){disposed=true;audio.dispose();abort.abort();cancelAnimationFrame(raf);world.dispose();disposeProductionAssets(assets);banner.remove();endless.remove();ammoOffer.remove();supplyHint.remove();supplyPointer.remove();damageDirection.remove();shelterAlert.remove();guideHint.remove();startHint.remove();startProgress.remove();startHelp.remove();upgradeHint.remove();trapHint.remove();placeHint.remove();actionHint.remove();results.remove();bus.clear();}};
}
