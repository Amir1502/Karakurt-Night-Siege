import {BENCH,distance,visible} from '../sim/physics.js';
import {offer} from '../sim/economy.js';
import {HUD,HUD_LESSONS} from '../data/hud.js';
import {DT} from '../sim/physics.js';

export function getHudHints(s){
  const hints={offer:'',ammo:'',upgrade:'',trap:'',place:'',result:''};
  const action=s.lastAction;
  if(action&&s.tick>=action.tick&&(s.tick-action.tick)*DT<HUD.actionNotice){
    const done={repair:'Шалаш отремонтирован',ammo:'Патроны куплены',upgrade:'Оружие улучшено',trap:'Капкан куплен',build:'Турель установлена',buildBarricade:'Баррикада построена',repairBarricade:'Баррикада отремонтирована'};
    hints.result=action.ok?(action.kind==='placeTrap'?'Капкан установлен':`${done[action.kind]??'Покупка'} · −${action.cost}\u00a0деталей`):action.reason;
  }
  if(s.phase!=='build'||s.subphase!=='build')return hints;
  if(s.trapStock)hints.place=`G · Поставить капкан · запас ${s.trapStock}`;
  if(distance(s.player,BENCH)>2.5||!visible(s.player,BENCH)){
    hints.offer='Покупки у верстака справа от шалаша';return hints;
  }
  const quote=(key,action,label)=>`${key} · ${label} · ${offer(s,action).cost} деталей`;
  hints.offer=quote('E',s.activeSlot===5?'build':'repair',s.activeSlot===5?'Турель':'Ремонт');
  hints.ammo=quote('Q','ammo','Патроны');hints.trap=quote('T','trap','Капкан');
  if(s.activeSlot!==5)hints.upgrade=s.weapons[s.activeSlot-1].level===3?'Максимальный уровень III':quote('U','upgrade','Улучшить');
  return hints;
}

export function createHudGuide({enabled=true}={}){
  const shown=new Map(),completed=new Set();
  return {
    read(s){
      if(!enabled)return '';
      const action=s.lastAction;
      if(action?.ok)completed.add(action.kind);
      if(s.phase!=='build'||s.subphase!=='build')return '';
      const near=distance(s.player,BENCH)<=2.5&&visible(s.player,BENCH);
      if(!near)return '';
      for(const lesson of HUD_LESSONS){
        if(lesson.wave>s.wave||completed.has(lesson.action))continue;
        if(!shown.has(lesson.action))shown.set(lesson.action,s.time);
        if(s.time-shown.get(lesson.action)<HUD.guideDuration)return lesson.text;
        completed.add(lesson.action);
      }
      return '';
    }
  };
}
