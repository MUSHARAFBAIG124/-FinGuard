import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const scriptPath = resolve(fileURLToPath(new URL('../../scripts/seed-dev.ts', import.meta.url)));

describe('development seed safety', () => {
  it('refuses production before database configuration or connection', () => {
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', scriptPath],
      {
        env: {
          ...process.env,
          NODE_ENV: 'production',
          MONGODB_URI: 'mongodb://127.0.0.1:1/should_not_connect',
        },
        encoding: 'utf8',
        timeout: 10_000,
      },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('development seed is disabled when NODE_ENV=production');
  });
});
