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

/**
 * Neutral categorical ramp for charts where color carries NO meaning
 * (e.g. "kinds of requests"). Deliberately avoids the status hues
 * (orange/red = urgency, green = handled, blue = in progress) so a bar
 * can never be misread as good/bad.
 */
export const neutralRamp = ['#44403C', '#57534E', '#78716C', '#A8A29E', '#D6D3D1'];

/** Darker green for thin/dashed chart lines — `handled` text green is too pale on paper. */
export const handledLine = '#166534';

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
