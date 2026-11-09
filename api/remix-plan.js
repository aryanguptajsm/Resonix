import { handleRemixPlanRequest } from '../server/remixPlan.js';

export default async function remixPlan(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Only POST requests are supported.' });
  }

  const result = await handleRemixPlanRequest(req.body, process.env.GEMINI_API_KEY);
  return res.status(result.status).json(result.body);
}
