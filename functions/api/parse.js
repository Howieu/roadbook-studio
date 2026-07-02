const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";

const SYSTEM_PROMPT = `你是旅行攻略结构化助手。把用户的旅行文案和截图解析为候选点位，不要生成最终路线。

只返回合法 JSON，结构如下：
{
  "places": [
    {
      "name": "点位名称",
      "category": "attraction|restaurant|photo|shopping|lodging|other",
      "notes": "推荐理由、营业时间、机位或注意事项",
      "address": "可选地址",
      "dayIndex": 1,
      "confidence": "high|medium|low"
    }
  ],
  "warnings": []
}

规则：
- 不要编造不存在的点位。
- 如果文本中已有 Day1/Day2，保留 dayIndex；否则默认 dayIndex=1。
- 餐厅、咖啡店、小吃归 restaurant；拍照机位归 photo。
- 截图中读不清的内容放入 warnings。`;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function stripDataUrl(dataUrl) {
  if (!dataUrl) return "";
  const comma = dataUrl.indexOf(",");
  return comma === -1 ? dataUrl : dataUrl.slice(comma + 1);
}

function buildMessages(destination, wishes, text, images) {
  const content = [{
    type: "text",
    text: `目的地：${destination || "未指定"}

用户想去/想打卡的内容：
${wishes || "未填写"}

攻略内容：
${text || "未填写"}

如果只有目的地和偏好，也请基于常见旅行规划生成候选点位；如果有攻略文案或截图，优先从用户材料中提取。`,
  }];

  (Array.isArray(images) ? images : []).slice(0, 6).forEach((image) => {
    const b64 = stripDataUrl(image);
    if (b64) content.push({ type: "image", image: b64 });
  });

  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content },
  ];
}

function extractJson(raw) {
  if (!raw) return null;
  let cleaned = String(raw).trim();
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) cleaned = fence[1].trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first !== -1 && last > first) cleaned = cleaned.slice(first, last + 1);
  try { return JSON.parse(cleaned); } catch (err) { return null; }
}

function normalizePlace(place, index) {
  const name = String(place && place.name || "").trim();
  if (!name) return null;
  return {
    id: place.id || `ai-${index + 1}`,
    name,
    category: place.category || place.type || "attraction",
    notes: place.notes || place.description || "",
    source: "ai",
    dayIndex: Math.max(1, Number(place.dayIndex) || 1),
    address: place.address || "",
    confidence: place.confidence || "medium",
  };
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS_HEADERS });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  let body;
  try {
    body = await request.json();
  } catch (err) {
    return json({ places: [], warnings: ["请求体不是合法 JSON。"] }, 400);
  }

  const destination = body.destination || "";
  const wishes = body.wishes || "";
  const text = body.text || "";
  const images = Array.isArray(body.images) ? body.images : [];
  if (!destination.trim() && !wishes.trim() && !text.trim() && !images.length) {
    return json({ places: [], warnings: ["请先填写目的地、偏好、攻略文案或上传截图。"] }, 400);
  }
  if (!env || !env.AI) {
    return json({ places: [], warnings: ["Cloudflare Workers AI binding 未配置。"] }, 500);
  }

  try {
    const result = await env.AI.run(MODEL, {
      messages: buildMessages(destination, wishes, text, images),
      temperature: 0.1,
      max_tokens: 2048,
    });
    const raw = result && (result.response || result.text || JSON.stringify(result));
    const parsed = extractJson(raw);
    if (!parsed) return json({ places: [], warnings: ["AI 返回内容不是合法 JSON。"] }, 502);
    const places = (Array.isArray(parsed.places) ? parsed.places : [])
      .map(normalizePlace)
      .filter(Boolean);
    return json({ places, warnings: parsed.warnings || [] });
  } catch (err) {
    return json({ places: [], warnings: [err && err.message ? err.message : "AI 解析失败。"] }, 500);
  }
}
