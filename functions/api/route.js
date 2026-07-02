const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function hasCoords(place) {
  return place && typeof place.lat === "number" && typeof place.lng === "number";
}

function toRad(value) {
  return value * Math.PI / 180;
}

function distanceKm(a, b) {
  if (!hasCoords(a) || !hasCoords(b)) return Infinity;
  const earthKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthKm * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function nearestNeighbor(start, places) {
  const remaining = places.slice();
  const ordered = [];
  let cursor = start;
  while (remaining.length) {
    let bestIndex = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const nextDistance = distanceKm(cursor, remaining[i]);
      if (nextDistance < bestDistance) {
        bestDistance = nextDistance;
        bestIndex = i;
      }
    }
    cursor = remaining.splice(bestIndex, 1)[0];
    ordered.push(cursor);
  }
  return ordered;
}

function pointLabel(point) {
  return encodeURIComponent((point && (point.address || point.name)) || "");
}

function mapUrl(provider, stops) {
  if (!stops.length) return "";
  if (provider === "amap") {
    const last = stops[stops.length - 1];
    return `https://uri.amap.com/navigation?to=${pointLabel(last)}&mode=walk&policy=1&src=roadbook-studio`;
  }
  if (provider === "apple") {
    return "https://maps.apple.com/?daddr=" +
      stops.slice(1).map((point) => encodeURIComponent((point && (point.address || point.name)) || "")).join("%2C") +
      "&dirflg=w";
  }
  const origin = pointLabel(stops[0]);
  const destination = pointLabel(stops[stops.length - 1]);
  const waypoints = stops.slice(1, -1).map(pointLabel).join("%7C");
  return "https://www.google.com/maps/dir/?api=1&origin=" + origin +
    "&destination=" + destination +
    (waypoints ? "&waypoints=" + waypoints : "") +
    "&travelmode=walking";
}

async function geocodeGoogle(place, env, destination, warnings) {
  const key = env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    warnings.push(`Google Maps key missing; cannot geocode ${place.name}.`);
    return place;
  }
  const query = [place.address, place.name, destination].filter(Boolean).join(" ");
  const url = "https://maps.googleapis.com/maps/api/geocode/json?address=" +
    encodeURIComponent(query) + "&key=" + encodeURIComponent(key);
  const res = await fetch(url);
  const data = await res.json();
  const hit = data && data.results && data.results[0];
  if (!hit || !hit.geometry || !hit.geometry.location) {
    warnings.push(`Google could not geocode ${place.name}.`);
    return place;
  }
  return {
    ...place,
    address: place.address || hit.formatted_address || "",
    lat: hit.geometry.location.lat,
    lng: hit.geometry.location.lng,
  };
}

async function geocodeAmap(place, env, destination, warnings) {
  const key = env.AMAP_API_KEY || env.GAODE_API_KEY;
  if (!key) {
    warnings.push(`AMAP key missing; cannot geocode ${place.name}.`);
    return place;
  }
  const query = [place.address, place.name].filter(Boolean).join(" ") || destination;
  const url = "https://restapi.amap.com/v3/geocode/geo?address=" +
    encodeURIComponent(query) + "&city=" + encodeURIComponent(destination || "") +
    "&key=" + encodeURIComponent(key);
  const res = await fetch(url);
  const data = await res.json();
  const hit = data && data.geocodes && data.geocodes[0];
  if (!hit || !hit.location) {
    warnings.push(`高德无法定位 ${place.name}.`);
    return place;
  }
  const parts = String(hit.location).split(",").map(Number);
  return {
    ...place,
    address: place.address || hit.formatted_address || "",
    lng: parts[0],
    lat: parts[1],
  };
}

async function geocode(place, provider, env, destination, warnings) {
  if (hasCoords(place)) return place;
  if (provider === "amap") return geocodeAmap(place, env, destination, warnings);
  if (provider === "apple") {
    warnings.push(`Apple Maps does not provide server geocoding here; using Google geocoding for ${place.name}.`);
  }
  return geocodeGoogle(place, env, destination, warnings);
}

async function optimizeDay(day, input, env, warnings) {
  const provider = input.provider || "google";
  const lodging = await geocode({
    id: "lodging",
    name: input.lodging && input.lodging.name || "住宿",
    address: input.lodging && input.lodging.address || "",
  }, provider, env, input.destination, warnings);

  const geocoded = [];
  for (const place of day.places || []) {
    geocoded.push(await geocode(place, provider, env, input.destination, warnings));
  }

  const resolved = geocoded.filter(hasCoords);
  const unresolved = geocoded.filter((place) => !hasCoords(place));
  const dayWarnings = unresolved.map((place) => `missing coordinates: ${place.name}`);

  let orderedStops;
  if (hasCoords(lodging)) {
    orderedStops = [lodging, ...nearestNeighbor(lodging, resolved), lodging];
  } else {
    dayWarnings.push("lodging is missing coordinates; route order keeps current place order");
    orderedStops = [lodging, ...geocoded, lodging];
  }

  const legs = [];
  for (let i = 0; i < orderedStops.length - 1; i++) {
    legs.push({
      from: orderedStops[i],
      to: orderedStops[i + 1],
      distanceKm: Number(distanceKm(orderedStops[i], orderedStops[i + 1]).toFixed(2)),
    });
  }

  return {
    dayIndex: day.dayIndex,
    orderedStops,
    legs,
    mapUrl: mapUrl(provider, orderedStops),
    unresolvedPlaces: unresolved,
    warnings: dayWarnings,
  };
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS_HEADERS });
}

export async function onRequestPost(context) {
  let body;
  try {
    body = await context.request.json();
  } catch (err) {
    return json({ days: [], unresolvedPlaces: [], warnings: ["请求体不是合法 JSON。"] }, 400);
  }

  const warnings = [];
  const days = [];
  for (const day of body.days || []) {
    days.push(await optimizeDay(day, body, context.env || {}, warnings));
  }
  const unresolvedPlaces = days.flatMap((day) => day.unresolvedPlaces || []);
  return json({ days, unresolvedPlaces, warnings });
}
