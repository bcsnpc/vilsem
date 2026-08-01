async function apiKeyAuth(request, reply) {
  if (request.url === '/health') return;

  const apiKey = request.headers['x-api-key'];
  const validKey = process.env.API_KEY;

  if (!apiKey || apiKey !== validKey) {
    reply.code(401).send({
      error: 'UNAUTHORIZED',
      message: 'Invalid or missing API key',
    });
  }
}

module.exports = { apiKeyAuth };
