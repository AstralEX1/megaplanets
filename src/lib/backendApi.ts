/** One base URL for the Planet, mining, leaderboard, and voucher services. */
const configuredBase = (
  import.meta.env.VITE_BACKEND_API_BASE_URL ?? import.meta.env.VITE_PLANET_API_BASE_URL
)?.trim();

export const BACKEND_API_BASE_URL = configuredBase ?? '';

export function backendApiUrl(path: string, base = BACKEND_API_BASE_URL): string {
  if (!path.startsWith('/')) throw new Error('Backend API paths must start with /.');
  if (!base) return path;
  return new URL(path, base.endsWith('/') ? base : `${base}/`).toString();
}

export function backendApiFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = backendApiUrl(path);
  return init === undefined ? fetch(url) : fetch(url, init);
}
