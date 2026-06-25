const BACKEND_ORIGIN = "https://mailed-bent-isbn-files.trycloudflare.com";

export async function onRequest() {
  try {
    const response = await fetch(`${BACKEND_ORIGIN}/openapi.json`);

    const headers = new Headers(response.headers);
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Content-Type", "application/json");
    headers.set("Cache-Control", "no-store");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "OpenAPI proxy backend baglantisi basarisiz",
        message: String(error),
      }),
      {
        status: 502,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
}
