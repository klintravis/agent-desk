## Why

Most of the Desk pane is one colour, so what needs attention (a red branch hidden on another tab, a quota near its limit, keep-warm left off) does not stand out from what is only reference.

## What Changes

- The Quota row takes the Context row's colours, by its highest window. Warm's reason turns orange while keep-warm is off.
- Todo ids, `wt:<slug>` labels, agent types and tree and branch slugs take one accent colour, so rows can be scanned by what they name. A todo's `next:` is no longer dim; `state:` stays dim.
- A pull request row is a status: red for changes requested, green when approved with nothing left open, orange otherwise.
- The Open branches, Pull requests and Overlaps cards take the border of the worst status inside them; a card with nothing to report stays dim. The Branches tab shows a red dot while one is red, since the cards are hidden on the other tabs; orange gets no dot, because any branch in progress reads orange.
- No wording changes: colour is never the only signal.

## Capabilities

### Modified Capabilities
- `plugin-ui`: Desk pane attention colours.
