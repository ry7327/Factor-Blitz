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
//
// Two "periods" are exposed, both derived from the same table by
// filtering/limiting differently — there's no separate storage or
// physical reset involved:
//   'monthly'   -> Top 10 from scores submitted since the start of
//                  the current calendar month
//   'all_time'  -> the single best score ever recorded (limit 1)
// A scheduled cleanup job (see supabase-setup.sql) periodically prunes
// old rows, but always explicitly protects each group's all-time-best
// row from ever being deleted, regardless of age.

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

function startOfCurrentMonthISO() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

/**
 * Fetch a leaderboard.
 * @param {string} configId
 * @param {string} gameType
 * @param {"monthly"|"all_time"} period
 */
export async function fetchTopScores(configId, gameType, period = "monthly") {
  const col = sortColumn(gameType);
  const asc = sortAscending(gameType);
  const limit = period === "all_time" ? 1 : 10;

  let query = getClient()
    .from("leaderboard_scores")
    .select("*")
    .eq("config_id", configId)
    .eq("game_type", gameType);

  if (period === "monthly") {
    query = query.gte("created_at", startOfCurrentMonthISO());
  }

  const { data, error } = await query.order(col, { ascending: asc }).limit(limit);
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
 * Determine whether a just-played result would qualify for a Top 10
 * spot on the given period's board. (For 'all_time', this effectively
 * asks "is this now the best score ever?".)
 */
export async function doesQualify(configId, gameType, resultValue, period = "monthly") {
  const col = sortColumn(gameType);
  const asc = sortAscending(gameType);
  const top = await fetchTopScores(configId, gameType, period);
  const cutoffCount = period === "all_time" ? 1 : 10;

  if (top.length < cutoffCount) return true;

  const worst = top[top.length - 1][col];
  return asc ? resultValue <= worst : resultValue >= worst;
}

/**
 * Insert a new score. `results` should match the GameEngine results shape.
 * A single insert feeds both the monthly and all-time views automatically,
 * since both are just different queries over the same table.
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
