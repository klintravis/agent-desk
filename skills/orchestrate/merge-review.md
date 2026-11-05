# Merging on a repo with `merge: "review"`

Step 5 of the pipeline, for a repo whose `desk status` Roots line shows `review`.

Copy the `PR findings:`
block of the reviewer's report (the verifier's, after a fix round) into a scratch file yourself, then
`desk wt merge <slug> --findings <file>` opens the PR and stops. Tell the owner the PR URL and wait for a person to merge on the server; after that,
re-run `desk wt merge <slug>` to close. Never `git push` or `git merge` a protected branch or `gh pr merge`:
only the server rule enforces that, the hook is best effort.
