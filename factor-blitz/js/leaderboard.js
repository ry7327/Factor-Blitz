// leaderboard.js
// All communication with the Supabase-backed global leaderboards.
//
// Table expected (see supabase-setup.sql for exact DDL):
//   leaderboard_scores(
//     id, created_at, config_id, game_type,
//     initials, correct_count, attempted, time_ms, score
//   )
//
// Ranking rule per game_type:
//   accuracy    -> higher correct_count is better
//   race        -> lower time_ms is better
//   time_trial  -> higher score is better

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabaseConfig.js";

let client = null;

export function getClient() {
  if (!client) {
    if (!window.supabase) {
      throw new Error("Supabase JS library not loaded. Check the <script> tag in index.html.");
    }
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL.includes("YOUR_")) {
      throw new Error("Supabase is not configured yet. Fill in js/supabaseConfig.js.");
    }
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return client;
}

function sortColumn(gameType) {
  if (gameType === "race") return "time_ms";
  if (gameType === "time_trial") return "score";
  return "correct_count"; // accuracy
}

function sortAscending(gameType) {
  return gameType === "race"; // lower time is better; everything else higher is better
}

/**
 * Fetch the top 10 rows for a leaderboard, with tie-aware rank numbers.
 */
export async function fetchTopScores(configId, gameType) {
  const col = sortColumn(gameType);
  const asc = sortAscending(gameType);

  const { data, error } = await getClient()
    .from("leaderboard_scores")
    .select("*")
    .eq("config_id", configId)
    .eq("game_type", gameType)
    .order(col, { ascending: asc })
    .limit(10);

  if (error) throw error;
  return attachRanks(data || [], col);
}

function attachRanks(rows, col) {
  let lastValue = null;
  let lastRank = 0;
  return rows.map((row, idx) => {
    const value = row[col];
    if (value !== lastValue) {
      lastRank = idx + 1;
      lastValue = value;
    }
    return { ...row, rank: lastRank };
  });
}

/**
 * Determine whether a just-played result would qualify for the Top 10.
 * Fetches the current top 10 and compares against the worst qualifying score.
 */
export async function doesQualify(configId, gameType, resultValue) {
  const col = sortColumn(gameType);
  const asc = sortAscending(gameType);
  const top = await fetchTopScores(configId, gameType);

  if (top.length < 10) return true;

  const worst = top[top.length - 1][col];
  return asc ? resultValue < worst || resultValue <= worst : resultValue >= worst;
}

/**
 * Insert a new score. `results` should match the GameEngine results shape.
 */
export async function submitScore(configId, gameType, initials, results) {
  const row = {
    config_id: configId,
    game_type: gameType,
    initials: initials.toUpperCase(),
    correct_count: results.correctCount,
    attempted: results.attempted,
    time_ms: Math.round(results.totalTimeMs),
    score: results.score,
  };

  const { error } = await getClient().from("leaderboard_scores").insert(row);
  if (error) throw error;
}

/** Returns the value used for ranking, given a game type + results object. */
export function rankingValueFor(gameType, results) {
  if (gameType === "race") return Math.round(results.totalTimeMs);
  if (gameType === "time_trial") return results.score;
  return results.correctCount;
}
