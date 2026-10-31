export const HUD=Object.freeze({
  pointerInset:144,damageLifetime:1,criticalThreshold:30,criticalInterval:8,criticalNotice:3,
  actionNotice:3,guideDuration:6
});
export const HUD_LESSONS=Object.freeze([
  {wave:1,action:'ammo',text:'Q у верстака покупает патроны без паузы'},
  {wave:2,action:'upgrade',text:'U улучшает выбранное оружие · Детали нужны и на ремонт'},
  {wave:3,action:'placeTrap',text:'T покупает капкан · G ставит его под ногами в подготовке'}
].map(Object.freeze));
