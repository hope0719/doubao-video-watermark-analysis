// Cloudflare Pages Function: proxies the upload to the backend running on your
// machine (exposed via Cloudflare Tunnel). Keeps the API same-origin for the
// browser, so no CORS, and the backend hostname stays server-side.
//
// Set BACKEND_URL in the Pages project (Settings -> Environment variables),
// e.g. https://api.declank.example.com  (your tunnel hostname).

export async function onRequestPost({ request, env }) {
  const base = env.BACKEND_URL;
  if (!base) {
    return new Response(
      JSON.stringify({ error: "Backend not configured: set BACKEND_URL in the Pages project settings." }),
      { status: 503, headers: { "content-type": "application/json" } },
    );
  }

  const target = base.replace(/\/+$/, "") + "/api/transform";

  let upstream;
  try {
    upstream = await fetch(target, {
      method: "POST",
      headers: request.headers,
      body: request.body,
      // required when streaming a request body through fetch in Workers
      duplex: "half",
    });
  } catch {
    return new Response(
      JSON.stringify({ error: "Could not reach the cleanup backend. Is your machine and tunnel running?" }),
      { status: 502, headers: { "content-type": "application/json" } },
    );
  }

  // stream the result (image or JSON error) straight back, preserving headers
  // like Content-Type and X-Transform-Info
  const headers = new Headers(upstream.headers);
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}
