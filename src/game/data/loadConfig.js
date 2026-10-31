// Загрузка трёх JSON конфигурации. Любая ошибка → весь DEFAULT_CONFIG, usedFallback=true.
// Без DOM и Three.js: нужен только глобальный fetch (браузер или Node 18+).
import { DEFAULT_CONFIG } from './defaults.js';
import { validateSpiders, validateWeapons, validateWaves } from './validate.js';

const FILES = ['spiders', 'weapons', 'waves'];
const MAX_BYTES = 512 * 1024;
const TIMEOUT_MS = 5000;

function resolve(baseUrl, file) {
  const base = String(baseUrl).endsWith('/') ? String(baseUrl) : `${baseUrl}/`;
  // Относительный baseUrl в браузере разрешается от страницы, в Node — от localhost.
  const origin = globalThis.location?.href ?? 'http://localhost/';
  return new URL(`${file}.json`, new URL(base, origin)).href;
}

async function fetchJson(url) {
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), TIMEOUT_MS) : null;
  try {
    const res = await fetch(url, ctrl ? { signal: ctrl.signal } : undefined);
    if (!res.ok) throw new Error(`CONFIG_LOAD ${res.status}`);
    const text = await res.text();
    if (text.length > MAX_BYTES) throw new Error('CONFIG_LOAD size');
    return JSON.parse(text);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function loadConfig(baseUrl = 'src/game/data/') {
  try {
    const docs = await Promise.all(FILES.map((f) => fetchJson(resolve(baseUrl, f))));
    const [spiders, weapons, waves] = docs;
    const errors = [];
    validateSpiders(spiders, errors);
    validateWeapons(weapons, errors);
    if (!errors.length) validateWaves(waves, errors, spiders.spiders.map((s) => s.id));
    else validateWaves(waves, errors);
    if (errors.length) throw new Error(`CONFIG_FIELD ${errors[0]}`);
    return {
      config: { spiders: spiders.spiders, weapons: weapons.weapons, waves: waves.waves },
      usedFallback: false,
    };
  } catch (error) {
    if (typeof console !== 'undefined') console.warn('[svh3d] встроенные настройки:', error?.message ?? error);
    return { config: DEFAULT_CONFIG, usedFallback: true };
  }
}
