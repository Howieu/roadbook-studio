(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PlaceUtils = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function cleanName(part) {
    var cleaned = part.trim()
      .replace(/^day\s*\d+\s*/i, "")
      .replace(/^第.+?天\s*/, "")
      .replace(/^\d{1,2}[:：]\d{2}/, "")
      .replace(/^(上午|中午|下午|晚上|早上|傍晚)/, "")
      .trim();
    var intent = cleaned.match(/(?:想看|想去|想逛|想拍|想吃|打卡)(.+)$/);
    if (intent) cleaned = intent[1].trim();
    return cleaned
      .replace(/^(去|看|逛|拍|吃)\s*/, "")
      .split(/[：:]/)[0]
      .replace(/(早餐|午餐|晚餐|小吃|散步|拍照|打卡)$/, "")
      .trim();
  }

  function isGeneric(name) {
    return !name ||
      name.length > 36 ||
      /^(第一次|首次|路线|想|不想|不要|希望|可以|也可以|例如|攻略|目的地)/.test(name) ||
      /照片$/.test(name) ||
      /^(咖啡甜品|甜品|咖啡|寺庙|餐厅|小吃)$/.test(name);
  }

  function fallbackExtractPlaces(text) {
    var places = [];
    var seen = {};
    // ponytail: fallback extracts explicit names only; deployed Workers AI handles real recommendations.
    String(text || "").split(/\n|。|；|;|、|\u3001|，|,|和|以及|还有/).forEach(function (part) {
      var name = cleanName(part);
      var key = name.toLowerCase();
      if (!isGeneric(name) && !seen[key]) {
        seen[key] = true;
        places.push({
          name: name,
          category: /餐|咖啡|饭|寿司|拉面|甜品|bar|cafe|市场/i.test(part) ? "restaurant" : "attraction",
          notes: part.trim(),
          source: "fallback",
          confidence: "low",
        });
      }
    });
    return places.slice(0, 30);
  }

  return {
    fallbackExtractPlaces: fallbackExtractPlaces,
  };
});
