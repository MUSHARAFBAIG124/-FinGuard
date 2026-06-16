import { describe, expect, it } from 'vitest';

import { PasswordService, passwordPolicySchema } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('enforces the configured password policy', () => {
    expect(() => passwordPolicySchema.parse('Short1!')).toThrow(/at least 12/);
    expect(() => passwordPolicySchema.parse('lowercase123!')).toThrow(/uppercase/);
    expect(() => passwordPolicySchema.parse('UPPERCASE123!')).toThrow(/lowercase/);
    expect(() => passwordPolicySchema.parse('NoNumbersHere!')).toThrow(/number/);
    expect(() => passwordPolicySchema.parse('NoSpecial12345')).toThrow(/special/);
    expect(() => passwordPolicySchema.parse('StrongPass123!')).not.toThrow();
  });

  it('hashes and verifies passwords with bcrypt', async () => {
    const hash = await service.hash('StrongPass123!');

    expect(hash).not.toBe('StrongPass123!');
    await expect(service.verify('StrongPass123!', hash)).resolves.toBe(true);
    await expect(service.verify('WrongPass123!', hash)).resolves.toBe(false);
  });
});
