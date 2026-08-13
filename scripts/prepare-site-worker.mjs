import { mkdir, writeFile } from 'node:fs/promises';

const workerPath = new URL('../dist/server/index.js', import.meta.url);

const workerSource = `const isAssetPath = (pathname) => pathname.includes('.') && !pathname.endsWith('/');

export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    const pathname = new URL(request.url).pathname;

    if (response.status !== 404 || isAssetPath(pathname)) return response;

    return env.ASSETS.fetch(new Request(new URL('/', request.url), {
      headers: request.headers,
      method: 'GET',
    }));
  },
};
`;

await mkdir(new URL('../dist/server/', import.meta.url), { recursive: true });
await writeFile(workerPath, workerSource);
