// Pointer Lock mouse filter. Chrome on Windows can deliver a single huge
// movementX/Y right after the lock is (re)acquired or when the cursor would
// have crossed the window edge. Those values turn the camera by tens of
// degrees in one frame, so they are dropped instead of applied.
export const SENSITIVITY_MIN = 0.25, SENSITIVITY_MAX = 3, SENSITIVITY_DEFAULT = 1;
const SPIKE = 250;        // px per event; real hand movement stays far below at 1000 Hz polling
const SETTLE_MS = 80;     // ignore movement briefly after the lock is acquired

export function clampSensitivity(value) {
  const v = Number(value);
  return Number.isFinite(v) ? Math.min(SENSITIVITY_MAX, Math.max(SENSITIVITY_MIN, v)) : SENSITIVITY_DEFAULT;
}

export function createMouseFilter() {
  let settleUntil = 0, lastX = 0, lastY = 0;
  return {
    /** Call when Pointer Lock is acquired or released. */
    reset(now) { settleUntil = now + SETTLE_MS; lastX = lastY = 0; },
    /** Returns [dx, dy] scaled by sensitivity, or null for a rejected event. */
    accept(dx, dy, now, sensitivity = 1) {
      dx = Number(dx) || 0; dy = Number(dy) || 0;
      if (now < settleUntil) return null;
      // A spike is large in absolute terms and far larger than the previous event.
      const big = Math.abs(dx) > SPIKE || Math.abs(dy) > SPIKE;
      const jump = Math.abs(dx) > 8 * Math.max(20, Math.abs(lastX)) || Math.abs(dy) > 8 * Math.max(20, Math.abs(lastY));
      if (big && jump) return null;
      lastX = dx; lastY = dy;
      const k = clampSensitivity(sensitivity);
      return [dx * k, dy * k];
    }
  };
}
