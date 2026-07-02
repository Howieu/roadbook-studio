export async function onRequestGet(context) {
  if (!context.env || !context.env.ROADBOOKS) {
    return new Response("ROADBOOKS KV binding is not configured.", { status: 500 });
  }

  const html = await context.env.ROADBOOKS.get(context.params.id);
  if (!html) return new Response("Roadbook not found.", { status: 404 });

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "X-Robots-Tag": "noindex",
    },
  });
}
