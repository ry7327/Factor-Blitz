// gameEngine.js
// Drives a single game session: question flow, timing, and scoring,
// for all three game types (accuracy, race, time_trial).

import { createQuestionBag } from "./questions.js";
import { GAME_TYPES } from "./config.js";

const TICK_MS = 100;

export class GameEngine {
  /**
   * @param {object} opts
   * @param {"practice"|"ranked"} opts.mode
   * @param {string} opts.gameType - one of GAME_TYPES
   * @param {number} opts.minA
   * @param {number} opts.maxA
   * @param {number} opts.minB
   * @param {number} opts.maxB
   * @param {number} [opts.targetQuestions] - for ACCURACY
   * @param {number} [opts.targetCorrect] - for RACE
   * @param {number} [opts.timeLimitSeconds] - for TIME_TRIAL
   */
  constructor(opts) {
    this.mode = opts.mode;
    this.gameType = opts.gameType;
    this.targetQuestions = opts.targetQuestions || null;
    this.targetCorrect = opts.targetCorrect || null;
    this.timeLimitSeconds = opts.timeLimitSeconds || null;

    this.bag = createQuestionBag(opts.minA, opts.maxA, opts.minB, opts.maxB);

    this.currentQuestion = null;
    this.correctCount = 0;
    this.incorrectCount = 0;
    this.attempted = 0;
    this.score = 0; // used for time trial (+1/-1)

    this.startTime = null;
    this.endTime = null;
    this.finished = false;
    this._tickHandle = null;
    this._locked = false; // true briefly while showing feedback

    // Callbacks (assigned by caller)
    this.onQuestion = null; // (question) => void
    this.onFeedback = null; // ({correct, correctAnswer, userAnswer}) => void
    this.onTick = null; // ({elapsedMs, remainingMs}) => void
    this.onFinish = null; // (results) => void
  }

  start() {
    this.startTime = performance.now();
    this._nextQuestion();
    if (this.gameType === GAME_TYPES.TIME_TRIAL || this.gameType === GAME_TYPES.RACE) {
      this._tickHandle = setInterval(() => this._tick(), TICK_MS);
    }
  }

  _tick() {
    if (this.finished) return;
    const elapsedMs = performance.now() - this.startTime;
    if (this.gameType === GAME_TYPES.TIME_TRIAL) {
      const remainingMs = Math.max(0, this.timeLimitSeconds * 1000 - elapsedMs);
      if (this.onTick) this.onTick({ elapsedMs, remainingMs });
      if (remainingMs <= 0) {
        this._finish();
      }
    } else if (this.gameType === GAME_TYPES.RACE) {
      if (this.onTick) this.onTick({ elapsedMs, remainingMs: null });
    }
  }

  _nextQuestion() {
    this.currentQuestion = this.bag.next();
    if (this.onQuestion) this.onQuestion(this.currentQuestion);
  }

  /**
   * Submit a user's answer. Ignored if a question isn't active or
   * we're mid-feedback / already finished.
   */
  submitAnswer(rawValue) {
    if (this.finished || this._locked || !this.currentQuestion) return;
    const userAnswer = Number(rawValue);
    const isCorrect = userAnswer === this.currentQuestion.answer;

    this.attempted += 1;
    if (isCorrect) {
      this.correctCount += 1;
      this.score += 1;
    } else {
      this.incorrectCount += 1;
      this.score -= 1;
    }

    if (this.onFeedback) {
      this.onFeedback({
        correct: isCorrect,
        correctAnswer: this.currentQuestion.answer,
        userAnswer,
      });
    }

    this._locked = true;
    const advanceDelay = isCorrect ? 250 : 1000;

    setTimeout(() => {
      this._locked = false;
      if (this._checkEndCondition()) {
        this._finish();
      } else {
        this._nextQuestion();
      }
    }, advanceDelay);
  }

  _checkEndCondition() {
    if (this.gameType === GAME_TYPES.ACCURACY) {
      return this.attempted >= this.targetQuestions;
    }
    if (this.gameType === GAME_TYPES.RACE) {
      return this.correctCount >= this.targetCorrect;
    }
    // TIME_TRIAL ends via the timer tick, not here.
    return false;
  }

  quit() {
    this._clearTick();
    this.finished = true;
  }

  _clearTick() {
    if (this._tickHandle) {
      clearInterval(this._tickHandle);
      this._tickHandle = null;
    }
  }

  _finish() {
    this._clearTick();
    this.finished = true;
    this.endTime = performance.now();
    const totalTimeMs = this.endTime - this.startTime;

    const results = {
      mode: this.mode,
      gameType: this.gameType,
      correctCount: this.correctCount,
      incorrectCount: this.incorrectCount,
      attempted: this.attempted,
      totalTimeMs,
      score: this.score,
    };

    if (this.gameType === GAME_TYPES.ACCURACY) {
      results.accuracyPct = this.attempted > 0
        ? Math.round((this.correctCount / this.attempted) * 100)
        : 0;
    } else if (this.gameType === GAME_TYPES.RACE) {
      results.accuracyPct = this.attempted > 0
        ? Math.round((this.correctCount / this.attempted) * 100)
        : 0;
    } else if (this.gameType === GAME_TYPES.TIME_TRIAL) {
      results.totalTimeMs = this.timeLimitSeconds * 1000;
    }

    if (this.onFinish) this.onFinish(results);
  }
}
