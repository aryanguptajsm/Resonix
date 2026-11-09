import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { handleRemixPlanRequest } from './server/remixPlan.js'

function remixPlanDevPlugin() {
  return {
    name: 'resonix-remix-plan-dev',
    configureServer(server) {
      server.middlewares.use('/api/remix-plan', async (request, response) => {
        if (request.method !== 'POST') {
          response.statusCode = 405;
          response.setHeader('Allow', 'POST');
          response.end(JSON.stringify({ error: 'Only POST requests are supported.' }));
          return;
        }

        let body = '';
        for await (const chunk of request) {
          body += chunk;
          if (body.length > 16_384) {
            response.statusCode = 413;
            response.end(JSON.stringify({ error: 'The remix request is too large.' }));
            return;
          }
        }

        let input;
        try {
          input = JSON.parse(body);
        } catch {
          response.statusCode = 400;
          response.end(JSON.stringify({ error: 'The remix request must contain valid JSON.' }));
          return;
        }

        const result = await handleRemixPlanRequest(input, process.env.GEMINI_API_KEY);
        response.statusCode = result.status;
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify(result.body));
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (!process.env.GEMINI_API_KEY && env.GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;
  }

  return {
    base: './',
    plugins: [react(), remixPlanDevPlugin()],
    server: {
      port: 3000,
      open: true,
    },
  };
});
