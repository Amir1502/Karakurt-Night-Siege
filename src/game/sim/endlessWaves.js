const SCENARIOS = Object.freeze([
  Object.freeze({name:'Прорыв',primary:'karakurt_runner',hint:'Бегуны идут плотной стаей: перекройте подходы капканами.'}),
  Object.freeze({name:'Обстрел',primary:'karakurt_spitter',hint:'Сначала убирайте плевателей, двигайтесь между выстрелами.'}),
  Object.freeze({name:'Осада',primary:'tarantula_brute',hint:'Тараны давят на шалаш; оставьте путь для отхода от прыгунов.'}),
]);

export function endlessWave(base, wave) {
  if(!Number.isInteger(wave)||wave<11)throw new RangeError('Endless waves start at 11');
  const scenario=SCENARIOS[(wave-11)%SCENARIOS.length],quantity=1+.15*(wave-10);
  const spawns=base.spawns.map(g=>({...g,count:Math.ceil(g.count*quantity)}));
  const totals=new Map();
  for(const g of spawns)totals.set(g.spiderId,(totals.get(g.spiderId)||0)+g.count);
  let remaining=Math.floor(spawns.reduce((sum,g)=>sum+g.count,0)*.2);
  const primary=spawns.find(g=>g.spiderId===scenario.primary);
  // A custom wave without the target type has no timing template for that type.
  if(primary)for(const g of spawns) {
    if(g.spiderId===scenario.primary)continue;
    const moved=Math.min(remaining,g.count,totals.get(g.spiderId)-1);
    g.count-=moved;primary.count+=moved;remaining-=moved;
    totals.set(g.spiderId,totals.get(g.spiderId)-moved);
  }
  for(const g of spawns) {
    if(scenario.primary==='karakurt_runner'&&g.spiderId===scenario.primary)g.interval*=.75;
    if(scenario.primary==='karakurt_spitter'&&g.spiderId!==scenario.primary)g.delay+=4;
    if(scenario.primary==='tarantula_brute'&&g.spiderId==='jumper_wolf')g.delay+=6;
  }
  return {...base,index:wave,spawns,scenario:{name:scenario.name,hint:scenario.hint}};
}
