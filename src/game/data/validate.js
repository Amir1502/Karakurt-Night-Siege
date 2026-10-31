// Строгая проверка комплекта v1 по docs/design/spider-vs-human-3d-data.md §2–5.
// Возвращает список ошибок; пустой список — комплект валиден. Ничего не исправляет.

export const SPIDER_BEHAVIOR = Object.freeze({
  karakurt_runner: 'chase', karakurt_spitter: 'spit', tarantula_brute: 'charge',
  jumper_wolf: 'leap', widow_queen: 'boss',
});
export const WEAPON_IDS = Object.freeze([
  'pistol_makarov', 'shotgun_trench', 'smg_scorpion', 'flamethrower_torch', 'turret_sentry',
]);

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function exactKeys(obj, keys, path, errors) {
  if (!isObj(obj)) { errors.push(`${path}: нужен объект`); return false; }
  const have = Object.keys(obj).sort().join(','), want = [...keys].sort().join(',');
  if (have !== want) { errors.push(`${path}: поля ${have} вместо ${want}`); return false; }
  return true;
}
function num(v, min, max, path, errors, integer = false) {
  if (!isNum(v) || v < min || v > max || (integer && !Number.isSafeInteger(v))) {
    errors.push(`${path}: ${JSON.stringify(v)} вне ${min}–${max}${integer ? ' (целое)' : ''}`);
  }
}
function name(v, path, errors) {
  if (typeof v !== 'string' || v.trim() !== v || v.length < 1 || v.length > 64) errors.push(`${path}: имя`);
}

const SPIDER_RANGES = { health: [1, 5000], speed: [0.1, 12], damage: [0, 100], attackRange: [0.1, 40],
  attackCooldown: [0.1, 30], scale: [0.1, 5] };
const WEAPON_RANGES = { damage: [1, 1000], fireRate: [0.1, 60], reloadTime: [0.1, 30], spread: [0, 45],
  range: [0.1, 150] };
const WEAPON_INTS = { magazine: [1, 1000], reserve: [0, 10000], pellets: [1, 32], unlockWave: [1, 10] };

export function validateSpiders(doc, errors) {
  if (!exactKeys(doc, ['version', 'spiders'], 'spiders.json', errors)) return;
  if (doc.version !== 1) errors.push('spiders.json: version');
  if (!Array.isArray(doc.spiders) || doc.spiders.length !== 5) { errors.push('spiders: нужно 5'); return; }
  const seen = new Set();
  doc.spiders.forEach((s, i) => {
    const p = `spiders[${i}]`;
    if (!exactKeys(s, ['id', 'name', ...Object.keys(SPIDER_RANGES), 'scrapDrop', 'behavior'], p, errors)) return;
    if (!(s.id in SPIDER_BEHAVIOR) || seen.has(s.id)) errors.push(`${p}.id`);
    seen.add(s.id);
    name(s.name, `${p}.name`, errors);
    for (const [k, [a, b]] of Object.entries(SPIDER_RANGES)) num(s[k], a, b, `${p}.${k}`, errors);
    num(s.scrapDrop, 0, 500, `${p}.scrapDrop`, errors, true);
    if (SPIDER_BEHAVIOR[s.id] !== s.behavior) errors.push(`${p}.behavior`);
  });
}

export function validateWeapons(doc, errors) {
  if (!exactKeys(doc, ['version', 'weapons'], 'weapons.json', errors)) return;
  if (doc.version !== 1) errors.push('weapons.json: version');
  if (!Array.isArray(doc.weapons) || doc.weapons.length !== 5) { errors.push('weapons: нужно 5'); return; }
  const seen = new Set();
  doc.weapons.forEach((w, i) => {
    const p = `weapons[${i}]`;
    const keys = ['id', 'name', ...Object.keys(WEAPON_RANGES), ...Object.keys(WEAPON_INTS)];
    if (!exactKeys(w, keys, p, errors)) return;
    if (!WEAPON_IDS.includes(w.id) || seen.has(w.id)) errors.push(`${p}.id`);
    seen.add(w.id);
    name(w.name, `${p}.name`, errors);
    for (const [k, [a, b]] of Object.entries(WEAPON_RANGES)) num(w[k], a, b, `${p}.${k}`, errors);
    for (const [k, [a, b]] of Object.entries(WEAPON_INTS)) num(w[k], a, b, `${p}.${k}`, errors, true);
    if (w.id !== 'shotgun_trench' && w.pellets !== 1) errors.push(`${p}.pellets`);
    if (w.id === 'pistol_makarov' && w.unlockWave !== 1) errors.push(`${p}.unlockWave`);
  });
}

export function validateWaves(doc, errors, spiderIds = Object.keys(SPIDER_BEHAVIOR)) {
  if (!exactKeys(doc, ['version', 'waves'], 'waves.json', errors)) return;
  if (doc.version !== 1) errors.push('waves.json: version');
  if (!Array.isArray(doc.waves) || doc.waves.length !== 10) { errors.push('waves: нужно 10'); return; }
  let bosses = 0;
  doc.waves.forEach((w, i) => {
    const p = `waves[${i}]`;
    if (!exactKeys(w, ['index', 'startDelay', 'buildTime', 'spawns'], p, errors)) return;
    if (w.index !== i + 1) errors.push(`${p}.index`);
    num(w.startDelay, 0, 180, `${p}.startDelay`, errors);
    num(w.buildTime, 0, 120, `${p}.buildTime`, errors);
    if (!Array.isArray(w.spawns) || w.spawns.length < 1 || w.spawns.length > 5) {
      errors.push(`${p}.spawns`); return;
    }
    const seen = new Set();
    let total = 0;
    w.spawns.forEach((g, j) => {
      const q = `${p}.spawns[${j}]`;
      if (!exactKeys(g, ['spiderId', 'count', 'interval', 'delay'], q, errors)) return;
      if (!spiderIds.includes(g.spiderId) || seen.has(g.spiderId)) errors.push(`${q}.spiderId`);
      seen.add(g.spiderId);
      num(g.count, 1, 40, `${q}.count`, errors, true);
      num(g.interval, 0.1, 60, `${q}.interval`, errors);
      num(g.delay, 0, 180, `${q}.delay`, errors);
      if (Number.isSafeInteger(g.count)) total += g.count;
      if (g.spiderId === 'widow_queen') {
        bosses += Number.isSafeInteger(g.count) ? g.count : 0;
        if (w.index !== 10) errors.push(`${q}: босс только в волне 10`);
      }
    });
    if (total < 1 || total > 200) errors.push(`${p}: сумма count`);
  });
  if (bosses !== 1) errors.push('waves: widow_queen ровно один раз');
}

/** Проверяет комплект {spiders, weapons, waves} (как в DEFAULT_CONFIG). */
export function validateConfig(config) {
  const errors = [];
  if (!isObj(config)) return ['config: нужен объект'];
  validateSpiders({ version: 1, spiders: config.spiders }, errors);
  validateWeapons({ version: 1, weapons: config.weapons }, errors);
  validateWaves({ version: 1, waves: config.waves }, errors);
  return errors;
}
