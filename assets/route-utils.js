(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.RouteUtils = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function hasCoords(place) {
    return place && typeof place.lat === "number" && typeof place.lng === "number";
  }

  function toRad(value) {
    return value * Math.PI / 180;
  }

  function distanceKm(a, b) {
    if (!hasCoords(a) || !hasCoords(b)) return Infinity;
    var earthKm = 6371;
    var dLat = toRad(b.lat - a.lat);
    var dLng = toRad(b.lng - a.lng);
    var lat1 = toRad(a.lat);
    var lat2 = toRad(b.lat);
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return earthKm * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  function groupPlacesByDay(places, dayCount) {
    var groups = [];
    for (var i = 0; i < dayCount; i++) groups.push([]);
    (places || []).forEach(function (place) {
      var index = Math.max(1, Math.min(dayCount, Number(place.dayIndex) || 1)) - 1;
      groups[index].push(place);
    });
    return groups;
  }

  function nearestNeighbor(start, places) {
    var remaining = places.slice();
    var ordered = [];
    var cursor = start;
    while (remaining.length) {
      var bestIndex = 0;
      var bestDistance = Infinity;
      for (var i = 0; i < remaining.length; i++) {
        var nextDistance = distanceKm(cursor, remaining[i]);
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

  function buildMapUrl(provider, orderedStops, transportMode) {
    var points = (orderedStops || []).filter(Boolean);
    if (!points.length) return "";
    if (provider === "amap") {
      var last = points[points.length - 1];
      return "https://uri.amap.com/navigation?to=" + pointLabel(last) +
        "&mode=" + (transportMode === "drive" ? "car" : "walk") +
        "&policy=1&src=roadbook-studio";
    }
    if (provider === "apple") {
      return "https://maps.apple.com/?daddr=" +
        points.slice(1).map(function (point) {
          return encodeURIComponent((point && (point.address || point.name)) || "");
        }).join("%2C") +
        "&dirflg=" + (transportMode === "drive" ? "d" : "w");
    }
    var origin = pointLabel(points[0]);
    var destination = pointLabel(points[points.length - 1]);
    var middle = points.slice(1, -1).map(pointLabel).join("%7C");
    var url = "https://www.google.com/maps/dir/?api=1&origin=" + origin +
      "&destination=" + destination + "&travelmode=walking";
    if (middle) url += "&waypoints=" + middle;
    return url;
  }

  function optimizeDayRoute(input) {
    var lodging = input.lodging;
    var warnings = [];
    var places = input.places || [];
    var resolved = [];
    var unresolved = [];

    places.forEach(function (place) {
      if (hasCoords(place)) {
        resolved.push(place);
      } else {
        unresolved.push(place);
        warnings.push("missing coordinates: " + (place.name || place.id || "unknown"));
      }
    });

    if (!hasCoords(lodging)) {
      warnings.push("lodging is missing coordinates; route order keeps the current place order");
      resolved = places.filter(hasCoords);
    }

    var orderedMiddle = hasCoords(lodging) ? nearestNeighbor(lodging, resolved) : resolved;
    var orderedStops = hasCoords(lodging) ? [lodging].concat(orderedMiddle, [lodging]) : orderedMiddle;
    var legs = [];
    for (var i = 0; i < orderedStops.length - 1; i++) {
      legs.push({
        from: orderedStops[i],
        to: orderedStops[i + 1],
        distanceKm: Number(distanceKm(orderedStops[i], orderedStops[i + 1]).toFixed(2)),
      });
    }

    return {
      dayIndex: input.dayIndex,
      orderedStops: orderedStops,
      legs: legs,
      mapUrl: buildMapUrl(input.provider || "google", orderedStops, input.transportMode || "walk_transit"),
      unresolvedPlaces: unresolved,
      warnings: warnings,
    };
  }

  return {
    hasCoords: hasCoords,
    distanceKm: distanceKm,
    groupPlacesByDay: groupPlacesByDay,
    optimizeDayRoute: optimizeDayRoute,
    buildMapUrl: buildMapUrl,
  };
});
