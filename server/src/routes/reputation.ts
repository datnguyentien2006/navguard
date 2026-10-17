import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getReputation } from '../services/reputation.js';

const bodySchema = z.object({
  urls: z.array(z.string().url()).min(1).max(20)
});

export async function reputationRoutes(app: FastifyInstance) {
  app.post('/v1/reputation', async (req, reply) => {
    try {
      const { urls } = bodySchema.parse(req.body);
      
      const results = await Promise.all(urls.map(url => getReputation(url)));
      
      return { results };
    } catch (err) {
      app.log.error(err);
      return reply.status(400).send({ error: 'Bad Request', details: (err as Error).message });
    }
  });
}
