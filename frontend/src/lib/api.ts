const API_BASE = '/api';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    let message = `Request failed: ${res.status}`;
    try {
      const parsed = JSON.parse(body);
      message = parsed.detail || parsed.message || message;
    } catch {
      // use default
    }
    throw new ApiError(message, res.status);
  }

  return res.json();
}

// ─── Stats ───────────────────────────────────────────
export interface DashboardStats {
  total_leads: number;
  active_leads: number;
  missed_leads: number;
  high_risk_leads: number;
  pending_followups: number;
  followups_sent: number;
  resolved_leads: number;
  response_rate: number;
  total_emails: number;
  spam_filtered: number;
  risk_distribution: Record<string, number>;
  pipeline: { stage: string; count: number; color: string }[];
  followup_activity: { status: string; count: number; color: string }[];
}

export function fetchStats(): Promise<DashboardStats> {
  return request('/stats');
}

// ─── Leads ───────────────────────────────────────────
export interface Lead {
  id: number;
  name: string;
  company: string;
  email: string;
  sender_raw: string;
  subject: string;
  body: string;
  status: string;
  priority: string;
  risk: string;
  risk_score: number;
  confidence: number;
  intent: string;
  received_at: string;
  days_waiting: number;
  message_id: string;
}

export interface LeadListResponse {
  items: Lead[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// Urgent = new leads, highest wait time first (used by the Overview triage board)
export function fetchUrgentLeads(): Promise<LeadListResponse> {
  return request('/leads?status=new&limit=100&sort_by=id&order=desc');
}

export function fetchLeads(params?: Record<string, string | number>): Promise<LeadListResponse> {
  const qs = params ? '?' + new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString() : '';
  return request(`/leads${qs}`);
}

export interface LeadDetail {
  overview: Lead & { message_id: string };
  email_timeline: {
    id: number | string;
    sender: string;
    recipient: string;
    subject: string;
    timestamp: string;
    body: string;
    type: string;
  }[];
  ai_intelligence: {
    classification: string;
    confidence: number;
    intent: string;
    priority: string;
    urgency: string;
    risk_score: number;
    risk_level: string;
    detection_reason: string;
  };
  recommendation: {
    recommended_action: string;
    recommended_timing: string;
    suggested_response: string;
    reason: string;
  };
  activity_timeline: {
    id: number;
    timestamp: string;
    actor: string;
    action: string;
    details: string;
  }[];
}

export function fetchLeadDetail(id: number): Promise<LeadDetail> {
  return request(`/leads/${id}`);
}

export function updateLeadStatus(id: number, status: string, reason?: string): Promise<{ success: boolean }> {
  return request(`/leads/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, reason }),
  });
}

// ─── Missed Leads ────────────────────────────────────
export interface MissedLead {
  id: number;
  name: string;
  company: string;
  email: string;
  subject: string;
  received_at: string;
  hours_overdue: number;
  days_waiting: number;
  priority: string;
  risk: string;
  risk_score: number;
  status: string;
  intent: string;
  detection_reason: string;
  recommended_action: string;
  suggested_draft: string;
}

export interface MissedLeadsResponse {
  metrics: {
    total_missed: number;
    critical: number;
    high_risk: number;
    detected_today: number;
    resolved: number;
  };
  items: MissedLead[];
}

export function fetchMissedLeads(params?: Record<string, string>): Promise<MissedLeadsResponse> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return request(`/missed-leads${qs}`);
}

export function triggerSlaCheck(sla_minutes: number = 60): Promise<{ success: boolean; newly_marked_missed: number }> {
  return request('/missed-leads/check', {
    method: 'POST',
    body: JSON.stringify({ sla_minutes }),
  });
}

// ─── Follow-Ups ──────────────────────────────────────
export interface FollowUp {
  id: number;
  lead_id: number;
  lead_name: string;
  company: string;
  email: string;
  subject: string;
  original_subject: string;
  intent: string;
  priority: string;
  status: string;
  scheduled_time: string;
  draft_body: string;
  created_by: string;
}

export interface FollowUpsResponse {
  status: string;
  total: number;
  items: FollowUp[];
}

export function fetchFollowUps(status: string = 'pending'): Promise<FollowUpsResponse> {
  return request(`/follow-ups?status=${status}`);
}

export function sendFollowUp(leadId: number, customMessage?: string): Promise<{ success: boolean }> {
  return request(`/follow-ups/${leadId}/send`, {
    method: 'POST',
    body: JSON.stringify({ custom_message: customMessage }),
  });
}

// ─── Emails ──────────────────────────────────────────
export interface Email {
  id: number;
  sender: string;
  sender_name: string;
  company: string;
  email: string;
  subject: string;
  body: string;
  snippet: string;
  label: string;
  confidence: number;
  intent: string;
  priority: string;
  risk: string;
  status: string;
  received_at: string;
  message_id: string;
}

export interface EmailListResponse {
  items: Email[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export function fetchEmails(params?: Record<string, string | number>): Promise<EmailListResponse> {
  const qs = params ? '?' + new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString() : '';
  return request(`/emails${qs}`);
}

export function fetchEmailDetail(id: number): Promise<Email & { suggested_draft: string | null }> {
  return request(`/emails/${id}`);
}

export function classifyEmail(data: { sender: string; subject: string; body: string }): Promise<{
  prediction: string;
  confidence: number;
  intent: string;
  priority: string;
  suggested_draft: string | null;
}> {
  return request('/emails/classify', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ─── Analytics ───────────────────────────────────────
export interface AnalyticsData {
  period_days: number;
  volume_trend: { date: string; leads: number; missed: number; emails: number; followed_up: number }[];
  intent_breakdown: { intent: string; count: number }[];
  priority_distribution: { priority: string; count: number; color: string }[];
}

export function fetchAnalytics(days: number = 30): Promise<AnalyticsData> {
  return request(`/analytics?days=${days}`);
}

// ─── Automations ─────────────────────────────────────
export interface Automation {
  id: string;
  name: string;
  trigger: string;
  action: string;
  status: string;
  last_run: string;
  next_run: string;
  success_rate: string;
}

export function fetchAutomations(): Promise<Automation[]> {
  return request('/automations');
}

export function triggerAutomation(ruleId: string): Promise<{ success: boolean; message: string }> {
  return request(`/automations/${ruleId}/run`, { method: 'POST' });
}

// ─── Activity ────────────────────────────────────────
export interface Activity {
  id: number;
  timestamp: string;
  actor: string;
  action: string;
  lead_id: number | null;
  details: string;
}

export function fetchActivity(limit: number = 50): Promise<Activity[]> {
  return request(`/activity?limit=${limit}`);
}

// ─── Settings ────────────────────────────────────────
export interface Settings {
  email_account: {
    provider: string;
    status: string;
    last_sync: string;
    auto_sync_enabled: boolean;
  };
  sla_threshold_minutes: number;
  ai_model: {
    name: string;
    status: string;
    version: string;
    features: string;
  };
  notifications: {
    email_alerts: boolean;
    slack_webhook: boolean;
    notify_on_critical_missed: boolean;
  };
}

export function fetchSettings(): Promise<Settings> {
  return request('/settings');
}

export function updateSettings(data: Record<string, unknown>): Promise<{ success: boolean }> {
  return request('/settings', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function fetchGmailStatus(): Promise<{ connected: boolean; status: string }> {
  return request('/gmail/status');
}

export interface SyncStatus {
  is_syncing: boolean;
  status: 'idle' | 'running' | 'completed' | 'failed';
  current: number;
  total: number;
  processed: number;
  message: string;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
}

export function fetchSyncStatus(): Promise<SyncStatus> {
  return request('/gmail/sync/status');
}

export function triggerGmailSync(maxResults: number = 500): Promise<{ success: boolean; status: string; message: string; is_syncing: boolean }> {
  return request(`/gmail/sync?max_results=${maxResults}`, {
    method: 'POST',
  });
}

// Keep syncGmail for backwards compatibility
export function syncGmail(maxResults: number = 500): Promise<{ success: boolean; status: string; message: string; is_syncing: boolean }> {
  return triggerGmailSync(maxResults);
}

export function injectDemoData(count?: number): Promise<{ success: boolean; injected_count: number }> {
  const qs = count ? `?count=${count}` : '';
  return request(`/simulate/inject${qs}`, { method: 'POST' });
}
