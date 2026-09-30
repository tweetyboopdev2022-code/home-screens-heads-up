import { describe, it, expect } from 'vitest';
import { parsePickups, isPickup, addDays, joinAnd } from './logic';
describe('pickups', () => {
  const ps = parsePickups('Trash: Wed every 2 weeks from 2026-09-16, Recycling: Wed biweekly from 2026-09-23, Compost: Thu weekly');
  it('parses', () => { expect(ps.map((p) => [p.label, p.dow, p.every])).toEqual([['Trash', 3, 2], ['Recycling', 3, 2], ['Compost', 4, 1]]); });
  it('alternates', () => {
    expect(isPickup(ps[0], '2026-09-30')).toBe(true); expect(isPickup(ps[1], '2026-09-30')).toBe(false);
    expect(isPickup(ps[1], '2026-10-07')).toBe(true); expect(isPickup(ps[2], '2026-10-01')).toBe(true);
  });
  it('dates', () => { expect(addDays('2026-09-30', 1)).toBe('2026-10-01'); expect(joinAnd(['a', 'b', 'c'])).toBe('a, b & c'); });
});
