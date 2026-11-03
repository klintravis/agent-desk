## Why

T-122 asks two things: make nesting and usage patterns visible in `desk tokens`, and decide from the numbers whether nested subagents save tokens on large runs. Measuring it also found a counting bug that hid 42% of subagent fresh tokens.

## What Changes

- `tally` fix: a compaction copies earlier assistant lines under the same `requestId` with zero usage, and the copy overwrote the real count. An all-zero line no longer overwrites a counted call. In the 48h below: 1017 calls in 29 runs were wiped; subagent fresh goes from 15.5M to 26.8M, cache reads from 172M to 253M. `desk status` token figures rise with it. This corrects "token sums are unchanged" in `tokens-call-count`: that fix was right about its own lines, but these copies were still wiping counts.
- `desk tokens --json` rows gain `depth`, `parent`, `firstFresh`, `firstRead` and, on subagents, `sinceSpawn`. Existing fields keep their names and meaning; it stays an array of rows.
- The plain table gains two trailing columns, `depth` and `parent`, and two lines before `total:` (first-call share, reads per call, nested count, warm starts by gap). `total:` stays last. `--by-worktree` is unchanged.

## Verdict: no rule on nesting

The data cannot show that nested subagents save tokens on large runs, so no rule goes into `agents/implementer.md` or `skills/orchestrate/SKILL.md`. Nothing in this change requires `Agent` to stay in `implementer`; T-98 decides that on its own terms.

All numbers: last 48h on 2026-11-03, subagents only, this desk's four project folders, with the fixed tally.

**Real nesting is nearly absent.** 3 of 220 runs are at depth 2, none on a large run, and 2 of the 3 are this measurement's own lookups.

| Helper | Parent | Calls | Fresh | Read through tools (chars/4) |
|---|---|---|---|---|
| general-purpose, Haiku | Sonnet implementer (a probe) | 1 | 47,368 | none |
| Explore, Haiku | this run | 5 | 40,955 | ~9k |
| Explore, Haiku | this run | 7 | 71,040 | ~17k |

Each helper cost more fresh tokens than the reading it did. Start-up cost depends on the helper type: first call 19-31k fresh for Explore, 47k for general-purpose.

**T-87 was no trial of nesting.** That Opus implementer made 0 real `Agent` calls; the 5 `"name":"Agent"` grep hits are the tool's schema in request-shape and attachment lines. It spent 25 calls, 189,272 fresh, 1 compaction. Its movable reading was 22,917 tokens over 4 bursts: staying in the parent cost 40,326 input-equivalents (IE), against 72,265 IE as Haiku helpers and 339,764 IE as same-rate helpers. The one burst that would have won (16,511 tokens) saves 2,865 of 438,635 IE, 0.65%.

**Even the hindsight bound is small.** This model picks, after the fact, each burst of reading where moving it wins, so it is an upper bound. Prices: 5m write 1.25, read 0.1, Haiku 1/5 of Opus and 1/3 of Sonnet.

| Helper against parent | Top 10% of runs, helper start 46k / 30k / 20k | All runs |
|---|---|---|
| Same rate | 0 / 0 / 0 (no burst wins) | 0 / 0 / 0 |
| Haiku under Opus | 2.8 / 3.9 / 4.8% | 1.9 / 3.1 / 4.1% |
| Haiku under Sonnet | 0.6 / 1.4 / 2.1% | 0.4 / 1.0 / 1.7% |

Sonnet parents at a 46k start save 0.0%. The saving comes from the cheaper model, not from nesting, and no real run reached it.

**The cost on large runs lies elsewhere.** Top 10% of runs (22 runs, 55% of fresh): first calls 4% of their fresh, misses in mid-run 45%, 138 compactions. The biggest run: 118 calls, 1.82M fresh, 20 compactions. Moving the winning bursts out would avoid about 17 compactions, about 1.0M of 29.7M IE. That lever is compaction, not spawning (new todo).

**The API 400.** One case in 244 transcripts. T-87 used the advisor server tool twice, then auto-compacted, which copied both blocks (new `uuid`, same `requestId`). It later ended its turn waiting on a `Monitor`, a background-task notification woke it, the client rebuilt the whole prompt, and that request's stored block held `server_tool_use` id `WocouJ` and its result twice in one assistant message. The 400 came back at once, and the run ended there.

How far this goes: the duplicate is visible in the stored request, but why the rebuild merged the two copies is not proven. Nesting did not cause it: T-87 had no helper and was woken by its own Monitor. 22 subagents with advisor, compaction and rebuild but no wake survived; the only woken subagent died (1 of 1). A wake alone is not enough, though: 4 main sessions took 33 notifications after advisor and compaction with no error. A helper running in the background wakes its parent the same way, and 25 of the 29 compacted runs used a server tool. So background nesting raises exposure on exactly the large runs it would be meant for; foreground nesting adds no wake.

### Baselines, old against recomputed

The two columns differ in window and folders as well as tally, so the differences are not a trend.

| | Old (284 runs, all project folders, old tally) | Now (220 runs, desk folders, fixed tally) |
|---|---|---|
| Fresh | 45.9M | 26.9M |
| First-call share | 17% | 21% |
| Top 10% share of fresh | 50% | 55% |
| Cache reads per call | ~72k (wrong) | 64,745 |
| Warm start, gap under 5m | 67% | 78% (49/63) |
| Warm start, 5-60m | 30% | 19% (21/111) |
| Warm start, over 60m | 13% | 9% (3/33) |

First of its type: 1 warm of 13. A warm first call: median 17,338 fresh, against 23,120 cold. "Warm" means a first call reading 5k or more from cache, and most of those hits are small: of 222 runs at the last count, first reads were 0 in 139, 3-5k in 9, 5-8k in 42 and 11-25k in 32.

| Median per run | Fresh | First call |
|---|---|---|
| Sonnet implementer (65 runs; the earlier figure was ~74k) | 70,213 | 46,666 |
| Opus implementer (17; the earlier ~500k was too high) | 282,976 | 46,451 |
| Opus general-purpose (8) | 569,373 | 46,673 |
| Opus reviewer (55) | 73,669 | 22,466 |
| Opus verifier (59) | 26,196 | 12,456 |

### `subagentPromptCacheTtl`: keep 5m

No config change here. Over the 48h subagents wrote 26.7M tokens at 5m. Paying the 1h price on them costs 20.0M IE more and saves at most 3.3M fresh tokens, about 3.8M IE (3.0M of cold starts at 5-60m gaps, 0.3M of mid-run misses, of which only 6 had a gap of 5m or more). It is an upper bound: the brief part of a first call stays fresh either way. Nesting does not change this: helpers run inside a parent's run and are rare, and warm starts under 5m already reach 78%.

## Capabilities

### Modified Capabilities
- `desk-cli`: Tokens (nesting and pattern fields, zero-usage copies).
