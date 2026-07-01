/*!
 * roadbook-renderer.js
 *
 * Renders a roadbook JSON object into a London-style static HTML document
 * matching the aesthetic of https://howieu.github.io/travel/uk/london.html
 *
 * Self-contained IIFE module that attaches to window.RoadbookRenderer.
 */
(function (global) {
  'use strict';

  // ----------------------------------------------------------------------
  // Utilities
  // ----------------------------------------------------------------------

  function isObj(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function text(value, defaultStr) {
    if (value === undefined || value === null) {
      return defaultStr === undefined ? '' : String(defaultStr);
    }
    return String(value);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  function esc(value, defaultStr) {
    return escapeHtml(text(value, defaultStr));
  }

  function slugify(value) {
    var str = String(value === undefined || value === null ? '' : value);
    var slug = str.trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return slug || 'roadbook';
  }

  function quotePlus(value) {
    var str = String(value === undefined || value === null ? '' : value);
    return encodeURIComponent(str)
      .replace(/%20/g, '+')
      .replace(/[!'()*]/g, function (ch) {
        return '%' + ch.charCodeAt(0).toString(16).toUpperCase();
      });
  }

  // ----------------------------------------------------------------------
  // Data helpers
  // ----------------------------------------------------------------------

  function mapLinks(stop) {
    var queries = (stop && stop.mapQueries) || {};
    var name = text(stop && stop.name);
    var amap = text(queries.amap, name);
    var google = text(queries.google, name);
    var apple = text(queries.apple, google || name);
    return [
      ['Google Maps', 'https://www.google.com/maps/search/?api=1&query=' + quotePlus(google)],
      ['Apple Maps', 'https://maps.apple.com/?q=' + quotePlus(apple)],
      ['高德', 'https://uri.amap.com/search?keyword=' + quotePlus(amap)]
    ];
  }

  function allStops(data) {
    var stops = [];
    var days = data.days || [];
    for (var i = 0; i < days.length; i++) {
      var day = days[i];
      if (isObj(day)) {
        var dayStops = day.stops || [];
        for (var j = 0; j < dayStops.length; j++) {
          if (isObj(dayStops[j])) {
            stops.push(dayStops[j]);
          }
        }
      }
    }
    return stops;
  }

  function tripDates(trip) {
    var start = text(trip.startDate);
    var end = text(trip.endDate);
    return (start || end) ? (start + ' - ' + end) : 'Flexible dates';
  }

  function sourceRecords(data) {
    var records = data.sourceRecords;
    if (records === undefined || records === null) {
      records = data.sources;
    }
    if (!Array.isArray(records)) return [];
    var result = [];
    for (var i = 0; i < records.length; i++) {
      if (isObj(records[i])) result.push(records[i]);
    }
    return result;
  }

  // ----------------------------------------------------------------------
  // Validation
  // ----------------------------------------------------------------------

  function validateRoadbook(data) {
    var errors = [];
    var trip = data.trip;
    if (!isObj(trip)) return ['missing trip object'];
    var fields = ['title', 'destination'];
    for (var i = 0; i < fields.length; i++) {
      if (!trip[fields[i]]) errors.push('missing trip.' + fields[i]);
    }
    var days = data.days;
    if (!Array.isArray(days) || !days.length) {
      errors.push('missing days');
      return errors;
    }
    for (var di = 0; di < days.length; di++) {
      var dayIndex = di + 1;
      var day = days[di];
      if (!isObj(day)) { errors.push('days[' + dayIndex + '] is not an object'); continue; }
      if (!day.date) errors.push('days[' + dayIndex + '] missing date');
      var stops = day.stops;
      if (!Array.isArray(stops) || !stops.length) {
        errors.push('days[' + dayIndex + '] missing stops');
        continue;
      }
      for (var si = 0; si < stops.length; si++) {
        var stopIndex = si + 1;
        var stop = stops[si];
        if (!isObj(stop)) {
          errors.push('days[' + dayIndex + '].stops[' + stopIndex + '] is not an object');
        } else if (!stop.name) {
          errors.push('days[' + dayIndex + '].stops[' + stopIndex + '] missing name');
        }
      }
    }
    return errors;
  }

  // ----------------------------------------------------------------------
  // Render helpers
  // ----------------------------------------------------------------------

  function renderSummary(data) {
    var trip = data.trip;
    var stops = allStops(data);
    var days = data.days || [];
    var items = [
      [days.length + ' days', ''],
      [esc(trip.destination, '目的地'), ''],
      [esc(text(trip.pace, 'standard'), '')]
    ];
    var out = '';
    for (var i = 0; i < items.length; i++) {
      out += '<div><b>' + items[i][0] + '</b></div>';
    }
    return out;
  }

  function renderQuickLinks(data) {
    var days = data.days || [];
    var links = '';
    for (var i = 0; i < days.length; i++) {
      var day = days[i];
      var dayId = 'day-' + (i + 1) + '-' + slugify(text(day.title));
      var label = 'Day ' + (i + 1) + ' · ' + text(day.title);
      links += '<a href="#' + esc(dayId) + '">' + esc(label) + '</a>';
    }
    return '<div class="quick-links"><h2>路线跳转</h2>' + links + '</div>';
  }

  function renderLodging(data) {
    var lodging = data.lodging || [];
    if (!lodging.length) return '';
    var cards = '';
    for (var i = 0; i < lodging.length; i++) {
      var item = lodging[i];
      cards += '<div class="info-card">';
      cards += '<h3>' + esc(item.name, '住宿') + '</h3>';
      var meta = [text(item.checkIn), text(item.checkOut)].filter(Boolean).join(' / ');
      if (meta) cards += '<p class="muted">' + esc(meta) + '</p>';
      if (item.address) cards += '<p>' + esc(item.address) + '</p>';
      if (item.notes) cards += '<p>' + esc(item.notes) + '</p>';
      cards += '</div>';
    }
    return '<div class="info-section"><h2>住宿</h2>' + cards + '</div>';
  }

  function renderTransport(data) {
    var transport = data.transport || [];
    if (!transport.length) return '';
    var cards = '';
    for (var i = 0; i < transport.length; i++) {
      var item = transport[i];
      cards += '<div class="info-card">';
      cards += '<h3>' + esc(item.type, '交通') + '</h3>';
      var meta = [text(item.from), text(item.to)].filter(Boolean).join(' -> ');
      if (meta) cards += '<p class="muted">' + esc(meta) + '</p>';
      var body = [text(item.departAt), text(item.arriveAt)].filter(Boolean).join(' / ');
      if (body) cards += '<p>' + esc(body) + '</p>';
      if (item.notes) cards += '<p>' + esc(item.notes) + '</p>';
      cards += '</div>';
    }
    return '<div class="info-section"><h2>交通</h2>' + cards + '</div>';
  }

  function renderSources(data) {
    var records = sourceRecords(data);
    if (!records.length) return '';
    var cards = '';
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      cards += '<div class="info-card source-card">';
      cards += '<h3>' + esc(r.title || r.url || r.id, '来源') + '</h3>';
      var meta = [r.id, r.platform, r.confidence].filter(Boolean).join(' · ');
      if (meta) cards += '<p class="muted">' + esc(meta) + '</p>';
      if (r.excerpt) cards += '<p>' + esc(r.excerpt) + '</p>';
      if (r.url) cards += '<a href="' + esc(r.url) + '" target="_blank" rel="noopener">打开来源</a>';
      cards += '</div>';
    }
    return '<div class="info-section"><h2>资料来源</h2>' + cards + '</div>';
  }

  function renderWarnings(data) {
    var warnings = data.warnings || [];
    if (!warnings.length) return '';
    var items = '';
    for (var i = 0; i < warnings.length; i++) {
      items += '<li>' + esc(warnings[i]) + '</li>';
    }
    return '<div class="warnings"><h2>出发前确认</h2><ul>' + items + '</ul></div>';
  }

  function renderStop(stop, index) {
    var mapped = mapLinks(stop);
    var links = '';
    for (var i = 0; i < mapped.length; i++) {
      links += '<a href="' + esc(mapped[i][1]) + '" target="_blank" rel="noopener">' + esc(mapped[i][0]) + '</a>';
    }
    // Extra links from stop.links
    var stopLinks = stop.links || [];
    for (var j = 0; j < stopLinks.length; j++) {
      var link = stopLinks[j];
      var label = esc(link.label, 'Link');
      var url = esc(link.url);
      if (url) links += '<a href="' + url + '" target="_blank" rel="noopener">' + label + '</a>';
    }

    // Image: use data-query for lazy loading via Wikimedia Commons API
    var stopName = text(stop.name);
    var imageQuery = encodeURIComponent(stopName);
    var imgHtml = '<figure class="stop-media">' +
      '<div class="stop-media-placeholder" data-query="' + esc(imageQuery) + '">加载图片中...</div>' +
      '<figcaption>Representative image: ' + esc(stopName) + '</figcaption>' +
      '</figure>';

    // Description with optional deadline and fallback
    var descHtml = '<p>' + esc(stop.description);
    if (stop.deadline) {
      descHtml += '<span class="deadline">' + esc(stop.deadline) + '</span>';
    }
    descHtml += '</p>';
    if (stop.fallback) {
      descHtml += '<p class="fallback">备选：' + esc(stop.fallback) + '</p>';
    }

    // Source info
    var sourceHtml = '';
    if (stop.source || stop.confidence) {
      sourceHtml = '<p class="source">来源：' + esc(stop.source) + ' · 置信度：' + esc(stop.confidence) + '</p>';
    }

    // Badges
    var badgesHtml = '';
    if (stop.mustGo) {
      badgesHtml += '<span class="must">必去</span>';
    }
    if (stop.type) {
      badgesHtml += '<span>' + esc(stop.type) + '</span>';
    }
    var duration = stop.durationMinutes;
    if (typeof duration === 'number' && Number.isInteger(duration)) {
      badgesHtml += '<span>' + duration + ' min</span>';
    }
    if (badgesHtml) {
      badgesHtml = '<div class="badges">' + badgesHtml + '</div>';
    }

    return '<article class="stop">' +
      '<div class="time">' + esc(stop.time, 'flex') + '</div>' +
      '<div class="stop-body">' +
      '<h3>' + esc(stop.name) + '</h3>' +
      badgesHtml +
      imgHtml +
      descHtml +
      '<div class="stop-links">' + links + '</div>' +
      sourceHtml +
      '</div>' +
      '</article>';
  }

  // Inline script for fetching Wikimedia Commons images at runtime
  var IMAGE_FETCH_SCRIPT = `
<script>
(function(){
  var placeholders = document.querySelectorAll('.stop-media-placeholder[data-query]');
  placeholders.forEach(function(el){
    var query = decodeURIComponent(el.dataset.query);
    var url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch=' +
              encodeURIComponent(query) + '&gsrnamespace=6&gsrlimit=1&prop=imageinfo&iiprop=url&iiurlwidth=800&origin=*';
    fetch(url).then(function(r){return r.json();}).then(function(data){
      if(!data.query||!data.query.pages) return;
      var pages = data.query.pages;
      for(var key in pages){
        var page = pages[key];
        if(page.imageinfo && page.imageinfo[0] && page.imageinfo[0].thumburl){
          var img = document.createElement('img');
          img.src = page.imageinfo[0].thumburl;
          img.alt = 'Representative image: ' + query;
          img.loading = 'lazy';
          img.decoding = 'async';
          img.referrerpolicy = 'no-referrer';
          el.parentElement.insertBefore(img, el);
          el.remove();
          break;
        }
      }
    }).catch(function(){});
  });
})();
</script>`;

  // ----------------------------------------------------------------------
  // Top-level render
  // ----------------------------------------------------------------------

  function renderRoadbook(data, options) {
    options = options || {};
    var cssText = options.cssText || '';
    var heroImage = options.heroImage || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?q=80&w=1800&auto=format&fit=crop';

    var trip = data.trip;
    var interests = (trip.interests || []).map(function (item) { return text(item); });
    var days = data.days || [];

    // Build top nav
    var navLinks = '';
    for (var i = 0; i < days.length; i++) {
      var dayId = 'day-' + (i + 1) + '-' + slugify(text(days[i].title));
      navLinks += '<a href="#' + esc(dayId) + '">Day ' + (i + 1) + '</a>';
    }
    navLinks += '<a href="#warnings">提醒</a>';

    // Build hero
    var chipsHtml = '';
    for (var ci = 0; ci < interests.length; ci++) {
      chipsHtml += '<span>' + esc(interests[ci]) + '</span>';
    }

    // Build side panel
    var sidePanelHtml =
      '<div class="summary">' + renderSummary(data) + '</div>' +
      renderQuickLinks(data) +
      '<iframe title="' + esc(trip.destination) + ' map" src="https://www.google.com/maps?q=' +
      quotePlus(trip.destination) + '&output=embed" loading="lazy"></iframe>' +
      renderLodging(data) +
      renderTransport(data) +
      renderSources(data) +
      renderWarnings(data);

    // Build days
    var daysHtml = '';
    for (var d = 0; d < days.length; d++) {
      var day = days[d];
      var dId = 'day-' + (d + 1) + '-' + slugify(text(day.title));
      var stopsHtml = '';
      var stops = day.stops || [];
      for (var s = 0; s < stops.length; s++) {
        stopsHtml += renderStop(stops[s], s);
      }
      daysHtml += '<section class="day-card" id="' + esc(dId) + '">' +
        '<div class="day-head">' +
        '<h2>Day ' + (d + 1) + ' · ' + esc(day.title) + '</h2>' +
        '<p>' + esc(day.summary) + '</p>' +
        '</div>' +
        '<div class="timeline">' + stopsHtml + '</div>' +
        '</section>';
    }

    var title = esc(trip.title);
    var heroSubtitle = esc(trip.destination) + ' · ' + esc(tripDates(trip));

    return '<!doctype html>\n' +
'<html lang="zh-CN">\n' +
'<head>\n' +
'  <meta charset="utf-8">\n' +
'  <meta name="viewport" content="width=device-width, initial-scale=1">\n' +
'  <title>' + title + '</title>\n' +
'  <style>\n' + cssText + '\n  </style>\n' +
'</head>\n' +
'<body>\n' +
'  <nav class="topnav" aria-label="Route navigation">\n' +
'    <a href="#">' + esc(trip.destination) + '</a>\n' +
      navLinks + '\n' +
'  </nav>\n\n' +
'  <header class="hero" style="background-image:linear-gradient(90deg,rgba(0,0,0,.62),rgba(0,0,0,.20)),url(\'' + esc(heroImage) + '\')">\n' +
'    <div class="hero-inner">\n' +
'      <div class="eyebrow">Travel Roadbook</div>\n' +
'      <h1>' + title + '</h1>\n' +
'      <p>' + heroSubtitle + '</p>\n' +
'      <div class="chips">' + chipsHtml + '</div>\n' +
'    </div>\n' +
'  </header>\n\n' +
'  <main class="layout">\n' +
'    <aside class="side-panel">\n' +
        sidePanelHtml + '\n' +
'    </aside>\n' +
'    <section class="days">\n' +
        daysHtml + '\n' +
'    </section>\n' +
'  </main>\n' +
      IMAGE_FETCH_SCRIPT + '\n' +
'</body>\n' +
'</html>';
  }

  // ----------------------------------------------------------------------
  // Public API
  // ----------------------------------------------------------------------

  global.RoadbookRenderer = {
    renderRoadbook: renderRoadbook,
    validateRoadbook: validateRoadbook,
    // helpers
    text: text,
    esc: esc,
    slugify: slugify,
    mapLinks: mapLinks,
    allStops: allStops,
    tripDates: tripDates,
    sourceRecords: sourceRecords
  };
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
