'use client';

import { useState } from 'react';
import { useApi } from '@/lib/hooks';
import { fetchAnalytics, AnalyticsData } from '@/lib/api';
import { palette as BI, chartTheme } from '@/lib/palette';
import { useDateRange, RangeSwitch, KpiCard, ChartCard, FilterNote } from '@/lib/bi';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
} from 'recharts';

const INTENT_COLORS = [BI.working, BI.attention, BI.handled, BI.pending, BI.tense, BI.system, BI.neutral];

// API sends "High Priority" / "Medium Priority" / "Low Priority" — normalize.
function priorityKey(p: string): 'high' | 'medium' | 'low' {
  const s = (p || '').toLowerCase();
  return s.startsWith('high') ? 'high' : s.startsWith('medium') ? 'medium' : 'low';
}

const PRIORITY_COLORS: Record<string, string> = { high: BI.attention, medium: BI.pending, low: BI.handled };
const PRIORITY_LABEL: Record<string, string> = { high: 'Reply now', medium: 'Soon', low: 'Can wait' };

function friendlyIntent(intent: string): string {
  const map: Record<string, string> = {
    product_inquiry: 'Product question',
    'pricing/purchase': 'Pricing / buying',
    'meeting/demo': 'Meeting or demo',
    partnership: 'Partnership',
    general: 'General question',
    other: 'Something else',
  };
  return map[intent] ?? intent;
}

export default function AnalyticsPage() {
  const { range, setRange, resolved } = useDateRange('30');
  const days = range === '7' ? 7 : range === '30' ? 30 : 90;
  const { data, loading, error, refetch } = useApi<AnalyticsData>(() => fetchAnalytics(days), [range]);
  const { data: analytics2x } = useApi<AnalyticsData>(() => fetchAnalytics(days * 2), [range]);

  const [intentFocus, setIntentFocus] = useState<string | null>(null);
  const [priorityFocus, setPriorityFocus] = useState<string | null>(null);

  if (loading && !data) {
    return (
      <div className="md-theme">
        <header className="md-pagehead">
          <div>
            <h1>Trends</h1>
            <p className="md-pagehead-sub">Loading…</p>
          </div>
        </header>
        <div className="md-pagebody">
          <div className="md-loadrow" style={{ height: 280 }} />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="md-theme">
        <header className="md-pagehead">
          <div>
            <h1>Trends</h1>
            <p className="md-pagehead-sub">Something went wrong</p>
          </div>
        </header>
        <div className="md-pagebody">
          <div className="md-error">
            <strong>Couldn’t load your numbers</strong>
            <span>Check that LeadGuard’s engine is running, then try again.</span>
            <code>cd app &amp;&amp; python api_server.py</code>
            <div>
              <button className="md-btn md-btn-primary md-btn-md" onClick={refetch}>Try again</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const sum = (key: 'leads' | 'missed' | 'followed_up' | 'emails', d: AnalyticsData | null) =>
    d ? d.volume_trend.slice(-days).reduce((s, r) => s + (r[key] ?? 0), 0) : 0;

  const kpis = [
    { label: 'Leads found', hint: 'in this period', cur: sum('leads', data), prev: sum('leads', analytics2x), color: BI.working },
    { label: 'Slipped past', hint: 'no reply in time', cur: sum('missed', data), prev: sum('missed', analytics2x), color: BI.attention },
    { label: 'Follow-ups sent', hint: 'in this period', cur: sum('followed_up', data), prev: sum('followed_up', analytics2x), color: BI.handled },
    { label: 'Emails read', hint: 'in this period', cur: sum('emails', data), prev: sum('emails', analytics2x), color: undefined },
  ];

  const totalIntents = data.intent_breakdown.reduce((s, r) => s + r.count, 0);
  const totalPriority = data.priority_distribution.reduce((s, r) => s + r.count, 0);
  const focusedIntent = data.intent_breakdown.find((r) => r.intent === intentFocus);
  const focusedPriority = data.priority_distribution.find((r) => priorityKey(r.priority) === priorityFocus);

  return (
    <div className="md-theme">
      <header className="md-pagehead">
        <div>
          <h1>Trends</h1>
          <p className="md-pagehead-sub">
            The last {resolved.days} days — how busy your inbox was, and how much was won back
          </p>
        </div>
      </header>

      <div className="md-pagebody" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 4 }}>
          <RangeSwitch value={range} onChange={(k) => { setRange(k); setIntentFocus(null); setPriorityFocus(null); }} />
          {intentFocus && (
            <FilterNote label={intentFocus} onClear={() => setIntentFocus(null)} />
          )}
          {priorityFocus && (
            <FilterNote label={PRIORITY_LABEL[priorityFocus] ?? priorityFocus} onClear={() => setPriorityFocus(null)} />
          )}
        </div>

        {/* KPI row with trends */}
        <div className="md-kpis">
          {kpis.map((k) => (
            <KpiCard
              key={k.label}
              label={k.label}
              hint={k.hint}
              value={k.cur.toLocaleString()}
              current={k.cur}
              previous={k.prev}
              color={k.color}
            />
          ))}
        </div>

        {/* Volume trend */}
        <ChartCard
          title="What your inbox looked like"
          subtitle="Real leads found each day, leads that slipped past, and follow-ups that went out — hover for exact daily numbers"
        >
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.volume_trend}>
                <defs>
                  <linearGradient id="mdAnLeads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={BI.working} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={BI.working} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="mdAnMissed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={BI.attention} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={BI.attention} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={chartTheme.axisTick}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(d) => new Date(String(d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis tick={chartTheme.axisTick} axisLine={false} tickLine={false} width={30} />
                <Tooltip
                  contentStyle={chartTheme.tooltip}
                  labelFormatter={(d) => new Date(String(d)).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                />
                <Area type="monotone" dataKey="leads" name="Leads found" stroke={BI.working} fill="url(#mdAnLeads)" strokeWidth={2} />
                <Area type="monotone" dataKey="missed" name="Slipped past" stroke={BI.attention} fill="url(#mdAnMissed)" strokeWidth={2} />
                <Area type="monotone" dataKey="followed_up" name="Follow-ups sent" stroke={BI.handled} fill="none" strokeWidth={1.5} strokeDasharray="4 2" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          {/* Intent breakdown — click to focus */}
          <ChartCard
            title="What people are asking for"
            subtitle="Click a bar to focus — hover for exact counts"
            footer={
              focusedIntent
                ? `${intentFocus}: ${focusedIntent.count} of ${totalIntents} leads (${totalIntents ? Math.round((focusedIntent.count / totalIntents) * 100) : 0}%). Click again or clear to see everything.`
                : `${totalIntents} leads in this period across ${data.intent_breakdown.length} kinds of requests`
            }
          >
            {data.intent_breakdown.length === 0 ? (
              <div className="empty-state" style={{ padding: '30px 0' }}><span>No leads in this period</span></div>
            ) : (
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.intent_breakdown} barSize={26}>
                    <XAxis
                      dataKey="intent"
                      tickFormatter={(v) => friendlyIntent(String(v))}
                      tick={{ ...chartTheme.axisTick, fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      angle={-15}
                      textAnchor="end"
                    />
                    <YAxis tick={chartTheme.axisTick} axisLine={false} tickLine={false} width={28} />
                    <Tooltip
                      contentStyle={chartTheme.tooltip}
                      cursor={{ fill: 'rgba(28,25,23,0.04)' }}
                      formatter={(value, name) => [`${value} lead${Number(value) === 1 ? '' : 's'}`, String(name)]}
                    />
                    <Bar
                      dataKey="count"
                      radius={[4, 4, 0, 0]}
                      className="md-chart-bar-link"
                      onClick={(d: unknown) => {
                        const k = (d as { intent?: string })?.intent ?? (d as { payload?: { intent?: string } })?.payload?.intent;
                        if (k) setIntentFocus((f) => (f === k ? null : k));
                      }}
                    >
                      {data.intent_breakdown.map((row, idx) => (
                        <Cell
                          key={idx}
                          fill={INTENT_COLORS[idx % INTENT_COLORS.length]}
                          opacity={!intentFocus || intentFocus === row.intent ? 1 : 0.3}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>

          {/* Priority distribution — click to focus */}
          <ChartCard
            title="How urgent they are"
            subtitle="Click a slice to focus — hover for exact counts"
            footer={
              focusedPriority
                ? `${PRIORITY_LABEL[focusedPriority.priority] ?? focusedPriority.priority}: ${focusedPriority.count} of ${totalPriority} leads (${totalPriority ? Math.round((focusedPriority.count / totalPriority) * 100) : 0}%).`
                : `${totalPriority} leads in this period`
            }
          >
            {data.priority_distribution.length === 0 ? (
              <div className="empty-state" style={{ padding: '30px 0' }}><span>No leads in this period</span></div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie
                      data={data.priority_distribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      dataKey="count"
                      nameKey="priority"
                      strokeWidth={0}
                      className="md-chart-bar-link"
                      onClick={(d: unknown) => {
                        const k = (d as { priority?: string })?.priority ?? (d as { payload?: { priority?: string } })?.payload?.priority;
                        if (k) setPriorityFocus((f) => (f === priorityKey(k) ? null : priorityKey(k)));
                      }}
                    >
                      {data.priority_distribution.map((row, idx) => (
                        <Cell
                          key={idx}
                          fill={PRIORITY_COLORS[priorityKey(row.priority)] ?? BI.neutral}
                          opacity={!priorityFocus || priorityFocus === priorityKey(row.priority) ? 1 : 0.3}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={chartTheme.tooltip}
                      formatter={(value, name) => [
                        `${value} lead${Number(value) === 1 ? '' : 's'}`,
                        PRIORITY_LABEL[priorityKey(String(name))] ?? String(name),
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {data.priority_distribution.map((item) => (
                    <button
                      key={item.priority}
                      onClick={() => setPriorityFocus((f) => (f === priorityKey(item.priority) ? null : priorityKey(item.priority)))}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5,
                        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                        color: 'var(--md-ink)', fontFamily: 'var(--md-font-ui)',
                        opacity: !priorityFocus || priorityFocus === priorityKey(item.priority) ? 1 : 0.45,
                      }}
                    >
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: PRIORITY_COLORS[priorityKey(item.priority)] ?? BI.neutral, flexShrink: 0 }} />
                      <span style={{ color: 'var(--md-pencil-deep)', minWidth: 90 }}>{PRIORITY_LABEL[priorityKey(item.priority)] ?? item.priority}</span>
                      <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--md-font-display)' }}>
                        {item.count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </ChartCard>
        </div>
      </div>
    </div>
  );
}
