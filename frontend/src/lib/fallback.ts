import snapshot from './demoSnapshot.json';

export const fallbackStats = {
  total_leads: 11,
  active_leads: 9,
  missed_leads: 4,
  high_risk_leads: 3,
  pending_followups: 4,
  followups_sent: 13,
  resolved_leads: 2,
  response_rate: 85.2,
  total_emails: 519,
  spam_filtered: 18,
  risk_distribution: { LOW: 3, MEDIUM: 4, HIGH: 2, CRITICAL: 2 },
  pipeline: [
    { stage: "New", count: 5, color: "#f59e0b" },
    { stage: "Missed", count: 4, color: "#ef4444" },
    { stage: "Followed Up", count: 13, color: "#3b82f6" },
    { stage: "Resolved", count: 2, color: "#10b981" },
  ],
  followup_activity: [
    { status: "Sent", count: 13, color: "#3b82f6" },
    { status: "Pending", count: 4, color: "#ef4444" },
  ]
};

export const fallbackLeads = (snapshot.leads || []).map((l: any) => ({
  id: l.id,
  name: l.sender.includes('<') ? l.sender.split('<')[0].trim() : l.sender,
  company: l.sender.includes('@') ? l.sender.split('@')[1].split('.')[0].toUpperCase() : 'Independent',
  email: l.sender.match(/<([^>]+)>/)?.[1] || l.sender,
  sender_raw: l.sender,
  subject: l.subject,
  body: l.body,
  status: l.status || 'new',
  priority: l.priority || 'medium',
  risk: l.priority === 'high' ? 'CRITICAL' : 'MEDIUM',
  risk_score: l.priority === 'high' ? 88 : 55,
  confidence: Math.round(l.confidence || 95),
  intent: l.intent || 'product_inquiry',
  received_at: l.received_at,
  days_waiting: 1,
  message_id: l.message_id || ''
}));

export const fallbackAnalytics = {
  period_days: 30,
  volume_trend: [
    { date: "Oct 01", leads: 3, missed: 1, emails: 38, followed_up: 2 },
    { date: "Oct 02", leads: 4, missed: 0, emails: 42, followed_up: 3 },
    { date: "Oct 03", leads: 2, missed: 1, emails: 35, followed_up: 2 },
    { date: "Oct 04", leads: 5, missed: 2, emails: 51, followed_up: 4 },
    { date: "Oct 05", leads: 3, missed: 0, emails: 46, followed_up: 3 },
    { date: "Oct 06", leads: 6, missed: 1, emails: 58, followed_up: 5 },
    { date: "Oct 07", leads: 4, missed: 1, emails: 49, followed_up: 4 }
  ],
  intent_breakdown: [
    { intent: "pricing/purchase", count: 4 },
    { intent: "meeting/demo", count: 3 },
    { intent: "partnership", count: 2 },
    { intent: "product_inquiry", count: 2 }
  ],
  priority_distribution: [
    { priority: "High", count: 5, color: "#ef4444" },
    { priority: "Medium", count: 4, color: "#f59e0b" },
    { priority: "Low", count: 2, color: "#10b981" }
  ]
};

export const fallbackActivities = [
  {
    id: 1,
    timestamp: new Date().toISOString(),
    actor: "ML Classifier",
    action: "Lead Detected",
    lead_id: 43,
    details: "Inbound inquiry: 'Enterprise Software Pricing Request' from Rajesh Kumar"
  },
  {
    id: 2,
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    actor: "SLA Monitor",
    action: "SLA Countdown Active",
    lead_id: 42,
    details: "Tracking 60-minute window for Demo Request from Sarah Mitchell"
  },
  {
    id: 3,
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    actor: "Gmail Connector",
    action: "Gmail Synced",
    lead_id: null,
    details: "Retrieved real emails from inbox (jaivijai188@gmail.com)"
  }
];
