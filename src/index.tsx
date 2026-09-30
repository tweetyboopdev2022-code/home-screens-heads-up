// Heads-up — only what needs someone's attention right now: bins going out, overdue chores,
// Souper Cubes running low, tomorrow's dinner not planned. Quiet "All clear" otherwise.
import React from 'react';
import type { PluginComponentProps } from './hs-plugin';
import { frame, ink, Icon, I, sdk, useNow, dayKey, Fit, Shape } from './ui';
import { parsePickups, isPickup, addDays, parseMeal, joinAnd, nextPickup } from './logic';

const C = (x: number, y: number, r: number): Shape => ({ c: [x, y, r] });
const BIN: Shape[] = ['M3 6h18', 'M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6', 'M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2'];
const LIST: Shape[] = ['M9 11l3 3L22 4', 'M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11'];
const SNOW: Shape[] = ['M12 2v20', 'm17 5-5 5-5-5', 'm17 19-5-5-5 5', 'M2 12h20', 'm5 7 5 5-5 5', 'm19 7-5 5 5 5'];
const OK: Shape[] = [C(12, 12, 10), 'm9 12 2 2 4-4'];

type Chip = { label: string; color: string; go?: string };
type Item = { key: string; icon: Shape[]; color: string; title: string; detail?: string; chips?: Chip[]; go?: string; rank: number };
type Task = { id: string; content: string; due?: { date?: string } | null; labels?: string[]; projectName?: string };
const clean = (s: string) => s.replace(/[☾☀️🌙]/gu, '').trim().toLowerCase();
let screensCache: string[] = [];

export default function HeadsUp({ config, style, timezone: tz }: PluginComponentProps) {
  const now = useNow(60000);
  const today = dayKey(now, tz);
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: tz }).format(now));
  const people = String(config.people ?? 'Vince, Tanya, Nora').split(',').map((s) => s.trim()).filter(Boolean);
  const skipProjects = String(config.skipProjects ?? 'Groceries, Souper Cubes').split(',').map((s) => s.trim().toLowerCase());
  const souper = String(config.souperProject ?? 'Souper Cubes').toLowerCase();
  const lowAt = Number(config.lowAt ?? 1);
  const pickups = React.useMemo(() => parsePickups(String(config.pickups ?? '')), [config.pickups]);
  const colors: Record<string, string> = { Vince: '#34d399', Tanya: '#fbbf24', Nora: '#f472b6' };
  String(config.colors ?? '').split(',').forEach((p) => { const [k, v] = p.split(':').map((x) => x.trim()); if (k && v) colors[k] = v; });

  const [tasks, setTasks] = React.useState<Task[] | null>(null);
  const [meals, setMeals] = React.useState<any>(null);
  const tick = Math.floor(now.getTime() / 60000);
  React.useEffect(() => { (async () => {
    try { const t = await fetch('/api/todoist').then((r) => r.json()); setTasks(t.tasks ?? []); } catch { /* keep last */ }
    try { setMeals(await fetch('/api/meals/data').then((r) => r.json())); } catch { /* keep last */ }
    if (!screensCache.length) try { const c = await fetch('/api/config').then((r) => r.json()); screensCache = (c.screens ?? []).filter((s: any) => s.enabled !== false).map((s: any) => clean(s.name)); } catch { /* */ }
  })(); }, [tick]);

  const items: Item[] = [];
  // Bins: the evening before and the morning of pickup.
  const tmr = addDays(today, 1);
  const outTonight = pickups.filter((p) => isPickup(p, tmr)).map((p) => p.label);
  const pickToday = hour < 12 ? pickups.filter((p) => isPickup(p, today)).map((p) => p.label) : [];
  if (pickToday.length) items.push({ key: 'bins-today', icon: BIN, color: '#60a5fa', title: `${joinAnd(pickToday)} pickup this morning`, detail: 'Make sure it’s at the curb', rank: 0 });
  if (outTonight.length) items.push({ key: 'bins', icon: BIN, color: '#60a5fa', title: `${joinAnd(outTonight)} ${outTonight.length > 1 ? 'go' : 'goes'} out tonight`, detail: 'Pickup tomorrow morning', rank: hour >= 15 ? 0 : 2 });

  // Overdue chores: one row, a chip per person (tap a chip to open their screen).
  const overdue = (tasks ?? []).filter((t) => t.due?.date && t.due.date < today && !skipProjects.includes(String(t.projectName ?? '').toLowerCase()));
  const chips = people.map((p) => ({ p, n: overdue.filter((t) => (t.labels ?? []).some((l) => l.toLowerCase() === p.toLowerCase())).length })).filter((c) => c.n);
  const nobody = overdue.filter((t) => !(t.labels ?? []).some((l) => people.some((p) => p.toLowerCase() === l.toLowerCase()))).length;
  if (overdue.length) items.push({ key: 'overdue', icon: LIST, color: '#f87171', title: `${overdue.length} overdue chore${overdue.length > 1 ? 's' : ''}`,
    chips: [...chips.map((c) => ({ label: `${c.p} ${c.n}`, color: colors[c.p] ?? '#f87171', go: c.p })), ...(nobody ? [{ label: `House ${nobody}`, color: '#a8a29e' }] : [])], rank: 1 });

  // Souper Cubes running low.
  const low = (tasks ?? []).filter((t) => String(t.projectName ?? '').toLowerCase() === souper).map((t) => parseMeal(t.content)).filter((m) => m.count > 0 && m.count <= lowAt);
  if (low.length) items.push({ key: 'souper', icon: SNOW, color: '#38bdf8', title: `Souper Cubes low: ${joinAnd(low.map((m) => m.name))}`, detail: low.map((m) => `${m.name} ${m.count} left`).join(' · '), go: 'Planning', rank: 3 });

  // Tomorrow's dinner (from noon on).
  if (meals && hour >= 12 && config.mealNudge !== false) {
    const planned = (meals.plan ?? []).some((p: any) => p.date === tmr && (p.slot ?? 'dinner') === 'dinner');
    if (!planned) items.push({ key: 'meal', icon: I.utensils, color: '#fb923c', title: 'Tomorrow’s dinner isn’t planned', detail: 'Tap to open Planning', go: 'Planning', rank: 4 });
  }
  items.sort((a, b) => a.rank - b.rank);
  const max = Math.max(1, Number(config.maxItems ?? 3));
  const shown = items.slice(0, max);

  const go = (name?: string) => {
    if (!name) return; const i = screensCache.findIndex((s) => s.startsWith(clean(name)));
    if (i >= 0) sdk()?.emit?.({ type: 'navigate', direction: 'screen', screenIndex: i });
  };
  const title = String(config.title ?? 'Heads-up');

  if (String(config.show ?? 'all') === 'bins') {
    const binColors: Record<string, string> = {};
    String(config.binColors ?? 'Trash:#a8a29e, Recycling:#5ca8ff, Compost:#e19956').split(',').forEach((p) => { const [k, v] = p.split(':').map((x) => x.trim()); if (k && v) binColors[k.toLowerCase()] = v; });
    // After noon on pickup day, count from tomorrow.
    const from = hour >= 12 ? tmr : today;
    const rows = pickups.map((p) => ({ p, next: nextPickup(p, from) })).filter((r) => r.next).sort((a, b) => a.next!.localeCompare(b.next!));
    const when = (k: string) => {
      if (k === today) return 'Today';
      if (k === tmr) return 'Tomorrow';
      const d = new Date(k + 'T12:00:00Z');
      const days = Math.round((Date.parse(k) - Date.parse(today)) / 86400000);
      return days < 7 ? new Intl.DateTimeFormat(undefined, { weekday: 'long', timeZone: 'UTC' }).format(d)
        : new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(d);
    };
    return (
      <div style={frame(style)}>
        <div style={{ fontSize: '0.7em', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.55, marginBottom: '0.55em' }}>{String(config.title ?? 'Bins')}</div>
        <Fit min={0.6} max={1.35} justify="flex-start">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4em' }}>
            {rows.map(({ p, next }) => {
              const col = binColors[p.label.toLowerCase()] ?? '#60a5fa';
              const urgent = next === tmr || (next === today && hour < 12);
              const tag = next === tmr ? 'Out tonight' : next === today && hour < 12 ? 'Pickup this morning' : '';
              return (
                <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: '0.6em', padding: '0.4em 0.6em', borderRadius: '0.6em', background: urgent ? `color-mix(in srgb, ${col} 16%, transparent)` : 'transparent' }}>
                  <span style={{ width: '1.7em', height: '1.7em', flexShrink: 0, borderRadius: '0.5em', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `color-mix(in srgb, ${col} ${urgent ? 30 : 16}%, transparent)`, color: col }}>
                    <Icon d={BIN} size="1em" stroke={2} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: '0.95em', fontWeight: urgent ? 600 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.label}</span>
                  {tag ? <span style={{ fontSize: '0.7em', fontWeight: 700, padding: '0.2em 0.65em', borderRadius: '999px', background: col, color: '#111', whiteSpace: 'nowrap' }}>{tag}</span>
                    : <span style={{ fontSize: '0.8em', opacity: 0.6, whiteSpace: 'nowrap' }}>{when(next!)}</span>}
                </div>
              );
            })}
          </div>
        </Fit>
      </div>
    );
  }

  return (
    <div style={frame(style)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em', marginBottom: '0.5em' }}>
        <span style={{ fontSize: '0.7em', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.55 }}>{title}</span>
        {items.length > shown.length && <span style={{ fontSize: '0.65em', opacity: 0.4 }}>+{items.length - shown.length} more</span>}
      </div>
      {tasks && !shown.length ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.6em', opacity: 0.6 }}>
          <Icon d={OK} size="1.8em" stroke={1.6} style={{ color: '#4ade80' }} />
          <div><div style={{ fontWeight: 500 }}>All clear</div><div style={{ fontSize: '0.75em', opacity: 0.7 }}>Nothing needs anyone right now</div></div>
        </div>
      ) : (
        <Fit min={0.6} max={1.3} justify="flex-start">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45em' }}>
            {shown.map((it) => (
              <button key={it.key} onClick={() => go(it.go)} style={{ appearance: 'none', font: 'inherit', color: 'inherit', textAlign: 'left', cursor: it.go ? 'pointer' : 'default', border: 'none',
                display: 'flex', alignItems: 'center', gap: '0.6em', padding: '0.45em 0.6em', borderRadius: '0.6em', background: `color-mix(in srgb, ${it.color} 11%, transparent)` }}>
                <span style={{ width: '1.9em', height: '1.9em', flexShrink: 0, borderRadius: '0.5em', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `color-mix(in srgb, ${it.color} 22%, transparent)`, color: it.color }}>
                  <Icon d={it.icon} size="1.1em" stroke={2} />
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'block', fontSize: '0.9em', fontWeight: 600, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.title}</span>
                  {it.chips && <span style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3em', marginTop: '0.2em' }}>{it.chips.map((c) => (
                    <span key={c.label} role="button" onClick={(e) => { e.stopPropagation(); go(c.go); }} style={{ fontSize: '0.68em', fontWeight: 600, padding: '0.15em 0.6em', borderRadius: '999px', color: c.color, background: `color-mix(in srgb, ${c.color} 16%, transparent)`, cursor: c.go ? 'pointer' : 'default' }}>{c.label}</span>))}</span>}
                  {it.detail && <span style={{ display: 'block', fontSize: '0.68em', opacity: 0.6, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.detail}</span>}
                </span>
              </button>
            ))}
          </div>
        </Fit>
      )}
    </div>
  );
}
