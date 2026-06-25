export async function onRequest() {
  return new Response(
    JSON.stringify({
      apiUrl: "https://mailed-bent-isbn-files.trycloudflare.com"
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
      }
    }
  );
}
