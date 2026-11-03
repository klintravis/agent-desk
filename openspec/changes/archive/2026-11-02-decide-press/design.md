## Context

`ask()` in `hooks/pane.tsx` runs `/decide` through `$.command.run`, which skips the calling plugin's own hook. The fix for that is settled: the hook body becomes a function `ask()` calls directly. What a press then shows was open. T-67 recommended `$.prompt.submit`, asking the model to run the decisions with its question tool, with toast plus `prompt.fill` as the fallback.

## Goals / Non-Goals

**Goals:** a press walks the waiting decisions and records each ruling; a ruling lands on the question the owner read; a draft is never overwritten; tests fail when only the plugin's own hook answers and it is broken.

**Non-Goals:** changing `/decide`, `desk decide` or its output; a multi-select; a skip button (closing the dialog is "not now").

## Decisions

### The press asks in `$.ui.ask`, not through the model

| | `$.ui.ask` (chosen) | `$.prompt.submit` | toast + `prompt.fill` |
|---|---|---|---|
| Question, recommendation, options shown | yes | if the model does it | toast only, for seconds |
| Records the ruling | the plugin, with the owner's own answer | the model | the owner types and sends it |
| Prompt draft | untouched | not read by the event; effect on the box not observable in `plugin test` | fill skipped, owner still gets the toast |
| Model busy | not observable in `plugin test`; verify live | documented: a plugin's submit runs once the session is idle, so the press appears to do nothing until then | works |
| Cost | none | a model turn, in the session's context | none |
| Testable in `plugin test` | whole walk, stubbing `tool.call` of `AskUserQuestion` | only that the event is raised: no core beneath it (`no implementation for prompt.submit`) | yes |

Between the owner's answer and the record, `$.prompt.submit` puts a model. The ruling would be what the model understood, and the question could change under it. A dialog answer is the owner's own and the code decides the id.

### Toast plus fill stays, for what the dialog cannot offer

`$.ui.ask` takes 2-4 options: five reject, and fewer than two are padded with Yes/No, which would record `Yes` as a ruling. Such a decision gets the toast (the printed text, held 30 s) and, on an empty prompt, `/decide <id> `. The walk ends there, since the owner now types.

### Options come from what `desk decide` printed

The id already does, and the status JSON behind the Button can be a minute old. A record prints the next decision, so the walk needs no second call. The parser reads the first line `T-n (i of n): title`, then `  Recommended: x` and `  Or: y`. A test pins that to `decideText`'s real output.

### The recorded ruling is the label, verbatim

The `Recommended` marker sits in the question text, because `AskOptions` has no per-option description and a marked label would be recorded with its marker. `$.ui.ask` returns the label or the Other text, and both are passed on unchanged.

### Every rejection ends the walk the same way

`$.ui.ask` rejects with `no answer (<reason>)`, the reason being whatever a hook or the engine gave. Telling a dismissal from a deny would mean matching that text, so all rejections record nothing, fill nothing and toast the reason. The owner can still type `/decide`.

## Risks / Trade-offs

- `plugin test` has no core, so a press while the model is mid-turn, a press while the model's own question is open, long labels and the VS Code and desktop surfaces cannot be probed. They go on a watch todo. Should the dialog refuse, the owner gets the reason in a toast, not silence.
- `desk decide` splits `why` on `;`, so prose with 1-3 semicolons becomes 2-4 odd choices. The owner reads them before pressing and Other is there, and it is what `/decide` already prints. Better `why` text is a skill concern, not this change.
- A plugin that answers `AskUserQuestion` by itself would record a ruling without the owner. None ships with the desk; `tool.call` hooks are the owner's own install.
