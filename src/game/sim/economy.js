import { BENCH, distance, visible } from './physics.js';
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
  } else reason ||= 'Неизвестная покупка';
  if (s.scrap < cost) reason ||= 'Недостаточно деталей';
  return { kind, cost, amount, ok: !reason, reason };
}
export function interact(s, action, site) {
  const o = offer(s, action); s.lastAction = o;
  if (!o.ok) return;
  s.scrap -= o.cost;
  if (o.kind === 'build') s.turrets.push({ id: 1, ...site, yaw: 0, cooldown: 0, reload: 0 });
  if (o.kind === 'repair') s.shelterIntegrity += o.amount;
  if (o.kind === 'ammo') s.weapons[s.activeSlot-1].reserve += o.amount;
}
