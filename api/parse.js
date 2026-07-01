/**
 * Vercel Edge Function — Multimodal AI Roadbook Parser
 *
 * Route: POST /api/parse
 * Body:   { text: string, images: string[] }
 * Return: structured roadbook JSON
 *
 * Uses OpenRouter free tier (meta-llama/llama-4-scout), zero-cost, no credit card.
 * Env: OPENROUTER_API_KEY  (get free at https://openrouter.ai/keys)
 */

export const config = { runtime: 'edge' };

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'meta-llama/llama-4-scout';

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

function buildMessages(text, images) {
  const content = [];
  content.push({
    type: 'text',
    text: text || '请分析以下旅行攻略截图，提取景点、时间和交通信息。'
  });

  if (Array.isArray(images)) {
    images.forEach(function(img) {
      if (img && img.startsWith('data:')) {
        content.push({
          type: 'image_url',
          image_url: { url: img }
        });
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

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return jsonError(405, 'Method Not Allowed');
  }

  let body;
  try { body = await req.json(); } catch (e) {
    return jsonError(400, 'Invalid JSON body');
  }

  const { text = '', images = [] } = body || {};
  if (!text && !(Array.isArray(images) && images.length)) {
    return jsonError(400, 'Missing "text" or "images"');
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return jsonError(500, 'Missing OPENROUTER_API_KEY environment variable');
  }

  try {
    const llmResponse = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
        'HTTP-Referer': 'https://roadbook-studio.vercel.app',
        'X-Title': 'Roadbook Studio',
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
        messages: buildMessages(text, images),
        temperature: 0.2,
        max_tokens: 4096,
      }),
    });

    if (!llmResponse.ok) {
      const errText = await llmResponse.text();
      return jsonError(500, 'LLM API error: ' + llmResponse.status, { detail: errText });
    }

    const data = await llmResponse.json();
    const rawText =
      (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) ||
      (data && data.choices && data.choices[0] && data.choices[0].text) ||
      '';

    const parsed = extractJson(rawText);
    if (!parsed) {
      return jsonError(500, 'Failed to parse LLM response into JSON', { raw: rawText });
    }
    return jsonResponse(parsed);
  } catch (err) {
    return jsonError(500, err && err.message ? err.message : 'Internal Server Error');
  }
}
