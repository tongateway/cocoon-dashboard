// Cloudflare Pages Function — catches all /api/* routes
// and proxies to the Worker service binding

export async function onRequest(context) {
  const { request, env } = context;

  // If we have a service binding to the Worker, use it
  if (env.API) {
    return env.API.fetch(request);
  }

  // Fallback: proxy to the Worker directly by URL
  const workerUrl = env.WORKER_URL || 'https://cocoon-dashboard-api.reist01.workers.dev';
  const url = new URL(request.url);
  const apiUrl = workerUrl + url.pathname + url.search;

  return fetch(apiUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body,
  });
}
