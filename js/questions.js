// questions.js
// Generates multiplication problems for a given factor range, avoiding
// repeats until every unique combination has been used at least once.
//
// For reasonably sized ranges (the vast majority of real use), this
// pre-builds every combination and shuffles it into a "bag" so that no
// question repeats until the bag runs out, per spec. For very large
// ranges (e.g. someone enters 0-9999 on both factors in Advanced mode,
// ~100 million combinations) pre-building the full list would exhaust
// memory and hang the browser tab, so above a threshold this instead
// generates random pairs on the fly, only avoiding *recent* repeats.
// At that scale the player will never notice the difference.

const EAGER_BUILD_LIMIT = 5000;

export function createQuestionBag(minA, maxA, minB, maxB) {
  const totalUnique = (maxA - minA + 1) * (maxB - minB + 1);

  if (totalUnique <= EAGER_BUILD_LIMIT) {
    return createEagerBag(minA, maxA, minB, maxB, totalUnique);
  }
  return createLazyBag(minA, maxA, minB, maxB, totalUnique);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function createEagerBag(minA, maxA, minB, maxB, totalUnique) {
  const allPairs = [];
  for (let a = minA; a <= maxA; a++) {
    for (let b = minB; b <= maxB; b++) {
      allPairs.push([a, b]);
    }
  }

  let bag = [];
  function refillAndShuffle() {
    bag = shuffle([...allPairs]);
  }
  refillAndShuffle();

  let lastPair = null;

  return {
    next() {
      if (bag.length === 0) {
        refillAndShuffle();
        if (allPairs.length > 1 && bag[bag.length - 1].join(",") === (lastPair || []).join(",")) {
          const swapIdx = Math.floor(Math.random() * (bag.length - 1));
          [bag[bag.length - 1], bag[swapIdx]] = [bag[swapIdx], bag[bag.length - 1]];
        }
      }
      const [a, b] = bag.pop();
      lastPair = [a, b];
      return { a, b, answer: a * b };
    },
    totalUnique,
  };
}

function createLazyBag(minA, maxA, minB, maxB, totalUnique) {
  const recentSize = 50;
  const recent = [];

  return {
    next() {
      let a, b, key;
      let attempts = 0;
      do {
        a = minA + Math.floor(Math.random() * (maxA - minA + 1));
        b = minB + Math.floor(Math.random() * (maxB - minB + 1));
        key = a + "," + b;
        attempts++;
      } while (recent.includes(key) && attempts < 20);

      recent.push(key);
      if (recent.length > recentSize) recent.shift();

      return { a, b, answer: a * b };
    },
    totalUnique,
  };
}
