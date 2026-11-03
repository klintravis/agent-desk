// A review branch's PR as one phrase, shared by `desk status` and the Desk pane. Node-free.
export const prText = (slug, pr) => (pr.state === 'OPEN' ? `PR #${pr.number} open, a person merges`
  : pr.state === 'MERGED' ? `PR #${pr.number} merged: desk wt merge ${slug} to close` : `PR #${pr.number} closed unmerged`);
