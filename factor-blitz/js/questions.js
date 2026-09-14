// questions.js
// Generates multiplication problems for a given factor range, avoiding
// repeats until every unique combination has been used at least once.

/**
 * Creates a question generator/"bag" for a given range of factors.
 * @param {number} minA
 * @param {number} maxA
 * @param {number} minB
 * @param {number} maxB
 * @returns {{ next: () => {a:number, b:number} }}
 */
export function createQuestionBag(minA, maxA, minB, maxB) {
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

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  refillAndShuffle();

  let lastPair = null;

  return {
    next() {
      if (bag.length === 0) {
        refillAndShuffle();
        // Avoid an immediate repeat of the very last question shown,
        // when there's more than one possible question.
        if (allPairs.length > 1 && bag[bag.length - 1].join(",") === (lastPair || []).join(",")) {
          // swap it away from the end
          const swapIdx = Math.floor(Math.random() * (bag.length - 1));
          [bag[bag.length - 1], bag[swapIdx]] = [bag[swapIdx], bag[bag.length - 1]];
        }
      }
      const [a, b] = bag.pop();
      lastPair = [a, b];
      return { a, b, answer: a * b };
    },
    totalUnique: allPairs.length,
  };
}
