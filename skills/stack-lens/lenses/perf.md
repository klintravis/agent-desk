# Performance lens

## Build

- Before measuring, write the claim you expect to ship ("p50 41 ms to 33 ms on the 60k-row file") and the
  result that would change the decision. Measure the baseline before changing code.
- Run each side at least 5 times, alternating A, B, A, B; report the median and the range. A gap smaller
  than the run-to-run spread is no difference.
- Name the limiter (a core, a lock, the disk, the network, the load generator) from a profile or system
  counters, not from reading code. If you can't say why it isn't twice as fast, you don't know what you measured.
- Both sides tuned the way production runs (release build, same flags, data and cache warmth). Count
  errors and check the output: a fast run that skipped the work or failed is not a win.
- Next to a micro number, give the end-to-end number a user waits on. A helper at 1% of a request can
  make it at most 1% faster.
- Keep the runs, spread and limiter in the report; the commit message gets one number.

## Review

A finding: a speed or memory claim with no baseline, one run, no spread, or no limiter; a micro result
reported without its end-to-end share; a benchmark that does not check that the work ran (an unawaited
promise, an unread result, cached data). Also, at the repo's expected load: a query or request per item,
O(n^2) on input that can be large, a list or cache that only grows, work every process repeats.
