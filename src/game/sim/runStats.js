export function createRunStats() {
  return { kills:{player:0,turret:0,trap:0}, suppliesCollected:0, scrapEarned:0, scrapSpent:0, playerDamage:0, shelterDamage:0 };
}

export function creditScrap(s, amount, source) {
  const before=s.scrap;
  s.scrap=Math.min(999999,s.scrap+amount);
  const credited=s.scrap-before;
  if(s.stats) {
    s.stats.scrapEarned+=credited;
    // Supply callers invoke this only after accepting a pickup, including at the scrap cap.
    if(source==='supply') s.stats.suppliesCollected++;
  }
  return credited;
}

export function getRunSummary(s) {
  const advice={
    shelter:'Ремонтируйте шалаш (E) и защищайте подходы капканами.',
    health:'Отходите от пауков и используйте укрытие.',
    both:'Сначала спасите защитника: отойдите в укрытие. Затем ремонтируйте лагерь (E) и прикройте подходы капканами.',
  };
  const recommendation=s.phase==='victory'
    ? 'Лагерь выстоял! Пополните боезапас перед бесконечными волнами.'
    : advice[s.result] || 'Берегите здоровье и укрепляйте лагерь.';
  return {...structuredClone(s.stats),clearedWaves:s.clearedWaves,time:s.time,recommendation};
}
