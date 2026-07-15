// Feature flags. Ranking is foundation-only for now (RACE_V4 §5): results are
// buffered locally in a server-reproducible shape, but nothing is uploaded and
// there is no ranking screen yet. Flip this on once the leaderboard back-end
// (verification re-sim + tables) is deployed.
export const ENABLE_RANKING = false;
