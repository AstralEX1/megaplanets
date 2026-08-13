import { readFile, readdir } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('frontend backend surface', () => {
  it('has no consumers of the removed wallet-authentication endpoints', async () => {
    const sourceRoot = new URL('../src/', import.meta.url);
    const sourceFiles: URL[] = [];
    const visit = async (directory: URL): Promise<void> => {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);
        if (entry.isDirectory()) await visit(path);
        else if (/\.(?:ts|tsx|js|jsx)$/.test(entry.name)) sourceFiles.push(path);
      }
    };
    await visit(sourceRoot);
    const source = await Promise.all(sourceFiles.map((file) => readFile(file, 'utf8')));
    const joined = source.join('\n');
    expect(joined).not.toMatch(/\/api\/(?:auth|me(?:\/planets|\/mining)?)(?:["'`?]|\b)/);
  });
});
