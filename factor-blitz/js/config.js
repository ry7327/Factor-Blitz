// config.js
// Central place for all fixed game configuration values.

export const RANKED_CONFIGS = [
  { id: "10x10", label: "1\u201310 \u00d7 1\u201310", minA: 1, maxA: 10, minB: 1, maxB: 10 },
  { id: "15x15", label: "1\u201315 \u00d7 1\u201315", minA: 1, maxA: 15, minB: 1, maxB: 15 },
  { id: "20x20", label: "1\u201320 \u00d7 1\u201320", minA: 1, maxA: 20, minB: 1, maxB: 20 },
  { id: "25x25", label: "1\u201325 \u00d7 1\u201325", minA: 1, maxA: 25, minB: 1, maxB: 25 },
];

export const RANKED_QUESTION_COUNT = 50; // Accuracy + Race
export const RANKED_TIME_TRIAL_SECONDS = 30;

export const ACCURACY_OPTIONS = [10, 25, 50, 75, 100];
export const RACE_OPTIONS = [10, 25, 50];
export const TIME_TRIAL_SECONDS = 30;

export const MAX_RANGE_DIGITS = 4; // range endpoints capped at 4 digits (0-9999)
export const MAX_RANGE_VALUE = 9999;

export const GAME_TYPES = {
  ACCURACY: "accuracy",
  RACE: "race",
  TIME_TRIAL: "time_trial",
};

export const MODES = {
  PRACTICE: "practice",
  RANKED: "ranked",
};
