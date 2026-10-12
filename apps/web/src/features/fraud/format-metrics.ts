export const formatHours = (value: number | null | undefined): string =>
  typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(1)} h` : '—';
