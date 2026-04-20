import { describe, it, expect } from 'vitest';
import { createScrollSpring } from '../public/js/scroll-spring.js';

describe('createScrollSpring', () => {
  it('starts at initial value', () => {
    const s = createScrollSpring(0);
    expect(s.value).toBe(0);
  });

  it('chases target over repeated ticks', () => {
    const s = createScrollSpring(0, { damping: 0.15 });
    s.target = 1;
    for (let i = 0; i < 120; i++) s.tick(16);
    expect(s.value).toBeGreaterThan(0.99);
    expect(s.value).toBeLessThanOrEqual(1);
  });

  it('does not overshoot target significantly', () => {
    const s = createScrollSpring(0, { damping: 0.15 });
    s.target = 1;
    let peak = 0;
    for (let i = 0; i < 240; i++) { s.tick(16); peak = Math.max(peak, s.value); }
    expect(peak).toBeLessThan(1.02);
  });

  it('clamps value to [0, 1] when clamp option is true', () => {
    const s = createScrollSpring(0, { damping: 0.3, clamp: true });
    s.target = 1.5;
    for (let i = 0; i < 240; i++) s.tick(16);
    expect(s.value).toBeLessThanOrEqual(1);
  });
});
