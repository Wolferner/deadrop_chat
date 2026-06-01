import Fastify from 'fastify';

const app = Fastify({ logger: true });

app.get('/', async () => {
  return { status: 'ok' };
});

const host = process.env['HOST'] ?? '0.0.0.0';
const port = Number(process.env['PORT'] ?? 3000);

await app.listen({ host, port });
