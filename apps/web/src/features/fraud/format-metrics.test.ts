import { describe, expect, it } from 'vitest';

import { formatHours } from './format-metrics';

describe('formatHours', () => {
  it('renders missing and non-finite timing values as an em dash', () => {
    expect(formatHours(null)).toBe('—');
    expect(formatHours(undefined)).toBe('—');
    expect(formatHours(Number.NaN)).toBe('—');
    expect(formatHours(Number.POSITIVE_INFINITY)).toBe('—');
  });

  it('formats finite timing values in hours', () => {
    expect(formatHours(0)).toBe('0.0 h');
    expect(formatHours(2.25)).toBe('2.3 h');
  });
});
