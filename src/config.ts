// Feature flags.
// Ranking (改修④): a max-hit-odds leaderboard, one row per user, keyed on the
// account's username. The client submits a winning bet's odds; the server keeps
// each account's best. Everything degrades gracefully when the DB isn't set up
// or the player isn't signed in, so turning this on is safe before the SQL
// (supabase/ranking.sql) is applied — nothing breaks, submissions just no-op.
export const ENABLE_RANKING = true;
