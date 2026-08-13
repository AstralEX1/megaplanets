import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('Prisma schema public surface', () => {
  it('does not retain wallet-authentication models', async () => {
    const schema = await readFile(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
    expect(schema).not.toMatch(/model\s+(User|AuthNonce|WalletSession)\s*\{/);
  });
});
