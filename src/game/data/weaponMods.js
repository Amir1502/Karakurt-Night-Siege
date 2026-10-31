export const SHOTGUN_MODS = Object.freeze({
  mod_narrow:Object.freeze({label:'Узкая дробь',cost:40,spread:4/7,pellets:1,damage:1}),
  mod_wide:Object.freeze({label:'Широкая дробь',cost:40,spread:12/7,pellets:1.5,damage:2/3}),
});

export function shotgunMod(id) {
  return Object.hasOwn(SHOTGUN_MODS,id)?SHOTGUN_MODS[id]:null;
}
