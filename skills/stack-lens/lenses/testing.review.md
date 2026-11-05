# Testing lens: review

Judge each new or changed test with two imagined edits. **Break the behaviour** (wrong value, skipped
effect, effect done twice): if the test still passes, it proves nothing — a finding. **Change only the
internals**: if the test would fail, it is pinned to the implementation — a finding when a simpler
behavioural test would do. Also a finding: an assertion on data the test built itself, or a restated
constant that never runs the code that reads it.
