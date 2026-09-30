export type Pickup = { label: string; dow: number; every: number; from: string };
const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/** "Trash: Wed every 2 weeks from 2026-09-16, Compost: Thu weekly" */
export function parsePickups(s: string): Pickup[] {
  return s.split(',').map((p) => p.trim()).filter(Boolean).map((p) => {
    const m = p.match(/^(.+?):\s*([a-z]{3})[a-z]*\s*(weekly|biweekly|every\s*2\s*weeks?)?(?:\s*from\s*(\d{4}-\d{2}-\d{2}))?/i);
    if (!m) return null;
    const dow = DOW.indexOf(m[2].toLowerCase()); if (dow < 0) return null;
    const every = m[3] && !/^weekly$/i.test(m[3]) ? 2 : 1;
    return { label: m[1].trim(), dow, every, from: m[4] ?? '' };
  }).filter(Boolean) as Pickup[];
}

const dayNum = (k: string) => Math.round(Date.parse(k + 'T00:00:00Z') / 86400000);
const dowOf = (k: string) => new Date(k + 'T00:00:00Z').getUTCDay();

/** Is `key` (YYYY-MM-DD) a pickup day for p? */
export function isPickup(p: Pickup, key: string): boolean {
  if (dowOf(key) !== p.dow) return false;
  if (p.every === 1 || !p.from) return true;
  const weeks = Math.round((dayNum(key) - dayNum(p.from)) / 7);
  return ((weeks % p.every) + p.every) % p.every === 0;
}
export const addDays = (k: string, n: number) => new Date((dayNum(k) + n) * 86400000).toISOString().slice(0, 10);

export function parseMeal(content: string): { name: string; count: number } {
  const c = content.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[*_`]/g, '').trim();
  const m = c.match(/^(.*?)\s*(?:\((\d+)\)|[x×]\s*(\d+)|[-–:]\s*(\d+)|\s(\d+))\s*$/i);
  if (m && m[1].trim()) return { name: m[1].trim(), count: Number(m[2] ?? m[3] ?? m[4] ?? m[5]) };
  return { name: c, count: 0 };
}
export const joinAnd = (a: string[]) => a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} & ${a[a.length - 1]}`;
