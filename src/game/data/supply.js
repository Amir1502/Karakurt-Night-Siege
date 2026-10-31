// Supply rules are separate from the strict v1 configuration and use no random stream.
export const SUPPLY=Object.freeze({firstWave:2,delay:10,lifetime:30,radius:1.2,maxPickupHeight:.55,scrap:25});
export const SUPPLY_POINTS=Object.freeze([
  [12,12],[-12,12],[-12,-12],[12,-12]
].map(([x,z])=>Object.freeze({x,z})));
