import { cors } from 'hono/cors';

/** Parses the exact browser origins allowed to call a split frontend/API deployment. */
export function parseAllowedOrigins(
  env: Record<string, string | undefined>,
): readonly string[] {
  const raw = env.MEGAPLANETS_ALLOWED_ORIGINS?.trim();
  if (!raw) return [];

  const origins = raw.split(',').map((value) => value.trim()).filter(Boolean);
  return [...new Set(origins.map((value) => {
    if (value === '*') throw new Error('MEGAPLANETS_ALLOWED_ORIGINS must not contain a wildcard.');
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new Error('MEGAPLANETS_ALLOWED_ORIGINS must contain valid origins.');
    }
    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      parsed.origin !== value ||
      parsed.username ||
      parsed.password
    ) {
      throw new Error('MEGAPLANETS_ALLOWED_ORIGINS must contain exact http(s) origins.');
    }
    return parsed.origin;
  }))];
}

/** Adds CORS only for explicitly configured origins; empty configuration is same-origin only. */
export function createCorsMiddleware(
  env: Record<string, string | undefined> = process.env,
) {
  const allowedOrigins = new Set(parseAllowedOrigins(env));
  return cors({
    origin: (origin) => (origin && allowedOrigins.has(origin) ? origin : undefined),
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
    maxAge: 600,
  });
}
