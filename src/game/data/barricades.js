export const BARRICADE=Object.freeze({cost:25,health:120,repairCost:10,repairAmount:60,reach:2,height:1.1,thickness:.3,length:3});
export const BARRICADE_SITES=Object.freeze([
  {id:'east',label:'Восток',x:6,z:0,halfX:.15,halfZ:1.5},
  {id:'west',label:'Запад',x:-6,z:0,halfX:.15,halfZ:1.5},
  {id:'north',label:'Север',x:0,z:-5.5,halfX:1.5,halfZ:.15},
  {id:'south',label:'Юг',x:0,z:5.5,halfX:1.5,halfZ:.15},
].map(s=>Object.freeze({...s,height:BARRICADE.height})));
