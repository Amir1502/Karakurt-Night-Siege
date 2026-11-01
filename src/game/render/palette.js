// Палитра из docs/design/spider-vs-human-3d-art.md, §2 (sRGB HEX).
export const PALETTE = {
  sandNight: 0x8E816C,
  sandLit: 0xB6A78C,
  sky: 0x101827,
  fog: 0x35445C,
  moon: 0xBFD7EA,
  chitin: 0x242C38,
  karakurtRed: 0xD54B53,
  fire: 0xFFBC70,
  embers: 0xE87738,
  uiPanel: 0x101820,
  dawn: 0xD7A984,
};

// Относительная яркость заполнения по номеру волны (art §3):
// 1–3 → 100%, 4–6 → 90%, 7–10 → 80% (нижний предел).
export function fillForWave(wave) {
  const w = Number.isFinite(wave) ? wave : 1;
  if (w <= 3) return 1;
  if (w <= 6) return 0.9;
  return 0.8;
}
