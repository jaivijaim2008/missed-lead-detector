/**
 * LeadGuard BI palette — ONE fixed set of meanings used on every page,
 * in every badge, chart bar, pie slice and sparkline. Muted, corporate,
 * high-contrast on the paper background. Never pick ad-hoc colors.
 */
export const BI = {
  attention: '#C2410C', // needs follow-up now / slipped past
  tense: '#B91C1C', // critical breaches only
  working: '#1D4ED8', // in progress / new activity
  handled: '#15803D', // handled / won back
  pending: '#B45309', // scheduled / waiting its turn
  neutral: '#78716C', // junk / housekeeping
  system: '#6D28D9', // automations & system events (sparing)
  ink: '#1C1917', // text / axis
} as const;

/** Category → color, the single source of truth for status colors everywhere. */
export const categoryColor: Record<string, string> = {
  // Needs follow-up now
  attention: BI.attention,
  critical: BI.tense,
  high: BI.attention,
  // In progress
  working: BI.working,
  new: BI.working,
  // Handled
  handled: BI.handled,
  resolved: BI.handled,
  // Waiting its turn
  pending: BI.pending,
  scheduled: BI.pending,
  medium: BI.pending,
  // Junk / other
  neutral: BI.neutral,
  spam: BI.neutral,
  low: BI.handled,
};

export function colorFor(category: string): string {
  return categoryColor[category.toLowerCase()] ?? BI.neutral;
}

/** Shared Recharts styling so every chart looks like the same report. */
export const chartTheme = {
  axisTick: { fill: BI.neutral, fontSize: 11 },
  gridStroke: '#E7E2D8',
  tooltip: {
    background: '#FFFFFF',
    border: '1px solid #E3DED4',
    borderRadius: 8,
    fontSize: 12.5,
    color: BI.ink,
    boxShadow: '0 4px 14px rgba(28, 25, 23, 0.08)',
  },
  tooltipItem: { padding: '1px 0' },
} as const;

export { BI as palette };
