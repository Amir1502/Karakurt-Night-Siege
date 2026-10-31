// Playable supplies and traps reuse E2 prototypes; ARENA_DECOR lists only static props.
export const ARENA_DECOR_PROTOTYPES=Object.freeze([
  'supply_crate','bear_trap','barrel','moskvich_wreck','broken_fence','telegraph_pole','web_cocoon_rock','cattle_skull'
]);

// Tall props sit beyond the 40 m enemy boundary. Low accents leave the camp and cardinal lanes open.
export const ARENA_DECOR=Object.freeze([
  ['barrel',36,22,1,.2],
  ['barrel',-35,-24,1,-.6],
  ['barrel',37,24,.95,.5],
  ['moskvich_wreck',32,-30,1,-.7],
  ['broken_fence',-32,30,1,.75],
  ['broken_fence',-35,32,.9,.45],
  ['telegraph_pole',-30,-33,1,.4],
  ['telegraph_pole',33,31,.92,-.5],
  ['web_cocoon_rock',-10,-11,1,.6],
  ['web_cocoon_rock',14,-9,.9,-.4],
  ['web_cocoon_rock',-17,9,1,.8],
  ['web_cocoon_rock',11,19,.9,-1.1],
  ['cattle_skull',-11,14,1.15,.4],
  ['cattle_skull',16,12,1.05,-.8],
  ['cattle_skull',-16,-15,1.1,.8],
  ['cattle_skull',13,-18,1.2,1.4],
  ['cattle_skull',-21,8,1,-.4],
  ['cattle_skull',7,21,1.1,2.1]
].map(([prototype,x,z,scale,yaw])=>Object.freeze({prototype,x,z,scale,yaw})));
