import { BENCH, distance, visible } from './physics.js';
import { UPGRADE_LEVELS } from '../data/upgrades.js';
import { TRAP } from './traps.js';
import { shotgunMod } from '../data/weaponMods.js';
const PRICES = [15, 25, 30, 25, 30], PACKS = [36, 12, 60, 100, 60], CAPS = [180, 60, 300, 300, 300];
export function unlock(s, config) {
  config.weapons.forEach((w, i) => {
    const a = s.weapons[i];
    if (!a.unlocked && w.unlockWave <= s.wave) {
      a.unlocked = true; a.magazine = w.magazine; a.reserve = w.reserve;
    }
  });
}
export function offer(s, action = '') {
  const i = s.activeSlot - 1, a = s.weapons[i];
  // E never silently changes from repair/deploy to a purchase. Ammo is explicit.
  let kind = action || (i === 4 ? 'build' : 'repair');
  let cost = 0, amount = 0, reason = '';
  if (s.phase !== 'build' || s.subphase !== 'build') reason = 'Покупки только в подготовке';
  else if (distance(s.player, BENCH) > 2.5 || !visible(s.player, BENCH)) reason = 'Подойдите к верстаку справа от шалаша';
  else if (!a.unlocked) reason = 'Оружие ещё закрыто';
  if (kind === 'build') {
    cost = 120; amount = 1;
    if (i !== 4 || !a.unlocked) reason ||= 'Выберите открытый слот 5';
    else if (s.turrets.length) reason ||= 'Турель уже установлена';
  } else if (kind === 'repair') {
    cost = 20; amount = Math.min(25, 100-s.shelterIntegrity);
    if (amount <= 0) reason ||= 'Ремонт не нужен';
  } else if (kind === 'ammo') {
    cost = PRICES[i]; amount = Math.max(0, Math.min(PACKS[i], CAPS[i]-a.reserve));
    if (i === 4 && !s.turrets.length) reason ||= 'Сначала установите турель';
    else if (!amount) reason ||= 'Запас полон';
  } else if (kind === 'trap') {
    cost=TRAP.cost;amount=1;
    if (s.trapStock+s.traps.length>=TRAP.limit) reason ||= 'Не больше трёх капканов: запас и установленные';
  } else if (kind === 'upgrade') {
    const level=a.level??1;cost=UPGRADE_LEVELS[level-1].cost;amount=1;
    if (i === 4) reason ||= 'Турель не улучшается';
    else if (level === 3) reason ||= 'Максимальный уровень III';
    else if (a.reload > 0) reason ||= 'Дождитесь конца перезарядки';
  } else if (shotgunMod(kind)) {
    cost=shotgunMod(kind).cost;amount=1;
    if(i!==1) reason ||= 'Выберите дробовик: слот 2';
    else if(a.modification) reason ||= 'Модификация уже выбрана до конца забега';
    else if(a.reload>0) reason ||= 'Дождитесь конца перезарядки';
  } else reason ||= 'Неизвестная покупка';
  if (s.scrap < cost) reason ||= 'Недостаточно деталей';
  return { kind, cost, amount, ok: !reason, reason };
}
export function interact(s, action, site) {
  const o = offer(s, action); s.lastAction = {...o,tick:s.tick};
  if (!o.ok) return;
  s.scrap -= o.cost;
  if (s.stats) s.stats.scrapSpent += o.cost;
  if (o.kind === 'build') s.turrets.push({ id: 1, ...site, yaw: 0, cooldown: 0, reload: 0 });
  if (o.kind === 'repair') s.shelterIntegrity += o.amount;
  if (o.kind === 'ammo') s.weapons[s.activeSlot-1].reserve += o.amount;
  if (o.kind === 'upgrade') s.weapons[s.activeSlot-1].level = (s.weapons[s.activeSlot-1].level??1)+1;
  if (o.kind === 'trap') s.trapStock++;
  if (shotgunMod(o.kind)) s.weapons[s.activeSlot-1].modification=o.kind;
}
