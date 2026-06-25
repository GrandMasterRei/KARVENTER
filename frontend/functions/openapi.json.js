const BACKEND_ORIGIN = 'https://advertiser-valley-anderson-seat.trycloudflare.com';

export async function onRequest({ request }) {
  const targetUrl = new URL('/openapi.json', BACKEND_ORIGIN.replace(/\/$/, ''));
  targetUrl.search = new URL(request.url).search;

  const response = await fetch(targetUrl.toString(), {
    method: request.method,
    headers: request.headers,
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
