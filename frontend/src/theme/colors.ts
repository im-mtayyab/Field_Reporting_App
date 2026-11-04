/** Application color palette. */
export const colors = {
  primary: '#004280',
  secondary: '#F9BE57',
  accent: '#F9BE57',

  text: '#2C3E50',
  textSoft: '#778591',
  muted: '#556677',
  mutedSoft: '#9EA8B2',

  white: '#FFFFFF',
  surface: '#F4F4F6',
  surfaceAlt: '#F0F2F8',

  border: '#EAECEE',
  borderStrong: '#C0C8D1',

  header: '#1E3A5F',
  footer: '#07295D',
  footerBar: '#1E3A5F',
  radialEdge: '#151515',

  // Status chips
  statusPendingBg: '#E8EEF4',
  statusPendingText: '#556677',
  statusUploadingBg: '#F9BE57',
  statusUploadingText: '#2C3E50',
  statusDeliveredBg: '#D1FAE5',
  statusDeliveredText: '#065F46',
  statusFailedBg: '#FEE2E2',
  statusFailedText: '#991B1B',
} as const;

export type ColorName = keyof typeof colors;
