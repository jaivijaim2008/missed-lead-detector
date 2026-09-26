'use client';

import { useState } from 'react';
import { useApi } from '@/lib/hooks';
import { fetchFollowUps, sendFollowUp, FollowUpsResponse } from '@/lib/api';
import TopBar from '@/components/TopBar';
import { Send, Clock, CheckCircle, AlertCircle } from 'lucide-react';

const tabs = [
  { key: 'pending', label: 'Pending', icon: AlertCircle },
  { key: 'sent', label: 'Sent', icon: CheckCircle },
  { key: 'upcoming', label: 'Scheduled', icon: Clock },
];

export default function FollowUpsPage() {
  const [activeTab, setActiveTab] = useState('pending');
  const [sending, setSending] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data, loading, refetch } = useApi<FollowUpsResponse>(
    () => fetchFollowUps(activeTab),
    [activeTab]
  );

  const handleSend = async (leadId: number) => {
    setSending(leadId);
    try {
      await sendFollowUp(leadId);
      refetch();
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="fade-in">
      <TopBar title="Follow-Ups" subtitle={data ? `${data.total} ${activeTab}` : 'Loading…'} onRefresh={refetch} />

      <div style={{ padding: 24 }}>
        {/* Tabs */}
        <div className="tab-bar" style={{ marginBottom: 20 }}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                className={`tab-item ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                <Icon size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* List */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 80, borderRadius: 'var(--radius-lg)' }} />
            ))}
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="card empty-state">
            <CheckCircle size={28} color="var(--success)" />
            <p>No follow-ups in this category.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.items.map((item) => (
              <div key={item.id} className="card card-sm" style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{item.lead_name}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>· {item.company}</span>
                      <span className={`badge ${item.status === 'Sent' ? 'badge-success' : item.status === 'Pending' ? 'badge-danger' : 'badge-info'}`}>
                        {item.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      {item.subject}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                      {item.email} · {item.created_by}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                    >
                      {expandedId === item.id ? 'Hide Draft' : 'View Draft'}
                    </button>
                    {item.status === 'Pending' && (
                      <button
                        className="btn btn-primary btn-xs"
                        onClick={() => handleSend(item.lead_id)}
                        disabled={sending === item.lead_id}
                      >
                        <Send size={11} />
                        {sending === item.lead_id ? 'Sending…' : 'Send'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Draft */}
                {expandedId === item.id && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: 16,
                      background: 'var(--bg-surface-raised)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-default)',
                      fontSize: 13,
                      color: 'var(--text-secondary)',
                      whiteSpace: 'pre-wrap',
                      lineHeight: 1.6,
                    }}
                  >
                    {item.draft_body}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
