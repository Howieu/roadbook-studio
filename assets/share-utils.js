(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.ShareUtils = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function titleFor(state) {
    return (state.destination || "旅行") + " 路书";
  }

  function lodgingLabel(state) {
    var lodging = state.lodging || {};
    return lodging.name || lodging.address || "未填写住宿";
  }

  function isLodgingStop(stop, state) {
    var lodging = state.lodging || {};
    if (!stop) return false;
    if (stop.id === "lodging") return true;
    return Boolean((lodging.name && stop.name === lodging.name) ||
      (lodging.address && stop.address === lodging.address));
  }

  function meaningfulStops(day, state) {
    return (day.orderedStops || []).filter(function (stop, index, stops) {
      if (!isLodgingStop(stop, state)) return true;
      return index !== 0 && index !== stops.length - 1;
    });
  }

  function categoryLabel(category) {
    var labels = {
      attraction: "景点",
      restaurant: "餐厅",
      photo: "拍照点",
      shopping: "购物",
      hotel: "住宿",
      lodging: "住宿",
    };
    return labels[category] || category || "停靠点";
  }

  function dayTitle(day, state) {
    if (day.title) return day.title;
    var first = meaningfulStops(day, state)[0];
    return "Day " + (day.dayIndex || "");
  }

  function daySubtitle(day, state) {
    var stops = meaningfulStops(day, state);
    if (!stops.length) return "当天还没有可执行点位。";
    var names = stops.slice(0, 2).map(function (stop) { return stop.name; }).filter(Boolean).join(" + ");
    return names ? names + "，从住宿出发并回到住宿。" : "从住宿出发并回到住宿。";
  }

  function stopTime(index) {
    var minutes = 9 * 60 + index * 75;
    var hour = Math.floor(minutes / 60);
    var minute = minutes % 60;
    return String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0");
  }

  function searchQuery(stop, state) {
    return [stop && (stop.address || stop.name), state.destination].filter(Boolean).join(" ");
  }

  function googleMapsUrl(stop, state) {
    return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(searchQuery(stop, state));
  }

  function appleMapsUrl(stop, state) {
    return "https://maps.apple.com/?q=" + encodeURIComponent(searchQuery(stop, state));
  }

  function embedMapUrl(state) {
    var query = state.destination || lodgingLabel(state) || "travel";
    return "https://www.google.com/maps?q=" + encodeURIComponent(query) + "&output=embed";
  }

  function renderWarnings(warnings) {
    if (!warnings.length) return "";
    return "<div class=\"warnings\">" + warnings.map(function (warning) {
      return "<p>" + esc(warning) + "</p>";
    }).join("") + "</div>";
  }

  function renderStop(stop, index, state) {
    var note = stop.notes || stop.address || "按当天路线顺序停留，现场按体力和排队情况微调。";
    return "<article class=\"stop\">" +
      "<div class=\"time\">" + esc(stop.time || stopTime(index)) + "</div>" +
      "<div class=\"stop-body\">" +
      "<div class=\"stop-meta\"><span>" + esc(categoryLabel(stop.category)) + "</span><span>第 " + (index + 1) + " 站</span></div>" +
      "<h3>" + esc(stop.name || "未命名点位") + "</h3>" +
      "<p>" + esc(note) + "</p>" +
      "<div class=\"stop-links\">" +
      "<a href=\"" + esc(googleMapsUrl(stop, state)) + "\" target=\"_blank\" rel=\"noopener\">Google Maps</a>" +
      "<a href=\"" + esc(appleMapsUrl(stop, state)) + "\" target=\"_blank\" rel=\"noopener\">Apple Maps</a>" +
      "</div></div></article>";
  }

  function roadbookStyles() {
    return ":root{--bg:#f5f4ef;--panel:#fff;--ink:#171717;--muted:#666b72;--line:#dedbd2;--accent:#1f5f70;--accent-2:#9a5a38;--shadow:0 14px 38px rgba(30,34,38,.10)}" +
      "*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,'PingFang SC','Microsoft YaHei',sans-serif;line-height:1.65}a{color:inherit}" +
      ".topnav{position:sticky;top:0;z-index:20;display:flex;gap:8px;overflow-x:auto;padding:10px 14px;background:rgba(255,255,255,.92);backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}" +
      ".topnav a{white-space:nowrap;text-decoration:none;border:1px solid var(--line);background:#fff;border-radius:999px;padding:7px 11px;font-size:13px;color:#273238}.topnav a:hover{border-color:var(--accent);color:var(--accent)}" +
      ".hero{min-height:46vh;background-image:linear-gradient(90deg,rgba(0,0,0,.62),rgba(0,0,0,.20)),url('https://images.unsplash.com/photo-1488646953014-85cb44e25828?q=80&w=1800&auto=format&fit=crop');background-size:cover;background-position:center;display:flex;align-items:end;color:white}" +
      ".hero-inner{width:min(1120px,100%);margin:0 auto;padding:86px 20px 42px}.eyebrow{text-transform:uppercase;letter-spacing:.08em;font-size:12px;font-weight:800;opacity:.84}h1{margin:8px 0 10px;font-size:clamp(38px,7vw,76px);line-height:.95;letter-spacing:0}.hero p{max-width:720px;margin:0;font-size:18px;color:rgba(255,255,255,.90)}" +
      ".chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}.chips span{background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.32);border-radius:999px;padding:7px 11px;font-size:13px}" +
      ".layout{width:min(1120px,100%);margin:0 auto;display:grid;grid-template-columns:310px 1fr;gap:18px;padding:24px 20px 64px}.side-panel{position:sticky;top:58px;align-self:start}.summary{display:grid;gap:8px;margin-bottom:14px}" +
      ".summary div,.quick-links,.warnings,iframe{background:var(--panel);border:1px solid var(--line);border-radius:10px;box-shadow:var(--shadow)}.summary div{padding:12px 14px;color:var(--muted);font-size:13px}.summary b{display:block;color:var(--ink);font-size:15px}" +
      ".quick-links,.warnings{padding:14px;margin-bottom:14px}.quick-links h2{margin:0 0 10px;font-size:16px}.quick-links a{display:block;text-decoration:none;color:var(--accent);font-weight:700;font-size:13px;padding:7px 0;border-top:1px solid #efede7}.quick-links a:first-of-type{border-top:0}.warnings p{margin:0 0 8px;color:var(--accent-2);font-size:13px;font-weight:700}.warnings p:last-child{margin-bottom:0}iframe{width:100%;height:260px;border:0}" +
      ".days{display:grid;gap:18px}.day-card{background:var(--panel);border:1px solid var(--line);border-radius:10px;box-shadow:var(--shadow);overflow:hidden}.day-head{padding:20px 22px 14px;border-bottom:1px solid var(--line);background:#fffdf8}.day-head h2{margin:0;font-size:25px;letter-spacing:0}.day-head p{margin:6px 0 0;color:var(--muted)}" +
      ".timeline{padding:10px 22px 8px}.stop{display:grid;grid-template-columns:92px 1fr;gap:14px;padding:16px 0;border-bottom:1px dashed var(--line)}.stop:last-child{border-bottom:0}.time{font-weight:800;color:var(--accent-2);font-size:13px}.stop h3{margin:0 0 4px;font-size:19px}.stop p{margin:0;color:var(--muted)}" +
      ".stop-meta{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:7px}.stop-meta span{font-size:12px;font-weight:800;color:var(--accent-2);text-transform:uppercase;letter-spacing:.04em}.stop-links{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.stop-links a,.route-button{font-size:13px;text-decoration:none;background:#f1f4f4;color:#173f49;border:1px solid #d9e4e6;border-radius:8px;padding:7px 10px;font-weight:700}.route-button{display:inline-block;margin-top:12px;background:#1f5f70;color:#fff;border-color:#1f5f70}.empty{padding:18px 22px;color:var(--muted)}" +
      "@media(max-width:860px){.layout{grid-template-columns:1fr}.side-panel{position:relative;top:auto}.stop{grid-template-columns:1fr;gap:4px}.hero{min-height:42vh}}";
  }

  function buildRoadbookDocument(state) {
    var routeResult = state.routeResult || {};
    var days = routeResult.days || [];
    var warnings = (routeResult.warnings || []).concat(state.warnings || []);
    var nav = "<nav class=\"topnav\" aria-label=\"Roadbook navigation\"><a href=\"#overview\">概览</a>" +
      days.map(function (day) {
        return "<a href=\"#day-" + esc(day.dayIndex) + "\">Day " + esc(day.dayIndex) + "</a>";
      }).join("") + "</nav>";
    var quickLinks = days.map(function (day) {
      return "<a href=\"#day-" + esc(day.dayIndex) + "\">" + esc(dayTitle(day, state)) + "</a>";
    }).join("");
    var dayCards = days.length ? days.map(function (day) {
      var stops = day.orderedStops || [];
      var dayWarnings = renderWarnings(day.warnings || []);
      return "<section class=\"day-card\" id=\"day-" + esc(day.dayIndex) + "\">" +
        "<div class=\"day-head\"><h2>" + esc(dayTitle(day, state)) + "</h2><p>" + esc(daySubtitle(day, state)) + "</p>" +
        (day.mapUrl ? "<a class=\"route-button\" href=\"" + esc(day.mapUrl) + "\" target=\"_blank\" rel=\"noopener\">打开路线</a>" : "") +
        "</div>" + dayWarnings +
        "<div class=\"timeline\">" + stops.map(function (stop, index) {
          return renderStop(stop, index, state);
        }).join("") + "</div></section>";
    }).join("") : "<section class=\"day-card\"><div class=\"empty\">还没有生成路线。</div></section>";
    return "<!doctype html><html lang=\"zh-CN\"><meta charset=\"utf-8\">" +
      "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
      "<title>" + esc(titleFor(state)) + "</title>" +
      "<style>" + roadbookStyles() + "</style>" +
      nav +
      "<header class=\"hero\"><div class=\"hero-inner\"><div class=\"eyebrow\">Travel Roadbook</div><h1>" + esc(titleFor(state)) + "</h1>" +
      "<p>按住宿出发和返回组织每天路线，尽量减少重复折返。</p><div class=\"chips\"><span>" + days.length + " days</span><span>" + esc(lodgingLabel(state)) + "</span><span>地图可跳转</span></div></div></header>" +
      "<main class=\"layout\" id=\"overview\"><aside class=\"side-panel\">" +
      "<div class=\"summary\"><div><b>" + esc(state.destination || "目的地") + "</b>目的地</div><div><b>" + esc(lodgingLabel(state)) + "</b>住宿</div><div><b>" + days.length + " days</b>行程天数</div></div>" +
      "<div class=\"quick-links\"><h2>路线跳转</h2>" + quickLinks + "</div>" +
      renderWarnings(warnings) +
      "<iframe title=\"" + esc(titleFor(state)) + " map\" src=\"" + esc(embedMapUrl(state)) + "\" loading=\"lazy\"></iframe>" +
      "</aside><section class=\"days\">" + dayCards + "</section></main></html>";
  }

  function sharePayload(state) {
    return {
      title: titleFor(state),
      trip: {
        destination: state.destination || "",
        lodging: state.lodging || {},
      },
      html: buildRoadbookDocument(state),
      routeResult: state.routeResult || null,
    };
  }

  function toBase64Url(value) {
    if (typeof Buffer !== "undefined") {
      return Buffer.from(value, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    }
    var bytes = new TextEncoder().encode(value);
    var binary = "";
    for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function fromBase64Url(value) {
    var base64 = String(value || "").replace(/^#/, "").replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";
    if (typeof Buffer !== "undefined") return Buffer.from(base64, "base64").toString("utf8");
    var binary = atob(base64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function staticShareUrl(state, baseHref) {
    var url = new URL("share.html", baseHref || location.href);
    url.hash = toBase64Url(buildRoadbookDocument(state));
    return url.href;
  }

  function decodeStaticShareHash(hash) {
    return fromBase64Url(hash);
  }

  function qrCodeUrl(url) {
    return "https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=" +
      encodeURIComponent(url || "");
  }

  return {
    buildRoadbookDocument: buildRoadbookDocument,
    decodeStaticShareHash: decodeStaticShareHash,
    qrCodeUrl: qrCodeUrl,
    sharePayload: sharePayload,
    staticShareUrl: staticShareUrl,
  };
});
