import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { initDb } from './db/index.js';
import { reputationRoutes } from './routes/reputation.js';

const app = Fastify({ logger: true });

async function start() {
  try {
    // 1. Kết nối DB
    await initDb();

    // 2. Cấu hình CORS
    await app.register(cors, { origin: '*' });

    // 3. Đăng ký routes
    await app.register(reputationRoutes);

    // 4. Health check
    app.get('/health', async () => ({ status: 'ok' }));

    // 5. Khởi động
    const port = parseInt(process.env.PORT || '3000', 10);
    await app.listen({ port, host: '0.0.0.0' });
    console.log(`[Server] Listening on http://localhost:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
