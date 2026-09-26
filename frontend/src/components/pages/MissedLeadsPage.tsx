'use client';

import { useState } from 'react';
import { useApi, riskColor, formatRelativeTime } from '@/lib/hooks';
import { fetchMissedLeads, triggerSlaCheck, sendFollowUp, MissedLeadsResponse } from '@/lib/api';
import TopBar from '@/components/TopBar';
import { AlertTriangle, Clock, ShieldAlert, CheckCircle, Zap, Send } from 'lucide-react';

export default function MissedLeadsPage() {
  const [riskFilter, setRiskFilter] = useState('all');
  const [sending, setSending] = useState<number | null>(null);

  const { data, loading, refetch } = useApi<MissedLeadsResponse>(
    () => fetchMissedLeads(riskFilter !== 'all' ? { risk: riskFilter } : undefined),
    [riskFilter]
  );

  const handleSlaCheck = async () => {
    await triggerSlaCheck(60);
    refetch();
  };

  const handleSendFollowUp = async (leadId: number) => {
    setSending(leadId);
    try {
      await sendFollowUp(leadId);
      refetch();
    } finally {
      setSending(null);
    }
  };

  const metrics = data?.metrics;

  return (
    <div className="fade-in">
      <TopBar
        title="Missed Leads"
        subtitle={metrics ? `${metrics.total_missed} unresolved` : 'Loading…'}
        onRefresh={refetch}
        actions={
          <button className="btn btn-primary btn-sm" onClick={handleSlaCheck}>
            <Zap size={13} /> Run SLA Check
          </button>
        }
      />

      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Metric Cards */}
        {metrics && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
            <div className="stat-card">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="stat-label">Total Missed</span>
                <AlertTriangle size={15} color="#ef4444" style={{ opacity: 0.7 }} />
              </div>
              <span className="stat-value">{metrics.total_missed}</span>
            </div>
            <div className="stat-card">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="stat-label">Critical</span>
                <ShieldAlert size={15} color="#ef4444" style={{ opacity: 0.7 }} />
              </div>
              <span className="stat-value" style={{ color: '#ef4444' }}>{metrics.critical}</span>
            </div>
            <div className="stat-card">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="stat-label">Detected Today</span>
                <Clock size={15} color="#f59e0b" style={{ opacity: 0.7 }} />
              </div>
              <span className="stat-value">{metrics.detected_today}</span>
            </div>
            <div className="stat-card">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="stat-label">Resolved</span>
                <CheckCircle size={15} color="#10b981" style={{ opacity: 0.7 }} />
              </div>
              <span className="stat-value" style={{ color: '#10b981' }}>{metrics.resolved}</span>
            </div>
          </div>
        )}

        {/* Filter */}
        <div style={{ display: 'flex', gap: 10 }}>
          <select className="select" value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}>
            <option value="all">All Risk Levels</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>

        {/* Missed Leads List */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 120, borderRadius: 'var(--radius-lg)' }} />
            ))}
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="card empty-state">
            <CheckCircle size={32} color="var(--success)" />
            <p style={{ fontSize: 14 }}>No missed leads! All leads have been addressed.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.items.map((lead) => (
              <div
                key={lead.id}
                className="card"
                style={{
                  borderLeft: `3px solid ${riskColor(lead.risk)}`,
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 16,
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{lead.name}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>· {lead.company}</span>
                    <span className={`badge ${lead.risk === 'CRITICAL' ? 'badge-danger' : lead.risk === 'HIGH' ? 'badge-warning' : 'badge-neutral'}`}>
                      {lead.risk}
                    </span>
                    <span className="badge badge-info">{lead.intent}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    {lead.subject}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    Overdue: {lead.hours_overdue}h · Risk Score: {lead.risk_score}/100 · {formatRelativeTime(lead.received_at)}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6, minWidth: 140 }}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleSendFollowUp(lead.id)}
                    disabled={sending === lead.id}
                  >
                    <Send size={12} />
                    {sending === lead.id ? 'Sending…' : 'Send Follow-Up'}
                  </button>
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)', textAlign: 'center' }}>
                    {lead.recommended_action}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
