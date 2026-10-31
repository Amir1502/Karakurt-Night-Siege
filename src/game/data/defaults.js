// Встроенный эталон v1 — снимок примеров docs/design/spider-vs-human-3d-data.md §2–4.
// Используется при любой ошибке внешних JSON. Без DOM и Three.js: работает в Node.

const spider = (id, name, health, speed, damage, attackRange, attackCooldown, scrapDrop, scale, behavior) =>
  ({ id, name, health, speed, damage, attackRange, attackCooldown, scrapDrop, scale, behavior });
const weapon = (id, name, damage, fireRate, magazine, reserve, reloadTime, spread, range, pellets, unlockWave) =>
  ({ id, name, damage, fireRate, magazine, reserve, reloadTime, spread, range, pellets, unlockWave });
const group = (spiderId, count, interval, delay) => ({ spiderId, count, interval, delay });
const wave = (index, buildTime, spawns) => ({ index, startDelay: 3, buildTime, spawns });

const R = 'karakurt_runner', S = 'karakurt_spitter', B = 'tarantula_brute', J = 'jumper_wolf';

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export const DEFAULT_CONFIG = deepFreeze({
  spiders: [
    spider(R, 'Каракурт-бегун', 40, 4.5, 6, 1.2, 1, 3, 0.75, 'chase'),
    spider(S, 'Каракурт-плеватель', 60, 2.6, 8, 14, 2.5, 5, 0.9, 'spit'),
    spider(B, 'Тарантул-таран', 220, 1.8, 18, 1.8, 1.8, 10, 1.5, 'charge'),
    spider(J, 'Паук-волк', 75, 3.4, 12, 8, 3, 6, 1.05, 'leap'),
    spider('widow_queen', 'Королева вдов', 1800, 1.6, 24, 2.5, 2, 120, 2.8, 'boss'),
  ],
  weapons: [
    weapon('pistol_makarov', 'Пистолет Макарова', 20, 3, 12, 72, 1.4, 1.2, 45, 1, 1),
    weapon('shotgun_trench', 'Окопный дробовик', 12, 1, 6, 24, 2.6, 7, 20, 8, 2),
    weapon('smg_scorpion', 'ПП Скорпион', 12, 12, 30, 120, 2, 3, 35, 1, 3),
    weapon('flamethrower_torch', 'Огнемёт Факел', 4, 10, 100, 100, 3, 18, 6, 1, 4),
    weapon('turret_sentry', 'Турель Часовой', 14, 6, 60, 120, 2.5, 2, 30, 1, 5),
  ],
  waves: [
    wave(1, 20, [group(R, 10, 2.5, 0)]),
    wave(2, 20, [group(R, 12, 2.5, 0), group(S, 2, 10, 10)]),
    wave(3, 20, [group(R, 12, 2.5, 0), group(S, 4, 6, 8), group(B, 2, 12, 14)]),
    wave(4, 20, [group(R, 12, 2.5, 0), group(S, 4, 7, 8), group(B, 4, 7, 12), group(J, 2, 12, 18)]),
    wave(5, 20, [group(R, 14, 2.5, 0), group(S, 4, 8, 8), group(B, 4, 8, 12), group(J, 4, 7, 16)]),
    wave(6, 20, [group(R, 14, 2.5, 0), group(S, 6, 6, 8), group(B, 5, 7, 12), group(J, 5, 6, 16)]),
    wave(7, 20, [group(R, 16, 2.5, 0), group(S, 6, 7, 8), group(B, 6, 7, 12), group(J, 6, 6, 16)]),
    wave(8, 20, [group(R, 16, 2.5, 0), group(S, 8, 6, 8), group(B, 6, 8, 12), group(J, 6, 7, 16)]),
    wave(9, 20, [group(R, 16, 2.5, 0), group(S, 8, 6, 8), group(B, 7, 7, 12), group(J, 7, 6, 16)]),
    wave(10, 25, [group('widow_queen', 1, 1, 0), group(R, 16, 2.5, 4), group(S, 8, 6, 8),
      group(B, 7, 7, 12), group(J, 8, 6, 16)]),
  ],
});
