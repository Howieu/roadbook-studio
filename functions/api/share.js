const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const MAX_HTML_BYTES = 1_000_000;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function shareId() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS_HEADERS });
}

export async function onRequestPost(context) {
  if (!context.env || !context.env.ROADBOOKS) {
    return json({ error: "ROADBOOKS KV binding is not configured." }, 500);
  }

  let body;
  try {
    body = await context.request.json();
  } catch (err) {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const html = String(body.html || "");
  if (!html.startsWith("<!doctype html>")) {
    return json({ error: "Missing roadbook HTML." }, 400);
  }
  if (new TextEncoder().encode(html).length > MAX_HTML_BYTES) {
    return json({ error: "Roadbook HTML is too large." }, 413);
  }

  const id = shareId();
  await context.env.ROADBOOKS.put(id, html, {
    expirationTtl: 60 * 60 * 24 * 30,
    metadata: {
      title: String(body.title || "Roadbook").slice(0, 120),
      createdAt: new Date().toISOString(),
    },
  });

  const url = new URL(context.request.url);
  return json({ id, url: `${url.origin}/share/${id}` });
}
