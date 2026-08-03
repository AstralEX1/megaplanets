import { Hono } from 'hono';

const app = new Hono();

app.get('/api/planets/health', (c) => c.json({ ok: true, stage: 5 }));

export default app;
