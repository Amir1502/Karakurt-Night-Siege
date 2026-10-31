const mix = (a, b, t) => a + (b - a) * t;
function position(previous, current, t, turn = false) {
  if (!previous) return current;
  const result = {...current, x:mix(previous.x,current.x,t), y:mix(previous.y,current.y,t), z:mix(previous.z,current.z,t)};
  if (turn) result.yaw = previous.yaw + Math.atan2(Math.sin(current.yaw-previous.yaw),Math.cos(current.yaw-previous.yaw))*t;
  return result;
}

// Rendering trails simulation by one tick. Mouse look remains immediate.
export function interpolateState(previous, current, alpha, movementX = 0, movementY = 0) {
  const t = Math.max(0,Math.min(1,alpha));
  const old = new Map(previous.spiders.map(e=>[e.id,e]));
  const webs = new Map(previous.webs.map(e=>[e.id,e]));
  const player = position(previous.player,current.player,t);
  return {...current, time:mix(previous.time,current.time,t),
    player:{...player,yaw:current.player.yaw-movementX*.002,pitch:Math.max(-1.35,Math.min(1.35,current.player.pitch-movementY*.002))},
    spiders:current.spiders.map(e=>position(old.get(e.id),e,t,true)),
    webs:current.webs.map(e=>position(webs.get(e.id),e,t))};
}
