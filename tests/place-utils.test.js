const assert = require("assert");
const { fallbackExtractPlaces } = require("../assets/place-utils.js");

function names(text) {
  return fallbackExtractPlaces(text).map((place) => place.name);
}

function run() {
  assert.deepStrictEqual(
    names("Day1 清水寺、二年坂三年坂、%Arabica 咖啡\nDay2 伏见稻荷大社、锦市场午餐"),
    ["清水寺", "二年坂三年坂", "%Arabica 咖啡", "伏见稻荷大社", "锦市场"]
  );

  assert.deepStrictEqual(
    names("第一次去京都，想看清水寺、伏见稻荷、祇园，想拍和服照片，吃咖啡甜品和锦市场小吃，路线不要绕"),
    ["清水寺", "伏见稻荷", "祇园", "锦市场"]
  );
}

run();
console.log("place-utils tests passed");
