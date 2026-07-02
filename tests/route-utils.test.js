const assert = require("assert");
const {
  buildMapUrl,
  groupPlacesByDay,
  optimizeDayRoute,
} = require("../assets/route-utils.js");

function place(id, dayIndex, lat, lng) {
  return {
    id,
    name: id,
    dayIndex,
    lat,
    lng,
  };
}

function run() {
  const lodging = { id: "lodging", name: "Hotel", lat: 0, lng: 0 };

  const places = [
    place("far", 1, 0, 3),
    place("near", 1, 0, 1),
    place("day2", 2, 9, 9),
    place("missing", 1),
  ];

  const grouped = groupPlacesByDay(places, 2);
  assert.deepStrictEqual(grouped[0].map((item) => item.id), ["far", "near", "missing"]);
  assert.deepStrictEqual(grouped[1].map((item) => item.id), ["day2"]);

  const route = optimizeDayRoute({
    dayIndex: 1,
    lodging,
    places: grouped[0],
    provider: "google",
    transportMode: "walk_transit",
  });

  assert.strictEqual(route.orderedStops[0].id, "lodging");
  assert.strictEqual(route.orderedStops.at(-1).id, "lodging");
  assert.deepStrictEqual(route.orderedStops.slice(1, -1).map((item) => item.id), ["near", "far"]);
  assert.deepStrictEqual(route.unresolvedPlaces.map((item) => item.id), ["missing"]);
  assert(route.warnings.some((warning) => warning.includes("missing")));

  const appleUrl = buildMapUrl("apple", [
    { name: "Hotel" },
    { name: "Kiyomizu-dera" },
    { name: "Nishiki Market" },
  ]);
  assert(appleUrl.startsWith("https://maps.apple.com/?"));
  assert(appleUrl.includes("daddr=Kiyomizu-dera%2CNishiki%20Market"));
  assert(appleUrl.includes("dirflg=w"));
}

run();
console.log("route-utils tests passed");
