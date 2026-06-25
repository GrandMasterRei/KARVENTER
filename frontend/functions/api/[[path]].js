const BACKEND_ORIGIN = "https://mailed-bent-isbn-files.trycloudflare.com";

export async function onRequest(context) {
  const { request, params } = context;

  const rawPath = params.path || [];
  const path = Array.isArray(rawPath) ? rawPath.join("/") : String(rawPath || "");

  const incomingUrl = new URL(request.url);

  let targetPath;
  if (path === "docs") {
    targetPath = "/docs";
  } else if (path === "openapi.json") {
    targetPath = "/openapi.json";
  } else if (path === "") {
    targetPath = "/api";
  } else {
    targetPath = `/api/${path}`;
  }

  const targetUrl = `${BACKEND_ORIGIN}${targetPath}${incomingUrl.search}`;

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  const headers = new Headers(request.headers);
  headers.delete("host");

  const init = {
    method: request.method,
    headers,
    redirect: "follow",
  };

  if (!["GET", "HEAD"].includes(request.method)) {
    init.body = request.body;
  }

  try {
    const backendResponse = await fetch(targetUrl, init);
    const responseHeaders = new Headers(backendResponse.headers);

    for (const [key, value] of Object.entries(corsHeaders())) {
      responseHeaders.set(key, value);
    }

    responseHeaders.set("Cache-Control", "no-store");

    return new Response(backendResponse.body, {
      status: backendResponse.status,
      statusText: backendResponse.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "API proxy backend baglantisi basarisiz",
        targetUrl,
        message: String(error),
      }),
      {
        status: 502,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders(),
        },
      }
    );
  }
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}