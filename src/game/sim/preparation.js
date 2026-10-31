import {DT} from './physics.js';
import {PREPARATION} from '../data/preparation.js';

export function createPreparationHold(){
  let ticks=0,previous=false,armed=false;
  return {
    update(s,input){
      const pressed=Boolean(input.Enter||input.NumpadEnter),canStart=s.phase==='build'&&s.subphase==='build';
      if(!pressed){ticks=0;armed=false;}
      else if(!previous&&canStart)armed=true;
      if(!canStart){ticks=0;armed=false;}
      const start=canStart&&pressed&&armed&&(++ticks)*DT+1e-9>=PREPARATION.holdSeconds;
      if(start)armed=false;
      s.startHold=canStart&&pressed?Math.min(1,ticks*DT/PREPARATION.holdSeconds):0;
      previous=pressed;return start;
    },
    cancel(s){ticks=0;armed=false;previous=false;s.startHold=0;},
    reset(){ticks=0;armed=false;previous=false;}
  };
}
