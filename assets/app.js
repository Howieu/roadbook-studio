/*!
 * Roadbook Studio - MVP App Logic
 * Two-step flow: Input → AI Parse → Result
 */
(function () {
  "use strict";

  /* ===== State ===== */
  var state = {
    pastedText: "",
    uploadedImages: [],
    roadbookJson: null,
    roadbookHtml: null,
    shareUrl: null,
  };

  /* ===== Hero Image Mapping ===== */
  var heroImages = {
    "马略卡": "https://images.unsplash.com/photo-1543248939-4296e1fea89b?q=80&w=1800&auto=format&fit=crop",
    "马略卡岛": "https://images.unsplash.com/photo-1543248939-4296e1fea89b?q=80&w=1800&auto=format&fit=crop",
    "巴黎": "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=1800&auto=format&fit=crop",
    "东京": "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?q=80&w=1800&auto=format&fit=crop",
    "京都": "https://images.unsplash.com/photo-1493997181344-712f2f19d87a?q=80&w=1800&auto=format&fit=crop",
    "伦敦": "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?q=80&w=1800&auto=format&fit=crop",
    "巴塞罗那": "https://images.unsplash.com/photo-1583422409516-2895a77efded?q=80&w=1800&auto=format&fit=crop",
    "default": "https://images.unsplash.com/photo-1488646953014-85cb44e25828?q=80&w=1800&auto=format&fit=crop"
  };

  function getHeroImage(destination) {
    for (var key in heroImages) {
      if (key !== "default" && destination && destination.indexOf(key) > -1) {
        return heroImages[key];
      }
    }
    return heroImages["default"];
  }

  /* ===== DOM Helpers ===== */
  function $(id) { return document.getElementById(id); }

  /* ===== Init ===== */
  function init() {
    // Check viewer mode first
    if (checkViewerMode()) return;

    // Input page bindings
    var pasteInput = $("pasteInput");
    pasteInput.addEventListener("input", function(e) {
      state.pastedText = e.target.value;
      $("generateBtn").disabled = state.pastedText.trim().length === 0 && state.uploadedImages.length === 0;
    });

    // Upload zone
    var uploadZone = $("uploadZone");
    var fileInput = $("fileInput");
    uploadZone.addEventListener("click", function() { fileInput.click(); });
    fileInput.addEventListener("change", function(e) {
      handleFiles(e.target.files);
    });
    uploadZone.addEventListener("dragover", function(e) {
      e.preventDefault();
      uploadZone.classList.add("dragover");
    });
    uploadZone.addEventListener("dragleave", function() {
      uploadZone.classList.remove("dragover");
    });
    uploadZone.addEventListener("drop", function(e) {
      e.preventDefault();
      uploadZone.classList.remove("dragover");
      handleFiles(e.dataTransfer.files);
    });

    // Generate button
    $("generateBtn").addEventListener("click", generateRoadbook);

    // Result page bindings
    $("backBtn").addEventListener("click", backToInput);
    $("openFullBtn").addEventListener("click", openFullPage);
    $("shareBtn").addEventListener("click", openShareModal);
    $("shareCloseBtn").addEventListener("click", closeShareModal);
    $("downloadBtn").addEventListener("click", downloadHtml);
    $("copyLinkBtn").addEventListener("click", copyShareLink);
  }

  /* ===== Viewer Mode ===== */
  function checkViewerMode() {
    var hash = window.location.hash;
    if (!hash || !hash.startsWith("#r=")) return false;

    var compressed = hash.substring(3);
    try {
      var jsonStr = LZString.decompressFromEncodedURIComponent(compressed);
      if (!jsonStr) return false;
      var roadbook = JSON.parse(jsonStr);
      state.roadbookJson = roadbook;

      var cssText = getInlineCSS();
      var heroImage = getHeroImage(roadbook.trip.destination);
      state.roadbookHtml = RoadbookRenderer.renderRoadbook(roadbook, {
        cssText: cssText,
        heroImage: heroImage
      });

      // Replace entire page
      document.open();
      document.write(state.roadbookHtml);
      document.close();
      return true;
    } catch(e) {
      console.error("Failed to load roadbook from URL:", e);
      return false;
    }
  }

  /* ===== File Upload ===== */
  function handleFiles(files) {
    for (var i = 0; i < files.length; i++) {
      if (files[i].type.startsWith("image/")) {
        readFile(files[i]);
      }
    }
  }

  function readFile(file) {
    var reader = new FileReader();
    reader.onload = function(e) {
      state.uploadedImages.push({ name: file.name, dataUrl: e.target.result });
      renderUploadPreview();
      $("generateBtn").disabled = state.pastedText.trim().length === 0 && state.uploadedImages.length === 0;
    };
    reader.readAsDataURL(file);
  }

  function renderUploadPreview() {
    var html = "";
    state.uploadedImages.forEach(function(img, idx) {
      html += '<div class="preview-item">';
      html += '<img src="' + img.dataUrl + '" alt="' + escAttr(img.name) + '">';
      html += '<button class="remove-btn" data-idx="' + idx + '">×</button>';
      html += '</div>';
    });
    $("uploadPreview").innerHTML = html;
    document.querySelectorAll(".preview-item .remove-btn").forEach(function(btn) {
      btn.addEventListener("click", function() {
        var idx = parseInt(btn.dataset.idx);
        state.uploadedImages.splice(idx, 1);
        renderUploadPreview();
        $("generateBtn").disabled = state.pastedText.trim().length === 0 && state.uploadedImages.length === 0;
      });
    });
  }

  /* ===== Generate Roadbook ===== */
  function generateRoadbook() {
    showLoading("正在解析你的旅行攻略...", "AI 正在提取景点、时间和交通信息");

    // Try API first, fall back to client-side parser
    parseViaAPI()
      .then(function(roadbook) {
        hideLoading();
        state.roadbookJson = roadbook;
        renderResult(roadbook);
      })
      .catch(function(err) {
        console.warn("API parse failed, using fallback:", err);
        hideLoading();
        // Use client-side fallback parser
        var roadbook = fallbackParser(state.pastedText);
        state.roadbookJson = roadbook;
        renderResult(roadbook);
      });
  }

  /* ===== AI Parse via API ===== */
  function parseViaAPI() {
    var images = state.uploadedImages.map(function(img) { return img.dataUrl; });

    return fetch("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: state.pastedText,
        images: images
      })
    }).then(function(res) {
      if (!res.ok) throw new Error("API returned " + res.status);
      return res.json();
    });
  }

  /* ===== Client-side Fallback Parser ===== */
  function fallbackParser(text) {
    // Simple regex-based parser for when no AI API is available
    var lines = text.split("\n").filter(function(l) { return l.trim(); });
    var destination = "";
    var days = [];
    var currentDay = null;
    var dayIndex = 0;

    // Try to detect destination from first few lines
    var destMatch = text.match(/(?:去|到|前往|游)\s*([^\s,，。.!！]+)/);
    if (destMatch) destination = destMatch[1];

    // Parse day markers
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      var dayMatch = line.match(/(?:Day|day|第)\s*(\d+|一|二|三|四|五|六|七|八)[日天:]?/i);
      if (dayMatch) {
        dayIndex++;
        currentDay = {
          date: "",
          title: "Day " + dayIndex,
          summary: line.replace(/(?:Day|day|第)\s*\d+[日天:]?\s*/i, "").trim() || "第" + dayIndex + "天行程",
          stops: []
        };
        days.push(currentDay);
      } else if (currentDay) {
        // Try to extract time and place
        var timeMatch = line.match(/(\d{1,2}[:：]\d{2}|\d{1,2}[点时])/);
        var stop = {
          time: timeMatch ? timeMatch[1] : "flex",
          name: line.replace(timeMatch ? timeMatch[0] : "", "").trim().split(/[,，。；;、]/)[0] || line,
          type: "attraction",
          description: line,
          mustGo: false,
          durationMinutes: 60,
          deadline: "",
          fallback: ""
        };
        currentDay.stops.push(stop);
      }
    }

    // If no days detected, create a single day with all content
    if (days.length === 0) {
      var stops = lines.map(function(line) {
        return {
          time: "flex",
          name: line.split(/[,，。；;、]/)[0],
          type: "attraction",
          description: line,
          mustGo: false,
          durationMinutes: 60,
          deadline: "",
          fallback: ""
        };
      });
      days.push({
        date: "",
        title: "Day 1",
        summary: "行程安排",
        stops: stops
      });
    }

    return {
      trip: {
        title: (destination || "旅行") + " 路书",
        destination: destination || "未指定目的地",
        startDate: "",
        endDate: "",
        pace: "standard",
        interests: []
      },
      days: days,
      lodging: [],
      transport: [],
      warnings: [
        "此路书由客户端解析器生成，信息可能不完整。",
        "建议使用 AI 解析（部署到 Cloudflare 或 Vercel）获得更准确的结果。",
        "出行前请确认景点营业时间和交通班次。"
      ],
      sourceRecords: [{
        id: "user-input",
        platform: "paste",
        title: "用户粘贴文本",
        excerpt: text.substring(0, 200) + (text.length > 200 ? "..." : ""),
        confidence: "medium"
      }]
    };
  }

  /* ===== Render Result ===== */
  function renderResult(roadbook) {
    var cssText = getInlineCSS();
    var heroImage = getHeroImage(roadbook.trip.destination);
    state.roadbookHtml = RoadbookRenderer.renderRoadbook(roadbook, {
      cssText: cssText,
      heroImage: heroImage
    });

    // Show result page
    $("inputPage").style.display = "none";
    $("resultPage").classList.add("active");
    $("resultTitle").textContent = roadbook.trip.title;

    // Set iframe content
    var frame = $("roadbookFrame");
    frame.srcdoc = state.roadbookHtml;

    // Generate share URL
    try {
      var jsonStr = JSON.stringify(roadbook);
      var compressed = LZString.compressToEncodedURIComponent(jsonStr);
      var baseUrl = window.location.href.split("#")[0];
      state.shareUrl = baseUrl + "#r=" + compressed;
    } catch(e) {
      console.error("Share URL generation failed:", e);
    }
  }

  /* ===== Actions ===== */
  function backToInput() {
    $("resultPage").classList.remove("active");
    $("inputPage").style.display = "flex";
    state.roadbookJson = null;
    state.roadbookHtml = null;
  }

  function openFullPage() {
    if (!state.roadbookHtml) return;
    var blob = new Blob([state.roadbookHtml], { type: "text/html" });
    var url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(function() { URL.revokeObjectURL(url); }, 10000);
  }

  function openShareModal() {
    if (!state.shareUrl) return;
    $("shareLinkInput").value = state.shareUrl;
    $("shareQrImg").src = "https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=8&data=" +
                          encodeURIComponent(state.shareUrl);
    $("shareModal").classList.add("active");
  }

  function closeShareModal() {
    $("shareModal").classList.remove("active");
  }

  function downloadHtml() {
    if (!state.roadbookHtml) return;
    var blob = new Blob([state.roadbookHtml], { type: "text/html" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "roadbook.html";
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyShareLink() {
    var input = $("shareLinkInput");
    input.select();
    input.setSelectionRange(0, 99999);
    try {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(input.value);
      } else {
        document.execCommand("copy");
      }
      var btn = $("copyLinkBtn");
      btn.textContent = "已复制";
      btn.classList.add("copied");
      setTimeout(function() {
        btn.textContent = "复制链接";
        btn.classList.remove("copied");
      }, 2000);
    } catch(e) {}
  }

  /* ===== Loading ===== */
  function showLoading(text, sub) {
    $("loadingText").textContent = text;
    $("loadingSub").textContent = sub;
    $("loadingOverlay").classList.add("active");
  }

  function hideLoading() {
    $("loadingOverlay").classList.remove("active");
  }

  /* ===== CSS Extraction ===== */
  function getInlineCSS() {
    // Try to read from loaded stylesheet
    for (var i = 0; i < document.styleSheets.length; i++) {
      var sheet = document.styleSheets[i];
      if (sheet.href && sheet.href.indexOf("roadbook.css") > -1) {
        try {
          var css = "";
          var rules = sheet.cssRules || sheet.rules;
          for (var j = 0; j < rules.length; j++) {
            css += rules[j].cssText + "\n";
          }
          return css;
        } catch(e) {}
      }
    }
    // Fallback: XHR
    try {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", "assets/roadbook.css", false);
      xhr.send();
      if (xhr.status === 200) return xhr.responseText;
    } catch(e) {}
    return "";
  }

  /* ===== Utils ===== */
  function escAttr(str) {
    return String(str || "").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

  function slugify(value) {
    return String(value || "").trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "roadbook";
  }

  /* ===== Boot ===== */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
