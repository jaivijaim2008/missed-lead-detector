'use client';

import { useApi } from '@/lib/hooks';
import { fetchAnalytics, AnalyticsData } from '@/lib/api';
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

// Semantic, consistent with the rest of the app: blue = working, orange = attention, green = handled.
const INTENT_COLORS = ['#1D4ED8', '#C2410C', '#15803D', '#B45309', '#9A3412', '#57534E', '#78716C'];
const PRIORITY_COLORS: Record<string, string> = {
  high: '#C2410C',
  medium: '#B45309',
  low: '#15803D',
};

export default function AnalyticsPage() {
  const { data, loading, error, refetch } = useApi<AnalyticsData>(() => fetchAnalytics(30));

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

  const tooltipStyle = {
    background: '#FFFFFF',
    border: '1px solid #E3DED4',
    borderRadius: 8,
    fontSize: 12.5,
    color: '#1C1917',
    boxShadow: '0 4px 14px rgba(28, 25, 23, 0.08)',
  };

  return (
    <div className="md-theme">
      <header className="md-pagehead">
        <div>
          <h1>Trends</h1>
          <p className="md-pagehead-sub">
            The last {data.period_days} days — how busy your inbox was, and how much was won back
          </p>
        </div>
      </header>

      <div className="md-pagebody" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Volume trend */}
        <div className="md-chart">
          <h3>What your inbox looked like</h3>
          <p className="md-chart-sub">
            Real leads found each day, leads that slipped past, and follow-ups that went out
          </p>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data.volume_trend}>
              <defs>
                <linearGradient id="mdLeads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1D4ED8" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#1D4ED8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="mdMissed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#C2410C" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#C2410C" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fill: '#78716C', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(d: string) => {
                  const date = new Date(d);
                  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                }}
              />
              <YAxis tick={{ fill: '#78716C', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="leads" stroke="#1D4ED8" fill="url(#mdLeads)" strokeWidth={2} name="Real leads found" />
              <Area type="monotone" dataKey="missed" stroke="#C2410C" fill="url(#mdMissed)" strokeWidth={2} name="Slipped past" />
              <Area type="monotone" dataKey="followed_up" stroke="#15803D" fill="none" strokeWidth={1.5} strokeDasharray="4 2" name="Follow-ups sent" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          {/* Intent breakdown */}
          <div className="md-chart">
            <h3>What people are asking for</h3>
            <p className="md-chart-sub">Why your leads reached out</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.intent_breakdown} barSize={26}>
                <XAxis
                  dataKey="intent"
                  tick={{ fill: '#78716C', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis tick={{ fill: '#78716C', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Leads">
                  {data.intent_breakdown.map((_, idx) => (
                    <Cell key={idx} fill={INTENT_COLORS[idx % INTENT_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Priority distribution */}
          <div className="md-chart">
            <h3>How urgent they are</h3>
            <p className="md-chart-sub">Who needs a reply fastest</p>
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
                    strokeWidth={0}
                  >
                    {data.priority_distribution.map((entry, idx) => (
                      <Cell key={idx} fill={PRIORITY_COLORS[entry.priority] ?? '#78716C'} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {data.priority_distribution.map((item) => (
                  <div key={item.priority} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5 }}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 3,
                        background: PRIORITY_COLORS[item.priority] ?? '#78716C',
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ color: 'var(--md-pencil-deep)', minWidth: 90 }}>
                      {item.priority === 'high' ? 'Reply now' : item.priority === 'medium' ? 'Soon' : 'Can wait'}
                    </span>
                    <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--md-font-display)' }}>
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
