// Critically-damped mass-spring-damper that chases `target`.
// `damping` is named for API simplicity; physically it is the spring stiffness k.
// The damping coefficient c is derived as 2*sqrt(k) so the system is critically
// damped (no overshoot) by construction. Stable for damping ≤ ~0.3 at dt cap of 64ms.

const MAX_DT_MS = 64;        // ~4 frames at 60fps; prevents explosive steps after tab-switch
const FRAME_MS  = 1000 / 60; // normalize dt to "frames at 60fps"

/**
 * @param {number} initial - starting value for both `value` and `target`
 * @param {{ damping?: number, clamp?: boolean }} [opts]
 * @returns {{ value: number, velocity: number, target: number, tick: (dtMs: number) => void }}
 *   Consumers write `target` to steer the spring; `value` and `velocity` are read-only snapshots.
 */
export function createScrollSpring(initial = 0, { damping = 0.12, clamp = false } = {}) {
  const k = Math.max(0, damping);
  const omega = Math.sqrt(k);
  const c = 2 * omega;
  const state = {
    value: initial,
    velocity: 0,
    target: initial,
    tick(dtMs) {
      const safeDt = Math.max(0, Math.min(dtMs || 0, MAX_DT_MS));
      const dt = safeDt / FRAME_MS;
      const delta = state.target - state.value;
      const accel = delta * k - state.velocity * c;
      state.velocity += accel * dt;
      state.value += state.velocity * dt;
      if (clamp) state.value = Math.max(0, Math.min(1, state.value));
    },
  };
  return state;
}
