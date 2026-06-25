const BACKEND_ORIGIN = 'https://entered-oliver-selecting-sender.trycloudflare.com/api/users';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function onRequest({ request, params }) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const incomingUrl = new URL(request.url);
  const rawPath = params.path;
  const parts = Array.isArray(rawPath) ? rawPath : rawPath ? [rawPath] : [];
  const path = parts.join('/');

  let backendPath;
  if (path === 'docs') {
    backendPath = '/docs';
  } else if (path === 'openapi.json') {
    backendPath = '/openapi.json';
  } else {
    backendPath = `/api/${path}`;
  }

  const targetUrl = new URL(backendPath, BACKEND_ORIGIN.replace(/\/$/, ''));
  targetUrl.search = incomingUrl.search;

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('origin');

  const response = await fetch(targetUrl.toString(), {
    method: request.method,
    headers,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    redirect: 'manual',
  });

  const responseHeaders = new Headers(response.headers);
  Object.entries(corsHeaders()).forEach(([key, value]) => responseHeaders.set(key, value));

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}
