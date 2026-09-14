// main.js
// Application entry point: screen navigation, form wiring, and gluing the
// GameEngine + leaderboard modules to the DOM.

import {
  RANKED_CONFIGS,
  RANKED_QUESTION_COUNT,
  RANKED_TIME_TRIAL_SECONDS,
  ACCURACY_OPTIONS,
  RACE_OPTIONS,
  TIME_TRIAL_SECONDS,
  MAX_RANGE_VALUE,
  GAME_TYPES,
  MODES,
} from "./config.js";
import { GameEngine } from "./gameEngine.js";
import { initTheme, toggleTheme } from "./theme.js";
import { fetchTopScores, doesQualify, submitScore, rankingValueFor } from "./leaderboard.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* ==========================================================================
   App state
   ========================================================================== */
const state = {
  mode: null, // 'practice' | 'ranked'
  practice: {
    rangeType: "single", // 'single' | 'advanced'
    minA: 1, maxA: 1, minB: 0, maxB: 12,
    gameType: null,
    accuracyTarget: 25,
    raceTarget: 25,
  },
  ranked: {
    config: null, // one of RANKED_CONFIGS
    gameType: null,
  },
  engine: null,
  lastRunConfig: null, // used for "Play again"
  lb: { configId: RANKED_CONFIGS[0].id, gameType: GAME_TYPES.ACCURACY },
};

/* ==========================================================================
   Screen navigation
   ========================================================================== */
function showScreen(id) {
  $$(".screen").forEach((s) => s.classList.remove("active"));
  $(`#${id}`).classList.add("active");
  window.scrollTo(0, 0);
}

/* ==========================================================================
   Init
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  $("#theme-toggle").addEventListener("click", () => {
    toggleTheme();
    refreshLeaderboardPreview();
  });

  wireHome();
  wirePracticeConfig();
  wireRankedConfig();
  wireGameScreen();
  wireResultsScreen();

  renderLeaderboardTabs();
  refreshLeaderboardPreview();
});

/* ==========================================================================
   Home
   ========================================================================== */
function wireHome() {
  $$(".mode-card").forEach((card) => {
    card.addEventListener("click", () => {
      const mode = card.dataset.mode;
      if (mode === "practice") {
        showScreen("screen-practice-config");
      } else {
        showScreen("screen-ranked-select");
      }
    });
  });
}

function renderLeaderboardTabs() {
  const configTabs = $("#lb-config-tabs");
  configTabs.innerHTML = "";
  RANKED_CONFIGS.forEach((cfg) => {
    const btn = document.createElement("button");
    btn.className = "lb-tab" + (cfg.id === state.lb.configId ? " active" : "");
    btn.textContent = cfg.label;
    btn.addEventListener("click", () => {
      state.lb.configId = cfg.id;
      renderLeaderboardTabs();
      refreshLeaderboardPreview();
    });
    configTabs.appendChild(btn);
  });

  const typeTabs = $("#lb-type-tabs");
  typeTabs.innerHTML = "";
  const types = [
    [GAME_TYPES.ACCURACY, "Accuracy"],
    [GAME_TYPES.RACE, "Race"],
    [GAME_TYPES.TIME_TRIAL, "Time Trial"],
  ];
  types.forEach(([type, label]) => {
    const btn = document.createElement("button");
    btn.className = "lb-tab" + (type === state.lb.gameType ? " active" : "");
    btn.textContent = label;
    btn.addEventListener("click", () => {
      state.lb.gameType = type;
      renderLeaderboardTabs();
      refreshLeaderboardPreview();
    });
    typeTabs.appendChild(btn);
  });
}

async function refreshLeaderboardPreview() {
  const wrap = $("#lb-table-wrap");
  wrap.innerHTML = `<p class="lb-empty">Loading leaderboard&hellip;</p>`;
  try {
    const rows = await fetchTopScores(state.lb.configId, state.lb.gameType);
    wrap.innerHTML = "";
    wrap.appendChild(renderLeaderboardTable(rows, state.lb.gameType));
  } catch (err) {
    wrap.innerHTML = `<p class="lb-empty">Leaderboards aren't connected yet.</p>`;
  }
}

function renderLeaderboardTable(rows, gameType) {
  const table = document.createElement("table");
  table.className = "lb-table";
  const scoreLabel =
    gameType === "race" ? "Time" : gameType === "time_trial" ? "Score" : "Correct";

  if (!rows.length) {
    const wrap = document.createElement("div");
    wrap.innerHTML = `<p class="lb-empty">No scores yet &mdash; be the first!</p>`;
    return wrap;
  }

  table.innerHTML = `
    <thead><tr><th>Rank</th><th>Initials</th><th>${scoreLabel}</th></tr></thead>
    <tbody>
      ${rows.map((r) => `
        <tr>
          <td class="rank">${r.rank}</td>
          <td class="initials">${r.initials}</td>
          <td class="score">${formatLbValue(r, gameType)}</td>
        </tr>
      `).join("")}
    </tbody>
  `;
  return table;
}

function formatLbValue(row, gameType) {
  if (gameType === "race") return formatTime(row.time_ms);
  if (gameType === "time_trial") return row.score;
  return `${row.correct_count}/${row.attempted}`;
}

/* ==========================================================================
   Practice config screen
   ========================================================================== */
function wirePracticeConfig() {
  const firstFactorSelect = $("#single-first-factor");
  for (let i = 1; i <= 20; i++) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = i;
    firstFactorSelect.appendChild(opt);
  }

  $$('[data-back="home"]').forEach((b) => b.addEventListener("click", () => showScreen("screen-home")));

  $$("#practice-range-type .segmented-opt").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$("#practice-range-type .segmented-opt").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.practice.rangeType = btn.dataset.rangeType;
      $("#single-range-fields").classList.toggle("hidden", state.practice.rangeType !== "single");
      $("#advanced-range-fields").classList.toggle("hidden", state.practice.rangeType !== "advanced");
      validatePracticeForm();
    });
  });

  ["single-first-factor", "single-min", "single-max", "adv-minA", "adv-maxA", "adv-minB", "adv-maxB"]
    .forEach((id) => $(`#${id}`).addEventListener("input", validatePracticeForm));

  renderGameTypeOptions("opts-accuracy", ACCURACY_OPTIONS, (val) => {
    state.practice.accuracyTarget = val;
  }, state.practice.accuracyTarget);
  renderGameTypeOptions("opts-race", RACE_OPTIONS, (val) => {
    state.practice.raceTarget = val;
  }, state.practice.raceTarget);

  $$("#practice-game-types .game-type-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest(".gt-opt")) return; // let the sub-option handler run instead
      $$("#practice-game-types .game-type-card").forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");
      state.practice.gameType = card.dataset.gameType;
      validatePracticeForm();
    });
  });

  $("#practice-start-btn").addEventListener("click", () => {
    const cfg = buildPracticeRunConfig();
    if (cfg) startGame(cfg);
  });

  validatePracticeForm();
}

function renderGameTypeOptions(containerId, options, onSelect, defaultVal) {
  const container = $(`#${containerId}`);
  container.innerHTML = "";
  options.forEach((val) => {
    const chip = document.createElement("span");
    chip.className = "gt-opt" + (val === defaultVal ? " selected" : "");
    chip.textContent = val;
    chip.addEventListener("click", (e) => {
      e.stopPropagation();
      Array.from(container.children).forEach((c) => c.classList.remove("selected"));
      chip.classList.add("selected");
      onSelect(val);
      // Also mark the parent card selected/chosen game type
      const card = container.closest(".game-type-card");
      $$("#practice-game-types .game-type-card").forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");
      state.practice.gameType = card.dataset.gameType;
      validatePracticeForm();
    });
    container.appendChild(chip);
  });
}

function readPracticeRange() {
  const p = state.practice;
  if (p.rangeType === "single") {
    return {
      minA: Number($("#single-first-factor").value),
      maxA: Number($("#single-first-factor").value),
      minB: Number($("#single-min").value),
      maxB: Number($("#single-max").value),
    };
  }
  return {
    minA: Number($("#adv-minA").value),
    maxA: Number($("#adv-maxA").value),
    minB: Number($("#adv-minB").value),
    maxB: Number($("#adv-maxB").value),
  };
}

function rangeIsValid({ minA, maxA, minB, maxB }) {
  const vals = [minA, maxA, minB, maxB];
  if (vals.some((v) => Number.isNaN(v) || v < 0 || v > MAX_RANGE_VALUE)) return false;
  if (minA > maxA || minB > maxB) return false;
  return true;
}

function validatePracticeForm() {
  const range = readPracticeRange();
  const valid = rangeIsValid(range);
  const errorEl = $("#practice-range-error");
  if (!valid) {
    errorEl.textContent = "Check your ranges: minimum can't exceed maximum, and values must be 0\u20139999.";
    errorEl.classList.remove("hidden");
  } else {
    errorEl.classList.add("hidden");
  }

  const gameTypeChosen = !!state.practice.gameType;
  $("#practice-start-btn").disabled = !(valid && gameTypeChosen);
}

function buildPracticeRunConfig() {
  const range = readPracticeRange();
  if (!rangeIsValid(range) || !state.practice.gameType) return null;

  const gameType = state.practice.gameType;
  const base = { mode: MODES.PRACTICE, gameType, ...range, rankedConfigId: null };

  if (gameType === GAME_TYPES.ACCURACY) base.targetQuestions = state.practice.accuracyTarget;
  if (gameType === GAME_TYPES.RACE) base.targetCorrect = state.practice.raceTarget;
  if (gameType === GAME_TYPES.TIME_TRIAL) base.timeLimitSeconds = TIME_TRIAL_SECONDS;

  return base;
}

/* ==========================================================================
   Ranked config screen
   ========================================================================== */
function wireRankedConfig() {
  const container = $("#ranked-config-cards");
  RANKED_CONFIGS.forEach((cfg) => {
    const btn = document.createElement("button");
    btn.className = "ranked-config-card";
    btn.textContent = cfg.label;
    btn.addEventListener("click", () => {
      $$(".ranked-config-card", container).forEach((c) => c.classList.remove("selected"));
      btn.classList.add("selected");
      state.ranked.config = cfg;
      validateRankedForm();
    });
    container.appendChild(btn);
  });

  $$("#ranked-game-types .game-type-card").forEach((card) => {
    card.addEventListener("click", () => {
      $$("#ranked-game-types .game-type-card").forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");
      state.ranked.gameType = card.dataset.gameType;
      validateRankedForm();
    });
  });

  $("#ranked-start-btn").addEventListener("click", () => {
    const cfg = buildRankedRunConfig();
    if (cfg) startGame(cfg);
  });
}

function validateRankedForm() {
  $("#ranked-start-btn").disabled = !(state.ranked.config && state.ranked.gameType);
}

function buildRankedRunConfig() {
  const { config, gameType } = state.ranked;
  if (!config || !gameType) return null;

  const base = {
    mode: MODES.RANKED,
    gameType,
    minA: config.minA, maxA: config.maxA, minB: config.minB, maxB: config.maxB,
    rankedConfigId: config.id,
  };
  if (gameType === GAME_TYPES.ACCURACY) base.targetQuestions = RANKED_QUESTION_COUNT;
  if (gameType === GAME_TYPES.RACE) base.targetCorrect = RANKED_QUESTION_COUNT;
  if (gameType === GAME_TYPES.TIME_TRIAL) base.timeLimitSeconds = RANKED_TIME_TRIAL_SECONDS;
  return base;
}

/* ==========================================================================
   Game screen
   ========================================================================== */
let quitConfirmArmed = false;

function wireGameScreen() {
  const answerInput = $("#game-answer");
  answerInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && answerInput.value.trim() !== "") {
      state.engine.submitAnswer(answerInput.value.trim());
      answerInput.value = "";
    }
  });

  $("#quit-btn").addEventListener("click", () => {
    if (!quitConfirmArmed) {
      quitConfirmArmed = true;
      $("#quit-btn").textContent = "Click again to quit";
      setTimeout(() => {
        quitConfirmArmed = false;
        $("#quit-btn").textContent = "Quit";
      }, 2500);
      return;
    }
    state.engine.quit();
    showScreen("screen-home");
  });
}

function startGame(runConfig) {
  state.lastRunConfig = runConfig;
  const screen = $("#screen-game");
  screen.dataset.mode = runConfig.mode;

  const answerInput = $("#game-answer");
  answerInput.value = "";
  $("#game-feedback").textContent = "";
  $("#game-feedback").className = "game-feedback";
  $("#game-indicator").textContent = "\u00a0";
  $("#game-indicator").classList.remove("urgent");
  $("#game-problem").textContent = "\u00a0";
  quitConfirmArmed = false;
  $("#quit-btn").textContent = "Quit";

  const engine = new GameEngine(runConfig);
  state.engine = engine;

  engine.onQuestion = (q) => {
    $("#game-problem").textContent = `${q.a} \u00d7 ${q.b}`;
    $("#game-feedback").textContent = "";
    $("#game-feedback").className = "game-feedback";
    updateIndicator(runConfig, engine);
  };

  engine.onFeedback = ({ correct, correctAnswer }) => {
    answerInput.classList.remove("flash-correct", "flash-incorrect");
    void answerInput.offsetWidth; // restart animation
    if (correct) {
      answerInput.classList.add("flash-correct");
      $("#game-feedback").textContent = "Correct";
      $("#game-feedback").className = "game-feedback correct";
    } else {
      answerInput.classList.add("flash-incorrect");
      $("#game-feedback").textContent = `Incorrect \u2014 answer was ${correctAnswer}`;
      $("#game-feedback").className = "game-feedback incorrect";
    }
    updateIndicator(runConfig, engine);
  };

  engine.onTick = () => updateIndicator(runConfig, engine);

  engine.onFinish = (results) => {
    showResults(runConfig, results);
  };

  showScreen("screen-game");
  engine.start();
  setTimeout(() => answerInput.focus(), 50);
}

function updateIndicator(runConfig, engine) {
  const el = $("#game-indicator");
  if (runConfig.gameType === GAME_TYPES.TIME_TRIAL) {
    const remaining = engine.timeLimitSeconds - (performance.now() - engine.startTime) / 1000;
    const clamped = Math.max(0, remaining);
    el.textContent = clamped.toFixed(1);
    el.classList.toggle("urgent", clamped <= 5);
  } else if (runConfig.gameType === GAME_TYPES.RACE) {
    el.textContent = `${engine.correctCount} / ${runConfig.targetCorrect}`;
  } else {
    el.textContent = `${engine.attempted} / ${runConfig.targetQuestions}`;
  }
}

/* ==========================================================================
   Results screen
   ========================================================================== */
function wireResultsScreen() {
  $("#play-again-btn").addEventListener("click", () => {
    if (state.lastRunConfig) startGame(state.lastRunConfig);
  });
  $("#results-home-btn").addEventListener("click", () => {
    showScreen("screen-home");
    refreshLeaderboardPreview();
  });
  // The qualify-box's initials inputs and submit button are rebuilt fresh
  // inside showResults()/wireInitialsInputs() each time results are shown,
  // since whether it's even present depends on the run's outcome.
}

async function showResults(runConfig, results) {
  showScreen("screen-results");
  state.pendingResults = results;

  const modeLabel = $("#results-mode-label");
  modeLabel.textContent = runConfig.mode === MODES.RANKED ? "Ranked" : "Practice";
  modeLabel.className = "results-eyebrow " + (runConfig.mode === MODES.RANKED ? "ranked" : "practice");

  $("#results-heading").textContent = resultsHeadline(runConfig, results);
  $("#results-stats").innerHTML = resultsStatsHtml(runConfig, results);

  const qualifyBox = $("#qualify-box");
  qualifyBox.classList.add("hidden");
  qualifyBox.innerHTML = `
    <p>New Top 10 score! Enter your initials:</p>
    <div class="initials-inputs">
      <input maxlength="1" class="initial-letter" data-idx="0" />
      <input maxlength="1" class="initial-letter" data-idx="1" />
      <input maxlength="1" class="initial-letter" data-idx="2" />
      <input maxlength="1" class="initial-letter" data-idx="3" />
    </div>
    <button class="primary-btn" id="submit-initials-btn">Submit</button>
  `;

  if (runConfig.mode === MODES.RANKED) {
    try {
      const value = rankingValueFor(runConfig.gameType, results);
      const qualifies = await doesQualify(runConfig.rankedConfigId, runConfig.gameType, value);
      if (qualifies) {
        qualifyBox.classList.remove("hidden");
        wireInitialsInputs();
      }
    } catch (err) {
      // Leaderboard not reachable/configured yet \u2014 silently skip the prompt.
    }
  }
}

function wireInitialsInputs() {
  const letterInputs = $$(".initial-letter", $("#qualify-box"));
  letterInputs.forEach((input, idx) => {
    input.addEventListener("input", () => {
      input.value = input.value.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 1);
      if (input.value && letterInputs[idx + 1]) letterInputs[idx + 1].focus();
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !input.value && letterInputs[idx - 1]) {
        letterInputs[idx - 1].focus();
      }
    });
  });
  $("#submit-initials-btn", $("#qualify-box")).addEventListener("click", async () => {
    const initials = letterInputs.map((i) => i.value).join("");
    if (initials.length !== 4) return;
    const btn = $("#submit-initials-btn", $("#qualify-box"));
    btn.disabled = true;
    btn.textContent = "Submitting\u2026";
    try {
      await submitScore(
        state.ranked.config.id,
        state.pendingResults.gameType,
        initials,
        state.pendingResults
      );
      $("#qualify-box").innerHTML = "<p>Saved to the leaderboard.</p>";
      refreshLeaderboardPreview();
    } catch (err) {
      btn.disabled = false;
      btn.textContent = "Submit";
    }
  });
  letterInputs[0].focus();
}

function resultsHeadline(runConfig, results) {
  if (runConfig.gameType === GAME_TYPES.ACCURACY) return `${results.accuracyPct}% Accuracy`;
  if (runConfig.gameType === GAME_TYPES.RACE) return formatTime(results.totalTimeMs);
  return `Score: ${results.score}`;
}

function resultsStatsHtml(runConfig, results) {
  const stat = (value, label) => `
    <div class="stat-box"><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>
  `;

  if (runConfig.gameType === GAME_TYPES.ACCURACY) {
    return stat(`${results.correctCount} / ${results.attempted}`, "Correct")
      + stat(`${results.accuracyPct}%`, "Accuracy");
  }
  if (runConfig.gameType === GAME_TYPES.RACE) {
    return stat(formatTime(results.totalTimeMs), "Time")
      + stat(`${results.correctCount}`, "Correct")
      + stat(`${results.attempted}`, "Attempted")
      + stat(`${results.accuracyPct}%`, "Accuracy");
  }
  // time trial
  return stat(`${results.correctCount}`, "Correct")
    + stat(`${results.incorrectCount}`, "Incorrect")
    + stat(`${results.attempted}`, "Attempted")
    + stat(`30s`, "Duration");
}

function formatTime(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
}
