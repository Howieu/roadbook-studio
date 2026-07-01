/* ===== Roadbook Studio - App Logic ===== */
(function () {
  "use strict";

  /* ===== State ===== */
  var state = {
    currentStep: 1,
    totalSteps: 6,
    inputMethods: [],         // ['upload','paste','search']
    uploadedImages: [],       // [{name, dataUrl}]
    pastedText: "",
    searchQuery: "",
    searchResults: [],        // AI search results
    selectedSearchResults: [], // selected result indices
    destination: "",
    startDate: "",
    endDate: "",
    pace: "standard",
    interests: [],
    customInterest: "",
    mustGoPlaces: [],
    avoidPlaces: [],
    hotelName: "",
    hotelAddress: "",
    transportInfo: "",
    roadbookJson: null,
    roadbookHtml: null,
    roadbookHtmlInline: null,
  };

  /* ===== AI Destination Database (simulated) ===== */
  var aiDestDB = {
    "马略卡": [
      { name: "Palma Cathedral (La Seu)", type: "landmark", desc: "哥特式主教座堂，海滨地标" },
      { name: "Sóller (橘子小镇)", type: "town", desc: "复古火车、橘子园、百年面包店" },
      { name: "Valldemossa", type: "town", desc: "山地小镇，肖邦故居" },
      { name: "Sóller Port", type: "seaside", desc: "海港山景，海边散步" },
      { name: "Palma Old Town", type: "city walk", desc: "窄巷石板路、Tapas bar" },
      { name: "Cuevas del Drach", type: "nature", desc: "龙洞地下湖，钟乳石奇观" },
    ],
    "巴黎": [
      { name: "Louvre Museum", type: "museum", desc: "卢浮宫，世界最大艺术博物馆" },
      { name: "Eiffel Tower", type: "landmark", desc: "埃菲尔铁塔" },
      { name: "Montmartre", type: "city walk", desc: "蒙马特高地，圣心大教堂" },
      { name: "Le Marais", type: "food/shopping", desc: "玛黑区，咖啡馆和精品店" },
      { name: "Seine Cruise", type: "photo", desc: "塞纳河游船" },
      { name: "Musée d'Orsay", type: "museum", desc: "奥赛博物馆，印象派画作" },
    ],
    "东京": [
      { name: "浅草寺", type: "landmark", desc: "东京最古老的寺庙" },
      { name: "涩谷十字路口", type: "city walk", desc: "世界最繁忙的十字路口" },
      { name: "明治神宫", type: "culture", desc: "闹市中的静谧神社" },
      { name: "筑地/丰洲市场", type: "food", desc: "海鲜寿司早餐" },
      { name: "秋叶原", type: "shopping", desc: "动漫电器街" },
      { name: "上野公园", type: "nature", desc: "博物馆群和樱花" },
    ],
    "京都": [
      { name: "伏见稻荷大社", type: "landmark", desc: "千本鸟居" },
      { name: "金阁寺", type: "landmark", desc: "金箔覆盖的禅寺" },
      { name: "岚山竹林", type: "nature", desc: "竹林小径" },
      { name: "祇园", type: "culture", desc: "艺伎区和传统茶屋" },
      { name: "清水寺", type: "landmark", desc: "木造舞台俯瞰京都" },
    ],
    "default": [
      { name: "市中心历史街区", type: "city walk", desc: "老城区漫步，感受当地风情" },
      { name: "当地特色美食街", type: "food", desc: "品尝地道美食" },
      { name: "主要博物馆/美术馆", type: "museum", desc: "了解当地历史文化" },
      { name: "观景台/地标建筑", type: "landmark", desc: "俯瞰城市全景" },
      { name: "海滨/自然公园", type: "nature", desc: "放松身心的自然景点" },
      { name: "本地市场", type: "shopping", desc: "体验当地生活气息" },
    ],
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
    "阿姆斯特丹": "https://images.unsplash.com/photo-1534351590666-13e3e96c5017?q=80&w=1800&auto=format&fit=crop",
    "罗马": "https://images.unsplash.com/photo-1552832230-c0197dd311b5?q=80&w=1800&auto=format&fit=crop",
    "default": "https://images.unsplash.com/photo-1488646953014-85cb44e25828?q=80&w=1800&auto=format&fit=crop"
  };

  function getHeroImage(destination) {
    for (var key in heroImages) {
      if (key !== "default" && destination.indexOf(key) > -1) {
        return heroImages[key];
      }
    }
    return heroImages["default"];
  }

  /* ===== DOM Helpers ===== */
  function $(id) { return document.getElementById(id); }
  function $$(sel) { return document.querySelectorAll(sel); }
  function show(el) { el && el.classList.remove("hidden"); }
  function hide(el) { el && el.classList.add("hidden"); }

  /* ===== Step Labels ===== */
  var stepLabels = ["资料输入", "基本信息", "兴趣偏好", "景点住宿", "确认生成", "完成"];

  /* ===== Init ===== */
  function init() {
    // Check if we're in viewer mode (URL has #r=compressed_data)
    if (checkViewerMode()) return;

    $("startBtn").addEventListener("click", startWizard);
    $("navRestart").addEventListener("click", function(e){ e.preventDefault(); restart(); });
    $("btnPrev").addEventListener("click", prevStep);
    $("btnNext").addEventListener("click", nextStep);
    $("restartBtn").addEventListener("click", restart);

    setupStep1();
    setupStep2();
    setupStep3();
    setupStep4();
    setupResultActions();
  }

  /* ===== Viewer Mode ===== */
  // When URL has #r=compressed_data, skip the wizard and render the roadbook directly
  function checkViewerMode() {
    var hash = window.location.hash;
    if (!hash || !hash.startsWith("#r=")) return false;

    var compressed = hash.substring(3);
    try {
      var jsonStr = LZString.decompressFromEncodedURIComponent(compressed);
      if (!jsonStr) return false;
      var roadbook = JSON.parse(jsonStr);
      state.roadbookJson = roadbook;

      // Render the roadbook
      var cssText = getInlineCSS();
      var heroImage = getHeroImage(roadbook.trip.destination);
      state.roadbookHtmlInline = RoadbookRenderer.renderRoadbook(roadbook, {
        cssText: cssText,
        heroImage: heroImage
      });

      // Replace the entire page with the roadbook HTML
      document.open();
      document.write(state.roadbookHtmlInline);
      document.close();
      return true;
    } catch(e) {
      console.error("Failed to load roadbook from URL:", e);
      return false;
    }
  }

  /* ===== Start Wizard ===== */
  function startWizard() {
    hide($("heroSection"));
    show($("wizardContainer"));
    renderProgressBar();
    goToStep(1);
  }

  /* ===== Progress Bar ===== */
  function renderProgressBar() {
    var html = "";
    for (var i = 0; i < stepLabels.length; i++) {
      var cls = "";
      if (i + 1 < state.currentStep) cls = "done";
      else if (i + 1 === state.currentStep) cls = "active";
      html += '<div class="progress-step ' + cls + '">';
      html += '<span class="step-num">' + (i + 1) + "</span>";
      html += '<span class="step-label">' + stepLabels[i] + "</span>";
      html += "</div>";
      if (i < stepLabels.length - 1) {
        html += '<div class="progress-line ' + (i + 1 < state.currentStep ? "done" : "") + '"></div>';
      }
    }
    $("progressBar").innerHTML = html;
  }

  /* ===== Step Navigation ===== */
  function goToStep(step) {
    state.currentStep = step;
    for (var i = 1; i <= 6; i++) {
      var el = $("step" + i);
      if (i === step) show(el);
      else hide(el);
    }
    renderProgressBar();
    updateNavButtons();

    if (step === 5) renderReview();
  }

  function updateNavButtons() {
    var btnPrev = $("btnPrev");
    var btnNext = $("btnNext");
    var stepNav = $("stepNav");

    if (state.currentStep === 1) {
      hide(btnPrev);
    } else {
      show(btnPrev);
    }

    if (state.currentStep === 5) {
      btnNext.textContent = "生成路书";
      btnNext.className = "btn-generate";
    } else if (state.currentStep === 6) {
      hide(stepNav);
    } else {
      btnNext.textContent = "下一步";
      btnNext.className = "btn-next";
    }

    // Validation
    btnNext.disabled = !validateStep(state.currentStep);
  }

  function validateStep(step) {
    switch (step) {
      case 1:
        return state.inputMethods.length > 0 && (
          state.inputMethods.indexOf("upload") === -1 || state.uploadedImages.length > 0
        ) && (
          state.inputMethods.indexOf("paste") === -1 || state.pastedText.trim().length > 0
        ) && (
          state.inputMethods.indexOf("search") === -1 || state.selectedSearchResults.length > 0
        );
      case 2:
        return state.destination.trim().length > 0;
      default:
        return true;
    }
  }

  function nextStep() {
    if (!validateStep(state.currentStep)) return;
    if (state.currentStep === 5) {
      generateRoadbook();
      return;
    }
    if (state.currentStep < 6) {
      // Auto-fill destination from search query
      if (state.currentStep === 1 && state.searchQuery && !state.destination) {
        state.destination = state.searchQuery;
        $("destination").value = state.searchQuery;
      }
      // Auto-fill must-go from search results
      if (state.currentStep === 1 && state.selectedSearchResults.length > 0 && state.mustGoPlaces.length === 0) {
        state.selectedSearchResults.forEach(function(idx) {
          var r = state.searchResults[idx];
          if (r) state.mustGoPlaces.push(r.name);
        });
        renderPlaceTags();
      }
      goToStep(state.currentStep + 1);
    }
  }

  function prevStep() {
    if (state.currentStep > 1) goToStep(state.currentStep - 1);
  }

  /* ===== Step 1: Input Methods ===== */
  function setupStep1() {
    $$(".input-method-card").forEach(function(card) {
      card.addEventListener("click", function() {
        var method = card.dataset.method;
        toggleMethod(method, card);
      });
    });

    // Upload
    var dropZone = $("dropZone");
    var fileInput = $("fileInput");
    dropZone.addEventListener("click", function() { fileInput.click(); });
    fileInput.addEventListener("change", handleFiles);

    dropZone.addEventListener("dragover", function(e) {
      e.preventDefault();
      dropZone.classList.add("dragover");
    });
    dropZone.addEventListener("dragleave", function() {
      dropZone.classList.remove("dragover");
    });
    dropZone.addEventListener("drop", function(e) {
      e.preventDefault();
      dropZone.classList.remove("dragover");
      handleFileList(e.dataTransfer.files);
    });

    // Paste
    $("pasteText").addEventListener("input", function(e) {
      state.pastedText = e.target.value;
      updateNavButtons();
    });

    // AI Search
    $("searchBtn").addEventListener("click", doAISearch);
    $("searchInput").addEventListener("keydown", function(e) {
      if (e.key === "Enter") doAISearch();
    });
  }

  function toggleMethod(method, card) {
    var idx = state.inputMethods.indexOf(method);
    if (idx > -1) {
      state.inputMethods.splice(idx, 1);
      card.classList.remove("selected");
      hide($("{method}Zone".replace("{method}", method)));
      if (method === "upload") hide($("uploadZone"));
      if (method === "paste") hide($("pasteZone"));
      if (method === "search") hide($("searchZone"));
    } else {
      state.inputMethods.push(method);
      card.classList.add("selected");
      if (method === "upload") show($("uploadZone"));
      if (method === "paste") show($("pasteZone"));
      if (method === "search") show($("searchZone"));
    }
    updateNavButtons();
  }

  function handleFiles(e) {
    handleFileList(e.target.files);
  }

  function handleFileList(files) {
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
      updateNavButtons();
    };
    reader.readAsDataURL(file);
  }

  function renderUploadPreview() {
    var html = "";
    state.uploadedImages.forEach(function(img, idx) {
      html += '<div class="preview-item">';
      html += '<img src="' + img.dataUrl + '" alt="' + img.name + '">';
      html += '<button class="remove-btn" data-idx="' + idx + '">×</button>';
      html += '</div>';
    });
    $("uploadPreview").innerHTML = html;
    $$(".preview-item .remove-btn").forEach(function(btn) {
      btn.addEventListener("click", function() {
        var idx = parseInt(btn.dataset.idx);
        state.uploadedImages.splice(idx, 1);
        renderUploadPreview();
        updateNavButtons();
      });
    });
  }

  function doAISearch() {
    var query = $("searchInput").value.trim();
    if (!query) return;

    state.searchQuery = query;
    $("searchBtn").disabled = true;
    $("searchResults").innerHTML = '<div class="ai-searching"><div class="spinner"></div>AI 正在搜索「' + escHtml(query) + "」的推荐景点...</div>";

    setTimeout(function() {
      var results = getAIResults(query);
      state.searchResults = results;
      state.selectedSearchResults = [];
      renderSearchResults(results);
      $("searchBtn").disabled = false;
      updateNavButtons();
    }, 1200);
  }

  function getAIResults(query) {
    for (var key in aiDestDB) {
      if (key !== "default" && query.indexOf(key) > -1) {
        return aiDestDB[key];
      }
    }
    return aiDestDB["default"];
  }

  function renderSearchResults(results) {
    var html = "";
    results.forEach(function(r, idx) {
      html += '<div class="ai-search-result" data-idx="' + idx + '">';
      html += '<div class="result-check">✓</div>';
      html += '<div class="result-info">';
      html += "<h4>" + escHtml(r.name) + "</h4>";
      html += "<p>" + escHtml(r.type) + " · " + escHtml(r.desc) + "</p>";
      html += "</div></div>";
    });
    $("searchResults").innerHTML = html;

    $$(".ai-search-result").forEach(function(item) {
      item.addEventListener("click", function() {
        var idx = parseInt(item.dataset.idx);
        var sIdx = state.selectedSearchResults.indexOf(idx);
        if (sIdx > -1) {
          state.selectedSearchResults.splice(sIdx, 1);
          item.classList.remove("selected");
        } else {
          state.selectedSearchResults.push(idx);
          item.classList.add("selected");
        }
        updateNavButtons();
      });
    });
  }

  /* ===== Step 2: Destination & Dates ===== */
  function setupStep2() {
    $("destination").addEventListener("input", function(e) {
      state.destination = e.target.value;
      updateNavButtons();
    });
    $("startDate").addEventListener("change", function(e) {
      state.startDate = e.target.value;
    });
    $("endDate").addEventListener("change", function(e) {
      state.endDate = e.target.value;
    });

    $$(".pace-card").forEach(function(card) {
      card.addEventListener("click", function() {
        $$(".pace-card").forEach(function(c) { c.classList.remove("selected"); });
        card.classList.add("selected");
        state.pace = card.dataset.pace;
      });
    });

    // Default select standard
    var defaultPace = document.querySelector('.pace-card[data-pace="standard"]');
    if (defaultPace) {
      defaultPace.classList.add("selected");
      state.pace = "standard";
    }
  }

  /* ===== Step 3: Interests ===== */
  function setupStep3() {
    $$(".chip").forEach(function(chip) {
      chip.addEventListener("click", function() {
        var interest = chip.dataset.interest;
        var idx = state.interests.indexOf(interest);
        if (idx > -1) {
          state.interests.splice(idx, 1);
          chip.classList.remove("selected");
        } else {
          state.interests.push(interest);
          chip.classList.add("selected");
        }
      });
    });
    $("customInterest").addEventListener("input", function(e) {
      state.customInterest = e.target.value;
    });
  }

  /* ===== Step 4: Places ===== */
  function setupStep4() {
    function bindPlaceInput(inputId, btnId, arr, tagClass) {
      var input = $(inputId);
      var btn = $(btnId);
      function addPlace() {
        var val = input.value.trim();
        if (val && arr.indexOf(val) === -1) {
          arr.push(val);
          input.value = "";
          renderPlaceTags();
        }
      }
      btn.addEventListener("click", addPlace);
      input.addEventListener("keydown", function(e) {
        if (e.key === "Enter") { e.preventDefault(); addPlace(); }
      });
    }

    bindPlaceInput("mustGoInput", "addMustGo", state.mustGoPlaces, "must");
    bindPlaceInput("avoidInput", "addAvoid", state.avoidPlaces, "avoid");
  }

  function renderPlaceTags() {
    var mustHtml = "";
    state.mustGoPlaces.forEach(function(p, idx) {
      mustHtml += '<span class="place-tag must">' + escHtml(p);
      mustHtml += ' <span class="tag-remove" data-arr="must" data-idx="' + idx + '">×</span></span>';
    });
    $("mustGoTags").innerHTML = mustHtml;

    var avoidHtml = "";
    state.avoidPlaces.forEach(function(p, idx) {
      avoidHtml += '<span class="place-tag avoid">' + escHtml(p);
      avoidHtml += ' <span class="tag-remove" data-arr="avoid" data-idx="' + idx + '">×</span></span>';
    });
    $("avoidTags").innerHTML = avoidHtml;

    $$(".tag-remove").forEach(function(el) {
      el.addEventListener("click", function() {
        var arr = el.dataset.arr === "must" ? state.mustGoPlaces : state.avoidPlaces;
        arr.splice(parseInt(el.dataset.idx), 1);
        renderPlaceTags();
      });
    });
  }

  /* ===== Step 5: Review ===== */
  function renderReview() {
    var interests = state.interests.slice();
    if (state.customInterest.trim()) interests.push(state.customInterest.trim());

    var paceMap = { relaxed: "轻松", standard: "标准", packed: "紧凑" };
    var dates = (state.startDate || state.endDate)
      ? (state.startDate || "?") + " ~ " + (state.endDate || "?")
      : "未确定";

    var inputSummary = state.inputMethods.map(function(m) {
      if (m === "upload") return "截图(" + state.uploadedImages.length + "张)";
      if (m === "paste") return "粘贴文本";
      if (m === "search") return "AI搜索(" + state.selectedSearchResults.length + "个结果)";
      return m;
    }).join("、");

    var html = "";

    html += reviewSection("资料来源", [
      ["输入方式", inputSummary],
    ], 1);

    html += reviewSection("行程信息", [
      ["目的地", state.destination],
      ["日期", dates],
      ["节奏", paceMap[state.pace] || state.pace],
    ], 2);

    html += reviewSection("兴趣偏好", [
      ["类型", interests.length ? interests.join("、") : "未选择"],
    ], 3);

    var placeItems = [];
    if (state.mustGoPlaces.length) placeItems.push(["必去", state.mustGoPlaces.join("、")]);
    if (state.avoidPlaces.length) placeItems.push(["避开", state.avoidPlaces.join("、")]);
    if (state.hotelName) placeItems.push(["酒店", state.hotelName + (state.hotelAddress ? " (" + state.hotelAddress + ")" : "")]);
    if (state.transportInfo) placeItems.push(["交通", state.transportInfo]);
    if (!placeItems.length) placeItems.push(["状态", "未添加额外信息"]);
    html += reviewSection("景点与住宿", placeItems, 4);

    $("reviewContent").innerHTML = html;

    $$(".review-section .edit-link").forEach(function(link) {
      link.addEventListener("click", function() {
        goToStep(parseInt(link.dataset.step));
      });
    });
  }

  function reviewSection(title, items, stepNum) {
    var html = '<div class="review-section">';
    html += "<h3>" + title;
    html += ' <span class="edit-link" data-step="' + stepNum + '">编辑</span></h3>';
    items.forEach(function(item) {
      html += '<div class="review-item"><span class="label">' + item[0] + '</span><span class="value">' + escHtml(item[1]) + "</span></div>";
    });
    html += "</div>";
    return html;
  }

  /* ===== Generate Roadbook ===== */
  function generateRoadbook() {
    var interests = state.interests.slice();
    if (state.customInterest.trim()) interests.push(state.customInterest.trim());

    var today = new Date();
    var startDate = state.startDate || formatDate(new Date(today.getTime() + 7 * 86400000));
    var endDate = state.endDate || formatDate(new Date(today.getTime() + 9 * 86400000));

    var numDays = calcDays(startDate, endDate);
    if (numDays < 1) numDays = 3;
    if (numDays > 10) numDays = 10;

    // Build source records
    var sourceRecords = [];
    var sourceIdx = 1;

    if (state.uploadedImages.length > 0) {
      sourceRecords.push({
        id: "shot-" + String(sourceIdx++).padStart(3, "0"),
        type: "booking-screenshot",
        platform: "user-screenshot",
        url: null,
        title: "用户上传攻略截图 (" + state.uploadedImages.length + "张)",
        capturedAt: new Date().toISOString(),
        excerpt: "用户上传的攻略/预订截图已接收，内容将用于行程规划。",
        accessStatus: "read",
        confidence: "high",
      });
    }

    if (state.pastedText.trim()) {
      sourceRecords.push({
        id: "paste-" + String(sourceIdx++).padStart(3, "0"),
        type: "pasted-note",
        platform: "user-paste",
        url: null,
        title: "用户粘贴的攻略文本",
        capturedAt: new Date().toISOString(),
        excerpt: state.pastedText.substring(0, 200) + (state.pastedText.length > 200 ? "..." : ""),
        accessStatus: "read",
        confidence: "medium",
      });
    }

    if (state.searchResults.length > 0 && state.selectedSearchResults.length > 0) {
      var selectedNames = state.selectedSearchResults.map(function(i) {
        return state.searchResults[i] ? state.searchResults[i].name : "";
      }).filter(Boolean);
      sourceRecords.push({
        id: "ai-search-" + String(sourceIdx++).padStart(3, "0"),
        type: "guide",
        platform: "ai-search",
        url: null,
        title: "AI搜索推荐: " + state.searchQuery,
        capturedAt: new Date().toISOString(),
        excerpt: "AI推荐景点: " + selectedNames.join("、"),
        accessStatus: "read",
        confidence: "medium",
      });
    }

    // Build lodging
    var lodging = [];
    if (state.hotelName) {
      lodging.push({
        name: state.hotelName,
        address: state.hotelAddress || "待确认",
        checkIn: startDate,
        checkOut: endDate,
        notes: "请在出行前确认预订详情。",
        sourceIds: [],
        confidence: "medium",
      });
    } else {
      lodging.push({
        name: "待定（建议住在" + state.destination + "市中心）",
        address: state.destination,
        checkIn: startDate,
        checkOut: endDate,
        notes: "未提供酒店信息，建议提前预订并确认位置。",
        sourceIds: [],
        confidence: "low",
      });
    }

    // Build transport
    var transport = [];
    if (state.transportInfo) {
      transport.push({
        type: "user-note",
        from: "N/A",
        to: "N/A",
        departAt: "见备注",
        arriveAt: "见备注",
        notes: state.transportInfo,
        sourceIds: [],
        confidence: "medium",
      });
    }

    // Build days - distribute places across days
    var allPlaces = [];
    // Add must-go places
    state.mustGoPlaces.forEach(function(p) {
      allPlaces.push({ name: p, mustGo: true, source: "用户指定" });
    });
    // Add selected search results
    state.selectedSearchResults.forEach(function(idx) {
      var r = state.searchResults[idx];
      if (r) {
        var exists = allPlaces.some(function(p) { return p.name === r.name; });
        if (!exists) {
          allPlaces.push({ name: r.name, mustGo: false, source: "AI推荐", type: r.type, desc: r.desc });
        }
      }
    });

    // If no places at all, add destination as a single stop
    if (allPlaces.length === 0) {
      allPlaces.push({ name: state.destination + "市区", mustGo: false, source: "默认" });
    }

    var days = [];
    var placesPerDay = state.pace === "relaxed" ? 3 : state.pace === "packed" ? 7 : 5;
    var placeIdx = 0;

    for (var d = 0; d < numDays; d++) {
      var dayDate = addDays(startDate, d);
      var dayStops = [];
      var isFirst = d === 0;
      var isLast = d === numDays - 1;

      var dayTitle = isFirst ? "到达 + 初探" : isLast ? "收尾 + 返程缓冲" : "Day " + (d + 1);
      var daySummary = isFirst ? "到达日轻松安排，熟悉环境。" : isLast ? "最后游览，预留返程时间。" : "全天游览景点。";

      var numStops = Math.min(placesPerDay, allPlaces.length - placeIdx);
      if (isLast && numStops > 2) numStops = 2; // lighter departure day

      var baseTime = isFirst ? 14 : 9;
      for (var s = 0; s < numStops; s++) {
        var place = allPlaces[placeIdx];
        if (!place) break;

        var timeStr = String(baseTime).padStart(2, "0") + ":00";
        var duration = 90;
        if (place.type === "museum") duration = 150;
        if (place.type === "food" || place.type === "food/shopping") duration = 90;
        if (place.type === "landmark") duration = 75;

        var stopName = place.name;
        var stopDesc = place.desc || ("游览" + place.name);
        var stopType = place.type || "stop";

        dayStops.push({
          time: timeStr,
          name: stopName,
          type: stopType,
          description: stopDesc,
          durationMinutes: duration,
          mustGo: place.mustGo || false,
          mapQueries: {
            amap: stopName,
            google: stopName + " " + state.destination,
            apple: stopName + " " + state.destination,
          },
          source: place.source,
          sourceIds: [],
          confidence: place.source === "用户指定" ? "high" : "medium",
        });

        placeIdx++;
        baseTime += Math.ceil(duration / 60) + 1; // add duration + 1h buffer
      }

      // Add hotel stop on first and last day
      if (isFirst && state.hotelName) {
        dayStops.unshift({
          time: "12:30",
          name: state.hotelName,
          type: "lodging",
          description: "到达酒店，存放行李。",
          durationMinutes: 30,
          mapQueries: {
            amap: state.hotelName,
            google: state.hotelName + " " + state.destination,
            apple: state.hotelName + " " + state.destination,
          },
          source: "用户提供",
          sourceIds: [],
          confidence: "high",
        });
      }

      if (isLast) {
        dayStops.push({
          time: "15:00",
          name: "返程缓冲",
          type: "buffer",
          description: "预留充足时间前往机场/车站，建议提前3小时。",
          durationMinutes: 180,
          deadline: "根据航班/车次时间提前出发",
          fallback: "如行程超时可跳过最后景点",
          mapQueries: {
            amap: state.destination,
            google: state.destination,
            apple: state.destination,
          },
          source: "行程规划",
          sourceIds: [],
          confidence: "medium",
        });
      }

      days.push({
        date: dayDate,
        title: dayTitle,
        summary: daySummary,
        stops: dayStops,
      });
    }

    // Build warnings
    var warnings = [];
    if (!state.startDate || !state.endDate) {
      warnings.push("出行日期为占位日期，请根据实际出行日期更新路书。");
    }
    if (!state.hotelName) {
      warnings.push("未提供酒店预订信息，请在出行前确认预订。");
    }
    if (!state.transportInfo) {
      warnings.push("未提供交通信息，请提前确认航班/车次时间。");
    }
    warnings.push("景点营业时间和交通班次未实时验证，建议出行前查官网确认。");
    if (state.avoidPlaces.length > 0) {
      warnings.push("注意避开以下地点: " + state.avoidPlaces.join("、"));
    }

    var roadbook = {
      trip: {
        title: state.destination + " " + numDays + "日路书",
        destination: state.destination,
        startDate: startDate,
        endDate: endDate,
        pace: state.pace,
        interests: interests.length ? interests : ["city walk"],
      },
      sourceRecords: sourceRecords,
      lodging: lodging,
      transport: transport,
      days: days,
      warnings: warnings,
    };

    state.roadbookJson = roadbook;

    // Render HTML using the London-style renderer
    if (typeof RoadbookRenderer !== "undefined") {
      var cssText = getInlineCSS();
      var heroImage = getHeroImage(state.destination);
      state.roadbookHtmlInline = RoadbookRenderer.renderRoadbook(roadbook, {
        cssText: cssText,
        heroImage: heroImage
      });
    }

    // Generate share link
    generateShareLink(roadbook);

    goToStep(6);
  }

  /* ===== Share Link Generation ===== */
  function generateShareLink(roadbook) {
    try {
      var jsonStr = JSON.stringify(roadbook);
      var compressed = LZString.compressToEncodedURIComponent(jsonStr);
      var baseUrl = window.location.href.split("#")[0];
      var shareUrl = baseUrl + "#r=" + compressed;

      // Set the share link input
      var shareInput = $("shareLink");
      if (shareInput) shareInput.value = shareUrl;

      // Generate QR code
      var qrImg = $("qrCodeImg");
      if (qrImg) {
        qrImg.src = "https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=8&data=" +
                     encodeURIComponent(shareUrl);
      }
    } catch(e) {
      console.error("Failed to generate share link:", e);
      var section = $("shareSection");
      if (section) section.style.display = "none";
    }
  }

  /* ===== Result Actions ===== */
  function setupResultActions() {
    $("openRoadbookBtn").addEventListener("click", function() {
      if (!state.roadbookHtmlInline) return;
      var blob = new Blob([state.roadbookHtmlInline], { type: "text/html" });
      var url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      // Revoke after a delay to allow the new tab to load
      setTimeout(function() { URL.revokeObjectURL(url); }, 10000);
    });

    $("downloadJsonBtn").addEventListener("click", function() {
      if (!state.roadbookJson) return;
      var blob = new Blob([JSON.stringify(state.roadbookJson, null, 2)], { type: "application/json" });
      downloadBlob(blob, slugify(state.destination) + "-roadbook.json");
    });

    $("downloadHtmlBtn").addEventListener("click", function() {
      if (!state.roadbookHtmlInline) return;
      var blob = new Blob([state.roadbookHtmlInline], { type: "text/html" });
      downloadBlob(blob, slugify(state.destination) + "-roadbook.html");
    });

    $("copyLinkBtn").addEventListener("click", function() {
      var shareInput = $("shareLink");
      if (!shareInput) return;
      shareInput.select();
      shareInput.setSelectionRange(0, 99999);
      try {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(shareInput.value);
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
    });
  }

  /* ===== Restart ===== */
  function restart() {
    state = {
      currentStep: 1,
      totalSteps: 6,
      inputMethods: [],
      uploadedImages: [],
      pastedText: "",
      searchQuery: "",
      searchResults: [],
      selectedSearchResults: [],
      destination: "",
      startDate: "",
      endDate: "",
      pace: "standard",
      interests: [],
      customInterest: "",
      mustGoPlaces: [],
      avoidPlaces: [],
      hotelName: "",
      hotelAddress: "",
      transportInfo: "",
      roadbookJson: null,
      roadbookHtml: null,
      roadbookHtmlInline: null,
    };

    // Reset form inputs
    $("pasteText").value = "";
    $("searchInput").value = "";
    $("destination").value = "";
    $("startDate").value = "";
    $("endDate").value = "";
    $("customInterest").value = "";
    $("mustGoInput").value = "";
    $("avoidInput").value = "";
    $("hotelName").value = "";
    $("hotelAddress").value = "";
    $("transportInfo").value = "";
    $("uploadPreview").innerHTML = "";
    $("searchResults").innerHTML = "";
    $("mustGoTags").innerHTML = "";
    $("avoidTags").innerHTML = "";

    // Reset selections
    $$(".input-method-card").forEach(function(c) { c.classList.remove("selected"); });
    $$(".chip").forEach(function(c) { c.classList.remove("selected"); });
    $$(".pace-card").forEach(function(c) { c.classList.remove("selected"); });
    var defaultPace = document.querySelector('.pace-card[data-pace="standard"]');
    if (defaultPace) defaultPace.classList.add("selected");

    hide($("uploadZone"));
    hide($("pasteZone"));
    hide($("searchZone"));

    show($("heroSection"));
    hide($("wizardContainer"));
    show($("stepNav"));
  }

  /* ===== Utilities ===== */
  function escHtml(s) {
    if (!s) return "";
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
  }

  function slugify(s) {
    var slug = (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return slug || "roadbook";
  }

  function formatDate(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function addDays(dateStr, n) {
    var d = new Date(dateStr);
    d.setDate(d.getDate() + n);
    return formatDate(d);
  }

  function calcDays(start, end) {
    if (!start || !end) return 3;
    var d1 = new Date(start);
    var d2 = new Date(end);
    var diff = Math.ceil((d2 - d1) / 86400000) + 1;
    return diff > 0 ? diff : 3;
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function getInlineCSS() {
    // Fetch the roadbook CSS from the loaded stylesheet
    for (var i = 0; i < document.styleSheets.length; i++) {
      var sheet = document.styleSheets[i];
      if (sheet.href && sheet.href.indexOf("roadbook.css") > -1) {
        try {
          var rules = sheet.cssRules || sheet.rules;
          if (rules) {
            var css = "";
            for (var j = 0; j < rules.length; j++) {
              css += rules[j].cssText + "\n";
            }
            return css;
          }
        } catch(e) {
          // Cross-origin stylesheet, fetch via XHR
        }
      }
    }
    // Fallback: fetch via XHR
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "assets/roadbook.css", false);
    try {
      xhr.send();
      if (xhr.status === 200) return xhr.responseText;
    } catch(e) {}
    return "";
  }

  /* ===== Boot ===== */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
