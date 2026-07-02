const assert = require("assert");
const {
  buildRoadbookDocument,
  decodeStaticShareHash,
  qrCodeUrl,
  sharePayload,
  staticShareUrl,
} = require("../assets/share-utils.js");

function run() {
  const state = {
    destination: "京都",
    lodging: { name: "京都站酒店" },
    routeResult: {
      days: [{
        dayIndex: 1,
        mapUrl: "https://maps.apple.com/?daddr=Kiyomizu-dera&dirflg=w",
        orderedStops: [
          { name: "京都站酒店", address: "Kyoto Station" },
          { name: "清水寺", notes: "上午去" },
        ],
      }],
    },
  };

  const html = buildRoadbookDocument(state);
  assert(html.startsWith("<!doctype html>"));
  assert(html.includes("京都 路书"));
  assert(html.includes('class="topnav"'));
  assert(html.includes('class="hero"'));
  assert(html.includes('class="side-panel"'));
  assert(html.includes("路线跳转"));
  assert(html.includes('href="#day-1"'));
  assert(html.includes('class="day-card" id="day-1"'));
  assert(html.includes('class="timeline"'));
  assert(html.includes("打开路线"));
  assert(html.includes("清水寺"));
  assert(html.includes("maps.apple.com"));

  const payload = sharePayload(state);
  assert.strictEqual(payload.title, "京都 路书");
  assert(payload.html.includes("<!doctype html>"));
  assert.strictEqual(payload.trip.destination, "京都");

  const staticUrl = staticShareUrl(state, "https://howieu.github.io/roadbook-studio/index.html");
  assert(staticUrl.startsWith("https://howieu.github.io/roadbook-studio/share.html#"));
  assert.strictEqual(decodeStaticShareHash(new URL(staticUrl).hash), html);

  const qr = qrCodeUrl("https://roadbook.example/share/abc");
  assert(qr.startsWith("https://api.qrserver.com/v1/create-qr-code/"));
  assert(qr.includes("data=https%3A%2F%2Froadbook.example%2Fshare%2Fabc"));
}

run();
console.log("share-utils tests passed");
