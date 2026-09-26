'use client';

import { useApi } from '@/lib/hooks';
import { fetchAnalytics, AnalyticsData } from '@/lib/api';
import TopBar from '@/components/TopBar';
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

const INTENT_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#ec4899', '#6366f1'];

export default function AnalyticsPage() {
  const { data, loading, refetch } = useApi<AnalyticsData>(() => fetchAnalytics(30));

  if (loading || !data) {
    return (
      <div>
        <TopBar title="Analytics" subtitle="Loading…" />
        <div style={{ padding: 24 }}>
          <div className="skeleton" style={{ height: 300, borderRadius: 'var(--radius-lg)', marginBottom: 16 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="skeleton" style={{ height: 240, borderRadius: 'var(--radius-lg)' }} />
            <div className="skeleton" style={{ height: 240, borderRadius: 'var(--radius-lg)' }} />
          </div>
        </div>
      </div>
    );
  }

  const tooltipStyle = {
    background: '#1e293b',
    border: '1px solid rgba(148,163,184,0.15)',
    borderRadius: 6,
    fontSize: 12,
    color: '#f1f5f9',
  };

  return (
    <div className="fade-in">
      <TopBar title="Analytics" subtitle={`Last ${data.period_days} days`} onRefresh={refetch} />

      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Volume Trend */}
        <div className="card">
          <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: 'var(--text-secondary)' }}>
            Email & Lead Volume Trend
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data.volume_trend}>
              <defs>
                <linearGradient id="gradLeads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradMissed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(d: string) => {
                  const date = new Date(d);
                  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                }}
              />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="leads" stroke="#3b82f6" fill="url(#gradLeads)" strokeWidth={2} name="Leads" />
              <Area type="monotone" dataKey="missed" stroke="#ef4444" fill="url(#gradMissed)" strokeWidth={2} name="Missed" />
              <Area type="monotone" dataKey="followed_up" stroke="#10b981" fill="none" strokeWidth={1.5} strokeDasharray="4 2" name="Followed Up" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Intent Breakdown */}
          <div className="card">
            <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: 'var(--text-secondary)' }}>
              Lead Intent Breakdown
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.intent_breakdown} barSize={28}>
                <XAxis
                  dataKey="intent"
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Count">
                  {data.intent_breakdown.map((_, idx) => (
                    <Cell key={idx} fill={INTENT_COLORS[idx % INTENT_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Priority Distribution */}
          <div className="card">
            <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: 'var(--text-secondary)' }}>
              Priority Distribution
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
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
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {data.priority_distribution.map((item) => (
                  <div key={item.priority} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: item.color, flexShrink: 0 }} />
                    <span style={{ color: 'var(--text-secondary)', minWidth: 100 }}>{item.priority}</span>
                    <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{item.count}</span>
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
