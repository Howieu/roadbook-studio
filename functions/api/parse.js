/**
 * Cloudflare Pages Function — Multimodal AI Roadbook Parser
 *
 * Route: POST /api/parse
 * Body:   { text: string, images: string[] }  // images are base64 data URLs
 * Return: structured roadbook JSON
 *
 * Uses Workers AI binding (context.env.AI) with vision model:
 *   @cf/meta/llama-3.2-11b-vision-instruct (free, multimodal)
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';

const ROADBOOK_SCHEMA = `{
  "trip": {"title":"","destination":"","startDate":"","endDate":"","pace":"standard","interests":[]},
  "days":[{"date":"","title":"","summary":"","stops":[{"time":"","name":"","type":"","description":"","mustGo":false,"durationMinutes":60,"deadline":"","fallback":""}]}],
  "lodging":[],"transport":[],"warnings":[],"sourceRecords":[]
}`;

const SYSTEM_PROMPT = `你是一个旅行规划助手。分析用户提供的攻略文本和截图，提取所有景点、时间安排、交通方式、住宿信息，生成结构化路书JSON。

截图可能是小红书、马蜂窝等平台的攻略截图，请仔细阅读图片中的文字信息。
如果没有明确日期，使用空字符串。根据内容合理分配天数。
只返回JSON，不要任何其他文字。

返回的 JSON 必须严格符合以下结构：
${ROADBOOK_SCHEMA}

要求：
- "type" 取值: "sightseeing", "food", "activity", "transport", "lodging", "rest"
- "pace" 取值: "relaxed", "standard", "intense"
- "mustGo" 布尔值, "durationMinutes" 整数分钟
- 仅输出合法 JSON，不要 Markdown 代码块、注释或解释文字`;

function stripDataUrlPrefix(dataUrl) {
  if (!dataUrl) return '';
  const idx = dataUrl.indexOf(',');
  return idx !== -1 ? dataUrl.slice(idx + 1) : dataUrl;
}

function buildMessages(text, images) {
  const content = [];
  content.push({ type: 'text', text: text || '请分析以下旅行攻略截图，提取景点、时间和交通信息。' });

  if (Array.isArray(images)) {
    images.forEach(function(img) {
      const b64 = stripDataUrlPrefix(img);
      if (b64) {
        content.push({ type: 'image', image: b64 });
      }
    });
  }

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: content },
  ];
}

function extractJson(raw) {
  if (!raw) return null;
  let cleaned = String(raw).trim();
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) cleaned = fence[1].trim();
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    cleaned = cleaned.slice(first, last + 1);
  }
  try { return JSON.parse(cleaned); } catch (e) { return null; }
}

function jsonError(status, message, extra) {
  return new Response(JSON.stringify({ error: message, ...(extra || {}) }), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function jsonResponse(data) {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS_HEADERS });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return jsonError(405, 'Method Not Allowed');
  }

  let body;
  try { body = await request.json(); } catch (e) {
    return jsonError(400, 'Invalid JSON body');
  }

  const { text = '', images = [] } = body || {};
  if (!text && !(Array.isArray(images) && images.length)) {
    return jsonError(400, 'Missing "text" or "images"');
  }

  if (!env || !env.AI) {
    return jsonError(500, 'Workers AI binding (env.AI) is not configured');
  }

  try {
    const messages = buildMessages(text, images);
    const aiInput = { messages, temperature: 0.2, max_tokens: 4096 };
    const aiResult = await env.AI.run(MODEL, aiInput);

    const rawText =
      (aiResult && aiResult.response) ||
      (aiResult && aiResult.result && aiResult.result.response) ||
      (typeof aiResult === 'string' ? aiResult : '') ||
      JSON.stringify(aiResult || '');

    const parsed = extractJson(rawText);
    if (!parsed) {
      return jsonError(500, 'Failed to parse LLM response into JSON', { raw: rawText });
    }
    return jsonResponse(parsed);
  } catch (err) {
    return jsonError(500, err && err.message ? err.message : 'Internal Server Error');
  }
}
