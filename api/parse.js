/**
 * Vercel Edge Function — AI 路书解析接口
 *
 * 路由: POST /api/parse
 * 请求体: { text: string, images: string[] }
 * 返回: 结构化路书 JSON 对象
 *
 * 调用外部 OpenAI 兼容 API，使用环境变量:
 *   - LLM_API_URL: OpenAI 兼容的 chat/completions 端点
 *   - LLM_API_KEY: API 密钥
 *   - LLM_MODEL  : (可选) 模型名称, 默认 "gpt-4o-mini"
 */

export const config = { runtime: 'edge' };

// CORS 响应头 —— 允许所有来源访问
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// 目标路书 JSON 结构（作为示例提供给模型）
const ROADBOOK_SCHEMA = `{
  "trip": {"title":"","destination":"","startDate":"","endDate":"","pace":"standard","interests":[]},
  "days":[{"date":"","title":"","summary":"","stops":[{"time":"","name":"","type":"","description":"","mustGo":false,"durationMinutes":60,"deadline":"","fallback":""}]}],
  "lodging":[],
  "transport":[],
  "warnings":[],
  "sourceRecords":[]
}`;

// 系统提示词（中文）
const SYSTEM_PROMPT = `你是一个旅行规划助手。将以下旅行攻略文本解析为结构化路书JSON。提取景点、时间、交通、住宿等信息。如果没有明确日期，使用空字符串。根据内容合理分配天数。只返回JSON，不要其他文字。

返回的 JSON 必须严格符合以下结构（字段可留空，但不可缺失键）：
${ROADBOOK_SCHEMA}

要求：
- "type" 可使用以下取值之一: "sightseeing"、"food"、"activity"、"transport"、"lodging"、"rest"。
- "pace" 可使用: "relaxed"、"standard"、"intense"。
- "mustGo" 为布尔值, "durationMinutes" 为整数分钟数。
- "sourceRecords" 用字符串数组记录原文中对应的关键信息片段, 便于回溯。
- 仅输出合法 JSON, 不要包含注释、Markdown 代码块标记或任何解释文字。`;

/**
 * 拼装用户消息：把攻略文本与附图信息组合给模型。
 */
function buildUserMessage(text, images) {
  let msg = `攻略文本：\n${text || ''}`;
  if (Array.isArray(images) && images.length > 0) {
    msg += `\n\n附图（共 ${images.length} 张，URL 列表）：\n${images.join('\n')}`;
    msg += `\n请结合图片 URL 的命名或上下文辅助理解攻略内容。`;
  }
  return msg;
}

/**
 * 从 LLM 输出中提取 JSON。
 * 兼容模型把 JSON 包裹在 ```json ... ``` 或 ``` ... ``` 代码块中的情况，
 * 也会尝试截取首个 { 到末个 } 之间的子串。
 */
function extractJson(raw) {
  if (!raw) return null;
  let cleaned = String(raw).trim();

  // 1) 去除 Markdown 代码围栏
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    cleaned = fence[1].trim();
  }

  // 2) 截取最外层 { ... }
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    cleaned = cleaned.slice(first, last + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    return null;
  }
}

function jsonError(status, message, extra = {}) {
  return new Response(JSON.stringify({ error: message, ...extra }), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function jsonResponse(data) {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

/**
 * Vercel Edge Function 主处理函数。
 * @param {Request} req
 */
export default async function handler(req) {
  // 处理 CORS 预检
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  // 仅允许 POST
  if (req.method !== 'POST') {
    return jsonError(405, 'Method Not Allowed');
  }

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return jsonError(400, 'Invalid JSON body');
  }

  const { text = '', images = [] } = body || {};
  if (!text && !(Array.isArray(images) && images.length)) {
    return jsonError(400, 'Missing "text" or "images" in request body');
  }

  // 读取环境变量
  const apiUrl = process.env.LLM_API_URL;
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL || 'gpt-4o-mini';

  if (!apiUrl || !apiKey) {
    return jsonError(500, 'Missing LLM_API_URL or LLM_API_KEY environment variable');
  }

  const userMessage = buildUserMessage(text, images);

  try {
    const llmResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.2,
        max_tokens: 4096,
        stream: false,
      }),
    });

    if (!llmResponse.ok) {
      const errText = await llmResponse.text();
      return jsonError(500, `LLM API error: ${llmResponse.status}`, { detail: errText });
    }

    const data = await llmResponse.json();

    // OpenAI 兼容响应: data.choices[0].message.content
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
