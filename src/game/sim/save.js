export const SAVE_KEY = 'svh3d.save.v1';
const defaults = () => ({ version: 1, bestWave: 0, bestTime: 0, kills: 0, muted: false });
const fields = Object.keys(defaults()).sort().join(',');
// Optional progress extension preserves the shape of existing v1 saves and defaults.
const endlessFields = [...Object.keys(defaults()), 'bestEndless'].sort().join(',');
function valid(s, version = 1) {
  return s && typeof s === 'object' && [fields, endlessFields].includes(Object.keys(s).sort().join(',')) && s.version === version
    && Number.isSafeInteger(s.bestWave) && s.bestWave >= 0 && s.bestWave <= 10
    && (!Object.hasOwn(s, 'bestEndless') || Number.isSafeInteger(s.bestEndless) && (s.bestEndless === 0 || s.bestEndless >= 11))
    && ['bestTime', 'kills'].every(k => Number.isSafeInteger(s[k]) && s[k] >= 0) && typeof s.muted === 'boolean';
}
function parse(raw, version) {
  if (typeof raw !== 'string' || raw.length > 4096) return null;
  try { const s = JSON.parse(raw); return valid(s, version) ? s : null; } catch { return null; }
}
export function writeSave(storage, data) {
  const s = Object.fromEntries(Object.keys(defaults()).map(k => [k, data[k]]));
  if (Object.hasOwn(data, 'bestEndless')) s.bestEndless = data.bestEndless;
  s.bestTime = Math.floor(s.bestTime);
  if (!valid(s)) return { ok: false, reason: 'invalid' };
  try { storage.setItem(SAVE_KEY, JSON.stringify(s)); return { ok: true }; }
  catch { return { ok: false, reason: 'storage' }; }
}
export function loadSave(storage) {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (raw !== null) {
      const s = parse(raw, 1);
      if (s) return s;
      const clean = defaults(); writeSave(storage, clean); return clean;
    }
    const legacy = storage.getItem('svh3d.save.v0');
    if (legacy !== null) {
      const s = parse(legacy, 0);
      if (s) { s.version = 1; if (writeSave(storage, s).ok) storage.removeItem?.('svh3d.save.v0'); return s; }
      storage.removeItem?.('svh3d.save.v0');
    }
  } catch { /* Storage can be disabled without disabling play. */ }
  return defaults();
}
