'use client';

import { ReactNode, useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, X } from 'lucide-react';
import { palette as BI, chartTheme } from '@/lib/palette';

/* ────────────────────────────────────────────────────────────
   Date range — every interactive page shares this one hook so
   "Last 7 days / 30 / Custom" always means the same thing.
   ──────────────────────────────────────────────────────────── */

export type RangeKey = '7' | '30' | '90';

export interface ResolvedRange {
  days: number;
  /** Inclusive UTC-day bounds: [startISO, endISO) for string comparison with API timestamps. */
  startISO: string;
  endISO: string;
  /** Same length immediately BEFORE the current window, for trend deltas. */
  prevStartISO: string;
  prevEndISO: string;
}

export function resolveRange(days: number): ResolvedRange {
  const end = new Date();
  const start = new Date(end.getTime() - (days - 1) * 86400000);
  start.setHours(0, 0, 0, 0);
  const prevEnd = new Date(start.getTime());
  const prevStart = new Date(start.getTime() - days * 86400000);
  const iso = (d: Date) => d.toISOString();
  return {
    days,
    startISO: iso(start),
    endISO: iso(new Date(end.getTime() + 86400000)),
    prevStartISO: iso(prevStart),
    prevEndISO: iso(prevEnd),
  };
}

/** True if an API timestamp falls within [startISO, endISO). */
export function inRange(ts: string | null | undefined, startISO: string, endISO: string): boolean {
  if (!ts) return false;
  const t = new Date(ts).getTime();
  if (isNaN(t)) return false;
  return t >= new Date(startISO).getTime() && t < new Date(endISO).getTime();
}

export function useDateRange(initial: RangeKey = '30') {
  const [range, setRange] = useState<RangeKey>(initial);
  const resolved = useMemo(() => resolveRange(Number(range)), [range]);
  return { range, setRange, resolved };
}

/** The shared 7 / 30 / 90-day switch used at the top of interactive pages. */
export function RangeSwitch({
  value,
  onChange,
}: {
  value: RangeKey;
  onChange: (k: RangeKey) => void;
}) {
  const options: { key: RangeKey; label: string }[] = [
    { key: '7', label: 'Last 7 days' },
    { key: '30', label: 'Last 30 days' },
    { key: '90', label: 'Last 90 days' },
  ];
  return (
    <div className="md-rangebar" role="group" aria-label="Date range">
      <span className="md-rangebar-label">Showing:</span>
      <div className="md-tabs">
        {options.map((o) => (
          <button
            key={o.key}
            className={`md-tab ${value === o.key ? 'active' : ''}`}
            aria-pressed={value === o.key}
            onClick={() => onChange(o.key)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   KPI card with trend vs the previous period of equal length.
   ──────────────────────────────────────────────────────────── */

export function KpiCard({
  label,
  value,
  current,
  previous,
  color,
  hint,
}: {
  label: string;
  value: number | string;
  current: number;
  previous: number;
  color?: string;
  hint?: string;
}) {
  let pct: number | null = null;
  let dir: 'up' | 'down' | 'flat' = 'flat';
  if (previous > 0) {
    pct = ((current - previous) / previous) * 100;
    dir = pct > 0.5 ? 'up' : pct < -0.5 ? 'down' : 'flat';
  } else if (current > 0) {
    dir = 'up';
  }
  const goodUp = color ? color === BI.handled || color === BI.working : true;
  const trendColor =
    dir === 'flat'
      ? BI.neutral
      : (dir === 'up') === goodUp
        ? BI.handled
        : BI.attention;
  return (
    <div className="md-kpi">
      <span className="md-kpi-label">
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <span className="md-kpi-value" style={color ? { color } : undefined}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
      <span className="md-kpi-trend" style={{ color: trendColor }}>
        {dir === 'up' && <TrendingUp size={12} style={{ verticalAlign: -2, marginRight: 3 }} />}
        {dir === 'down' && <TrendingDown size={12} style={{ verticalAlign: -2, marginRight: 3 }} />}
        {dir === 'flat' && <Minus size={12} style={{ verticalAlign: -2, marginRight: 3 }} />}
        {pct === null
          ? dir === 'flat'
            ? 'No change vs previous period'
            : 'New this period'
          : `${Math.abs(Math.round(pct))}% vs previous ${dir === 'up' ? 'more' : 'less'}`}
      </span>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Chart card: consistent shell, subtitle, optional footer note.
   ──────────────────────────────────────────────────────────── */

export function ChartCard({
  title,
  subtitle,
  footer,
  children,
}: {
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="md-chart">
      <h3>{title}</h3>
      {subtitle && <p className="md-chart-sub">{subtitle}</p>}
      {children}
      {footer && <p className="md-chart-foot">{footer}</p>}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Cross-filter chip: shows the active selection, click × clears.
   ──────────────────────────────────────────────────────────── */

export function FilterNote({
  label,
  onClear,
}: {
  label: string;
  onClear: () => void;
}) {
  return (
    <span className="md-filter-note">
      Filtered by: {label}
      <button onClick={onClear} aria-label={`Clear ${label} filter`}>
        <X size={13} />
      </button>
    </span>
  );
}

export { chartTheme };
