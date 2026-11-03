// A review branch's PR as one phrase, shared by `desk status` and the Desk pane. Node-free.
// `stale`: the merged PR does not hold the branch's head, so there is nothing to close.
export const prText = (slug, pr) => (pr.state === 'OPEN' ? `PR #${pr.number} open, a person merges`
  : pr.state === 'MERGED' ? `PR #${pr.number} merged${pr.stale ? '' : `: desk wt merge ${slug} to close`}` : `PR #${pr.number} closed unmerged`);
