import { shotgunMod } from './weaponMods.js';

export const UPGRADE_LEVELS = Object.freeze([
  Object.freeze({ label:'I', cost:40, damage:1, magazine:1, reload:1 }),
  Object.freeze({ label:'II', cost:80, damage:1.2, magazine:1, reload:1 }),
  Object.freeze({ label:'III', cost:0, damage:1.2, magazine:1.5, reload:.8 }),
]);

export function effectiveWeapon(base, level = 1, modification = null) {
  const upgrade=UPGRADE_LEVELS[base.id==='turret_sentry'?0:level-1];
  const mod=base.id==='shotgun_trench'?shotgunMod(modification):null;
  return {...base,damage:base.damage*upgrade.damage*(mod?.damage??1),spread:base.spread*(mod?.spread??1),pellets:Math.round(base.pellets*(mod?.pellets??1)),magazine:Math.floor(base.magazine*upgrade.magazine),reloadTime:base.reloadTime*upgrade.reload};
}
