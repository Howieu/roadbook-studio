(function () {
  "use strict";

  var STORAGE_KEY = "roadbook-studio-draft-v1";
  var CATEGORY_LABELS = {
    attraction: "景点",
    restaurant: "餐厅",
    photo: "拍照点",
    shopping: "购物",
    lodging: "住宿",
    other: "其他",
  };

  var state = loadDraft() || {
    step: 0,
    destination: "",
    provider: "google",
    dayCount: 3,
    lodging: { name: "", address: "" },
    wishes: "",
    sourceText: "",
    images: [],
    places: [],
    routeResult: null,
    warnings: [],
    shareUrl: "",
  };

  function $(id) {
    return document.getElementById(id);
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function uid(prefix) {
    return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  }

  function loadDraft() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function saveDraft() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      $("draftState").textContent = "草稿已保存";
    } catch (err) {
      $("draftState").textContent = "草稿未保存";
    }
  }

  function syncInputs() {
    $("destinationInput").value = state.destination || "";
    $("dayCountInput").value = state.dayCount || 3;
    $("lodgingNameInput").value = state.lodging.name || "";
    $("lodgingAddressInput").value = state.lodging.address || "";
    $("wishesInput").value = state.wishes || "";
    $("sourceTextInput").value = state.sourceText || "";
    document.querySelectorAll("input[name='provider']").forEach(function (input) {
      input.checked = input.value === state.provider;
    });
    renderImages();
    renderPlaces();
    renderOptimizeSummary();
    renderResult();
    setStep(state.step || 0, false);
  }

  function setStep(step, persist) {
    state.step = Math.max(0, Math.min(4, step));
    document.querySelectorAll("[data-step]").forEach(function (panel) {
      panel.classList.toggle("active", Number(panel.dataset.step) === state.step);
    });
    document.querySelectorAll("[data-step-jump]").forEach(function (button) {
      button.classList.toggle("active", Number(button.dataset.stepJump) === state.step);
    });
    if (state.step === 2) renderPlaces();
    if (state.step === 3) renderOptimizeSummary();
    if (state.step === 4) renderResult();
    if (persist !== false) saveDraft();
  }

  function updateBasics() {
    state.destination = $("destinationInput").value.trim();
    state.dayCount = Math.max(1, Math.min(14, Number($("dayCountInput").value) || 1));
    state.lodging.name = $("lodgingNameInput").value.trim();
    state.lodging.address = $("lodgingAddressInput").value.trim();
    state.wishes = $("wishesInput").value;
    state.sourceText = $("sourceTextInput").value;
    var checked = document.querySelector("input[name='provider']:checked");
    state.provider = checked ? checked.value : "google";
    state.routeResult = null;
    saveDraft();
  }

  function readImages(files) {
    Array.prototype.forEach.call(files || [], function (file) {
      if (!file.type || !file.type.startsWith("image/")) return;
      var reader = new FileReader();
      reader.onload = function (event) {
        state.images.push({
          id: uid("img"),
          name: file.name,
          dataUrl: event.target.result,
        });
        renderImages();
        saveDraft();
      };
      reader.readAsDataURL(file);
    });
  }

  function renderImages() {
    var wrap = $("imagePreview");
    if (!state.images.length) {
      wrap.innerHTML = "";
      return;
    }
    wrap.innerHTML = state.images.map(function (image) {
      return '<div class="image-chip"><span>' + esc(image.name) + '</span>' +
        '<button class="btn danger" data-remove-image="' + esc(image.id) + '">移除</button></div>';
    }).join("");
  }

  function normalizePlace(raw, source) {
    return {
      id: raw.id || uid("place"),
      name: String(raw.name || "").trim(),
      category: raw.category || raw.type || "attraction",
      notes: raw.notes || raw.description || "",
      source: source || raw.source || "manual",
      dayIndex: Math.max(1, Math.min(state.dayCount, Number(raw.dayIndex) || 1)),
      address: raw.address || "",
      lat: typeof raw.lat === "number" ? raw.lat : parseMaybeNumber(raw.lat),
      lng: typeof raw.lng === "number" ? raw.lng : parseMaybeNumber(raw.lng),
      confidence: raw.confidence || "medium",
    };
  }

  function parseMaybeNumber(value) {
    var number = Number(value);
    return Number.isFinite(number) ? number : undefined;
  }

  function addPlaces(places, source) {
    var existing = {};
    state.places.forEach(function (place) {
      existing[place.name.trim().toLowerCase()] = true;
    });
    (places || []).forEach(function (raw) {
      var place = normalizePlace(raw, source);
      if (!place.name) return;
      var key = place.name.trim().toLowerCase();
      if (existing[key]) return;
      existing[key] = true;
      state.places.push(place);
    });
    state.routeResult = null;
    renderPlaces();
    saveDraft();
  }

  function addManualPlace() {
    var name = $("manualNameInput").value.trim();
    if (!name) return;
    addPlaces([{
      name: name,
      category: $("manualCategoryInput").value,
      notes: $("manualNotesInput").value.trim(),
      source: "manual",
      dayIndex: 1,
    }], "manual");
    $("manualNameInput").value = "";
    $("manualNotesInput").value = "";
  }

  function dayOptions(selected) {
    var html = "";
    for (var i = 1; i <= state.dayCount; i++) {
      html += '<option value="' + i + '"' + (Number(selected) === i ? " selected" : "") + '>Day ' + i + '</option>';
    }
    return html;
  }

  function renderPlaces() {
    var list = $("placeList");
    if (!state.places.length) {
      list.innerHTML = '<div class="empty-state">还没有点位。返回导入页粘贴攻略、上传截图或手动添加。</div>';
      return;
    }
    list.innerHTML = state.places.map(function (place) {
      return '<article class="place-card" data-place-id="' + esc(place.id) + '">' +
        '<div class="place-card-head">' +
        '<div><span class="pill">' + esc(CATEGORY_LABELS[place.category] || place.category) + '</span></div>' +
        '<button class="btn danger" data-delete-place="' + esc(place.id) + '">删除</button>' +
        '</div>' +
        '<label>名称<input data-place-field="name" value="' + esc(place.name) + '"></label>' +
        '<div class="inline-fields">' +
        '<label>类型<select data-place-field="category">' + categoryOptions(place.category) + '</select></label>' +
        '<label>分配到<select data-place-field="dayIndex">' + dayOptions(place.dayIndex) + '</select></label>' +
        '</div>' +
        '<label>地址/定位补充<input data-place-field="address" value="' + esc(place.address || "") + '" placeholder="可选，越具体越准"></label>' +
        '<div class="inline-fields">' +
        '<label>纬度<input data-place-field="lat" inputmode="decimal" value="' + esc(place.lat == null ? "" : place.lat) + '" placeholder="可选"></label>' +
        '<label>经度<input data-place-field="lng" inputmode="decimal" value="' + esc(place.lng == null ? "" : place.lng) + '" placeholder="可选"></label>' +
        '</div>' +
        '<label>备注<input data-place-field="notes" value="' + esc(place.notes || "") + '"></label>' +
        '<p class="hint">来源：' + esc(place.source || "manual") + ' · 置信度：' + esc(place.confidence || "medium") + '</p>' +
        '</article>';
    }).join("");
  }

  function categoryOptions(selected) {
    return Object.keys(CATEGORY_LABELS).map(function (key) {
      return '<option value="' + esc(key) + '"' + (key === selected ? " selected" : "") + '>' + esc(CATEGORY_LABELS[key]) + '</option>';
    }).join("");
  }

  function parseSources() {
    updateBasics();
    var hasInput = state.destination.trim() || state.wishes.trim() || state.sourceText.trim() || state.images.length;
    if (!hasInput) return;
    setBusy("parseBtn", true, "生成中...");
    fetch("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        destination: state.destination,
        wishes: state.wishes,
        text: state.sourceText,
        images: state.images.map(function (image) { return image.dataUrl; }),
      }),
    }).then(function (res) {
      if (!res.ok) throw new Error("parse api " + res.status);
      return res.json();
    }).then(function (data) {
      addPlaces(data.places || [], "ai");
      state.warnings = data.warnings || [];
      setStep(2);
    }).catch(function () {
      addPlaces(PlaceUtils.fallbackExtractPlaces([state.wishes, state.sourceText].filter(Boolean).join("\n")), "fallback");
      state.warnings = ["AI 生成/解析暂不可用，已用本地文本规则提取；截图需要部署 Cloudflare Workers AI 后解析。"];
      setStep(2);
    }).finally(function () {
      setBusy("parseBtn", false, "AI 生成/解析点位");
    });
  }

  function buildRouteInput() {
    return {
      provider: state.provider,
      destination: state.destination,
      lodging: {
        id: "lodging",
        name: state.lodging.name || "住宿",
        address: state.lodging.address || state.lodging.name || state.destination,
      },
      transportMode: "walk_transit",
      days: RouteUtils.groupPlacesByDay(state.places, state.dayCount).map(function (places, index) {
        return {
          dayIndex: index + 1,
          title: "Day " + (index + 1),
          places: places,
          placeIds: places.map(function (place) { return place.id; }),
        };
      }),
    };
  }

  function optimizeRoutes() {
    updateBasics();
    if (!state.places.length) return;
    setBusy("optimizeBtn", true, "优化中...");
    fetch("/api/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildRouteInput()),
    }).then(function (res) {
      if (!res.ok) throw new Error("route api " + res.status);
      return res.json();
    }).then(function (data) {
      state.routeResult = data;
      state.warnings = data.warnings || [];
      saveDraft();
      setStep(4);
    }).catch(function () {
      state.routeResult = localRouteFallback();
      state.warnings = ["路线 API 暂不可用；已按你分配的 Day 生成本地清单。填写坐标后可进行本地最近邻排序。"];
      saveDraft();
      setStep(4);
    }).finally(function () {
      setBusy("optimizeBtn", false, "优化路线");
    });
  }

  function localRouteFallback() {
    var lodging = {
      id: "lodging",
      name: state.lodging.name || "住宿",
      address: state.lodging.address || state.destination,
    };
    var grouped = RouteUtils.groupPlacesByDay(state.places, state.dayCount);
    var allWarnings = [];
    var days = grouped.map(function (places, index) {
      var coordsReady = places.some(RouteUtils.hasCoords);
      if (coordsReady && RouteUtils.hasCoords(lodging)) {
        var optimized = RouteUtils.optimizeDayRoute({
          dayIndex: index + 1,
          lodging: lodging,
          places: places,
          provider: state.provider,
          transportMode: "walk_transit",
        });
        allWarnings = allWarnings.concat(optimized.warnings);
        return optimized;
      }
      var orderedStops = [lodging].concat(places, [lodging]);
      return {
        dayIndex: index + 1,
        orderedStops: orderedStops,
        legs: [],
        mapUrl: providerMapUrl(state.provider, orderedStops),
        unresolvedPlaces: places.filter(function (place) { return !RouteUtils.hasCoords(place); }),
        warnings: places.length ? ["本地模式缺少坐标，保留当前顺序。"] : [],
      };
    });
    return { days: days, unresolvedPlaces: [], warnings: allWarnings };
  }

  function providerMapUrl(provider, stops) {
    return RouteUtils.buildMapUrl(provider, stops || [], "walk_transit") ||
      "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(state.destination || "travel");
  }

  function renderOptimizeSummary() {
    var grouped = RouteUtils.groupPlacesByDay(state.places, state.dayCount);
    var total = state.places.length;
    $("optimizeSummary").innerHTML = total ?
      "已准备 " + total + " 个点位，" + state.dayCount + " 天，每天默认从住宿出发并回到住宿。" :
      "还没有可优化的点位。";
    $("optimizeWarnings").innerHTML = (state.warnings || []).map(function (warning) {
      return '<div class="warning">' + esc(warning) + '</div>';
    }).join("");
    grouped.forEach(function (places, idx) {
      if (!places.length) {
        $("optimizeWarnings").innerHTML += '<div class="warning">Day ' + (idx + 1) + ' 还没有点位。</div>';
      }
    });
  }

  function renderResult() {
    var wrap = $("resultView");
    if (!state.routeResult || !state.routeResult.days) {
      wrap.innerHTML = '<div class="empty-state">还没有生成路线。回到第 4 步点击“优化路线”。</div>';
      $("shareView").innerHTML = "";
      return;
    }
    var warnings = (state.routeResult.warnings || []).concat(state.warnings || []);
    wrap.innerHTML = warnings.map(function (warning) {
      return '<div class="warning">' + esc(warning) + '</div>';
    }).join("") + state.routeResult.days.map(renderDayResult).join("");
    renderShareView();
  }

  function renderShareView() {
    $("shareView").innerHTML = state.shareUrl ?
      '<div class="share-card">' +
      '<img src="' + esc(ShareUtils.qrCodeUrl(state.shareUrl)) + '" alt="云端路书二维码">' +
      '<div class="grid">' +
      '<div class="success">云端网页已生成，可直接手机扫码或浏览器打开。</div>' +
      '<a class="share-link" href="' + esc(state.shareUrl) + '" target="_blank" rel="noopener">' + esc(state.shareUrl) + '</a>' +
      '<div class="share-card-actions"><button class="btn" id="copyShareBtn">复制链接</button><span class="hint" id="copyShareState"></span></div>' +
      '</div></div>' :
      '<div class="empty-state">点击“发布云端网页”后，会生成一个手机可直接打开的网页链接。</div>';
  }

  function renderDayResult(day) {
    var stops = day.orderedStops || [];
    var mapHtml = embedMap(stops, day.mapUrl);
    var list = stops.map(function (stop, index) {
      return '<li><span class="num">' + (index + 1) + '</span><div><strong>' + esc(stop.name) + '</strong>' +
        '<p class="hint">' + esc(stop.address || stop.notes || stop.category || "") + '</p></div></li>';
    }).join("");
    var warnings = (day.warnings || []).map(function (warning) {
      return '<div class="warning">' + esc(warning) + '</div>';
    }).join("");
    return '<article class="day-card">' +
      '<header><h3>Day ' + esc(day.dayIndex) + '</h3></header>' +
      '<div class="day-card-body">' + warnings + mapHtml +
      '<ol class="route-list">' + list + '</ol>' +
      (day.mapUrl ? '<a class="btn primary" href="' + esc(day.mapUrl) + '" target="_blank" rel="noopener">打开地图导航</a>' : "") +
      '</div></article>';
  }

  function embedMap(stops, mapUrl) {
    var points = (stops || []).filter(RouteUtils.hasCoords);
    if (!points.length) {
      return '<div class="map-frame"><div class="map-placeholder">缺少坐标，先显示路线清单。部署后会通过 Google/高德地理编码补全。</div></div>';
    }
    var lat = points[0].lat;
    var lng = points[0].lng;
    var src = "https://www.openstreetmap.org/export/embed.html?layer=mapnik&marker=" +
      encodeURIComponent(lat + "," + lng);
    return '<div class="map-frame"><iframe title="路线地图" loading="lazy" src="' + esc(src) + '"></iframe></div>';
  }

  function downloadRoadbook() {
    if (!state.routeResult) return;
    var html = ShareUtils.buildRoadbookDocument(state);
    var blob = new Blob([html], { type: "text/html;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = (state.destination || "roadbook").replace(/[^\w\u4e00-\u9fa5-]+/g, "-") + "-roadbook.html";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function shareCloudRoadbook() {
    if (!state.routeResult) return;
    setBusy("shareCloudBtn", true, "发布中...");
    fetch("/api/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ShareUtils.sharePayload(state)),
    }).then(function (res) {
      if (!res.ok) throw new Error("share api " + res.status);
      return res.json();
    }).then(function (data) {
      state.shareUrl = data.url;
      saveDraft();
      renderShareView();
    }).catch(function () {
      state.shareUrl = "";
      $("shareView").innerHTML = '<div class="warning">云端发布暂不可用。部署 Cloudflare 后请配置 ROADBOOKS KV binding。</div>';
    }).finally(function () {
      setBusy("shareCloudBtn", false, "发布云端网页");
    });
  }

  function copyShareLink() {
    if (!state.shareUrl) return;
    var done = function () {
      var label = $("copyShareState");
      if (label) label.textContent = "已复制";
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(state.shareUrl).then(done).catch(done);
    } else {
      var input = document.createElement("input");
      input.value = state.shareUrl;
      document.body.appendChild(input);
      input.select();
      try { document.execCommand("copy"); } catch (err) {}
      input.remove();
      done();
    }
  }

  function fillSample() {
    $("destinationInput").value = $("destinationInput").value || "京都";
    $("wishesInput").value = "第一次去京都，想看清水寺、伏见稻荷、祇园，想拍和服照片，吃咖啡甜品和锦市场小吃，路线不要绕。";
    $("sourceTextInput").value = "Day1 清水寺、二年坂三年坂、%Arabica 咖啡、鸭川散步。\nDay2 伏见稻荷大社、锦市场午餐、祇园拍照。";
    updateBasics();
  }

  function setBusy(id, busy, label) {
    var button = $(id);
    button.disabled = busy;
    button.textContent = label;
  }

  function bindEvents() {
    ["destinationInput", "dayCountInput", "lodgingNameInput", "lodgingAddressInput", "wishesInput", "sourceTextInput"].forEach(function (id) {
      $(id).addEventListener("input", updateBasics);
    });
    document.querySelectorAll("input[name='provider']").forEach(function (input) {
      input.addEventListener("change", updateBasics);
    });
    document.querySelectorAll("[data-next]").forEach(function (button) {
      button.addEventListener("click", function () { updateBasics(); setStep(state.step + 1); });
    });
    document.querySelectorAll("[data-prev]").forEach(function (button) {
      button.addEventListener("click", function () { updateBasics(); setStep(state.step - 1); });
    });
    document.querySelectorAll("[data-step-jump]").forEach(function (button) {
      button.addEventListener("click", function () { updateBasics(); setStep(Number(button.dataset.stepJump)); });
    });
    $("resetBtn").addEventListener("click", function () {
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    });
    $("addManualBtn").addEventListener("click", addManualPlace);
    $("sampleBtn").addEventListener("click", fillSample);
    $("parseBtn").addEventListener("click", parseSources);
    $("optimizeBtn").addEventListener("click", optimizeRoutes);
    $("downloadBtn").addEventListener("click", downloadRoadbook);
    $("shareCloudBtn").addEventListener("click", shareCloudRoadbook);

    var dropzone = $("dropzone");
    var imageInput = $("imageInput");
    dropzone.addEventListener("click", function () { imageInput.click(); });
    imageInput.addEventListener("change", function (event) { readImages(event.target.files); });
    dropzone.addEventListener("dragover", function (event) {
      event.preventDefault();
      dropzone.classList.add("dragover");
    });
    dropzone.addEventListener("dragleave", function () { dropzone.classList.remove("dragover"); });
    dropzone.addEventListener("drop", function (event) {
      event.preventDefault();
      dropzone.classList.remove("dragover");
      readImages(event.dataTransfer.files);
    });

    document.body.addEventListener("click", function (event) {
      if (event.target.closest("#copyShareBtn")) {
        copyShareLink();
      }
      var removeImage = event.target.closest("[data-remove-image]");
      if (removeImage) {
        state.images = state.images.filter(function (image) { return image.id !== removeImage.dataset.removeImage; });
        renderImages();
        saveDraft();
      }
      var deletePlace = event.target.closest("[data-delete-place]");
      if (deletePlace) {
        state.places = state.places.filter(function (place) { return place.id !== deletePlace.dataset.deletePlace; });
        state.routeResult = null;
        renderPlaces();
        saveDraft();
      }
    });

    document.body.addEventListener("input", updatePlaceFromEvent);
    document.body.addEventListener("change", updatePlaceFromEvent);
  }

  function updatePlaceFromEvent(event) {
    var field = event.target.dataset.placeField;
    if (!field) return;
    var card = event.target.closest("[data-place-id]");
    var place = state.places.find(function (item) { return item.id === card.dataset.placeId; });
    if (!place) return;
    if (field === "dayIndex") place[field] = Number(event.target.value);
    else if (field === "lat" || field === "lng") place[field] = parseMaybeNumber(event.target.value);
    else place[field] = event.target.value;
    state.routeResult = null;
    saveDraft();
  }

  bindEvents();
  syncInputs();
})();
