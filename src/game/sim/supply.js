import {distance,visible} from './physics.js';
import {SUPPLY,SUPPLY_POINTS} from '../data/supply.js';
import {creditScrap} from './runStats.js';

export function updateSupply(s,combatElapsed){
  // The caller resolves deaths and wave/run completion first: a terminal tick never awards supplies.
  if(s.phase!=='wave'){s.supply=null;return;}
  if(s.wave>=SUPPLY.firstWave&&combatElapsed+1e-9>=SUPPLY.delay&&s.supplyWave!==s.wave){
    s.supplyWave=s.wave;
    const point=SUPPLY_POINTS[(s.wave-SUPPLY.firstWave)%SUPPLY_POINTS.length];
    s.supply={id:s.wave,...point,y:0,expiresAt:s.time+SUPPLY.lifetime};
  }
  const crate=s.supply;
  if(!crate)return;
  if(s.time+1e-9>=crate.expiresAt){s.supply=null;return;}
  if(distance(s.player,crate)<=SUPPLY.radius+1e-9&&s.player.y<=SUPPLY.maxPickupHeight&&visible(s.player,crate)){
    const amount=creditScrap(s,SUPPLY.scrap,'supply');
    s.supplyPickup={amount,time:s.time,wave:s.wave};s.supply=null;
  }
}
