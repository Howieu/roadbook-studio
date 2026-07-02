import assert from "node:assert";
import { onRequestPost } from "../functions/api/share.js";
import { onRequestGet } from "../functions/share/[id].js";

class FakeKV {
  constructor() {
    this.store = new Map();
  }

  async put(key, value) {
    this.store.set(key, value);
  }

  async get(key) {
    return this.store.get(key) || null;
  }
}

const kv = new FakeKV();
const post = await onRequestPost({
  env: { ROADBOOKS: kv },
  request: new Request("https://roadbook.example/api/share", {
    method: "POST",
    body: JSON.stringify({
      title: "京都 路书",
      html: "<!doctype html><html><body>京都</body></html>",
    }),
  }),
});

assert.strictEqual(post.status, 200);
const body = await post.json();
assert.match(body.url, /^https:\/\/roadbook\.example\/share\/[a-f0-9]{16}$/);

const get = await onRequestGet({
  env: { ROADBOOKS: kv },
  params: { id: body.id },
});

assert.strictEqual(get.status, 200);
assert.strictEqual(get.headers.get("Content-Type"), "text/html; charset=utf-8");
assert.strictEqual(await get.text(), "<!doctype html><html><body>京都</body></html>");

const tooLarge = await onRequestPost({
  env: { ROADBOOKS: kv },
  request: new Request("https://roadbook.example/api/share", {
    method: "POST",
    body: JSON.stringify({
      title: "Too large",
      html: "<!doctype html>" + "x".repeat(1_000_001),
    }),
  }),
});

assert.strictEqual(tooLarge.status, 413);

console.log("share-api tests passed");
