export type TimestampInput = string | Date | null | undefined;

export const parseTimestampMilliseconds = (value: TimestampInput): number | null => {
  if (value === undefined || value === null || value === '') return null;
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
};
