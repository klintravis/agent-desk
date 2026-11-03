## ADDED Requirements

### Requirement: Desk pane row colours
The pane SHALL colour what needs attention and SHALL keep every word, so colour is never the only signal. The Quota row SHALL use the Context row's thresholds on its highest window. Warm's reason SHALL be orange while keep-warm is off. Todo ids, `wt:<slug>` labels, agent types and tree and branch slugs SHALL use one accent colour. A todo's `next:` SHALL not be dim. A pull request row SHALL be red for changes requested, green when approved with no unresolved thread and nothing new since the head commit, and orange otherwise.

#### Scenario: Quota near its limit
- **WHEN** a quota window reaches 80%
- **THEN** the Quota row is red, whatever the other windows read

### Requirement: Desk pane card and tab marks
The Open branches, Pull requests and Overlaps cards SHALL take the border of the worst status inside them (red over orange over green), and stay dim when empty. The Branches tab SHALL show a red dot while any of those cards is red, and no dot for orange, which any branch in progress reads.

#### Scenario: A failing branch seen from another tab
- **WHEN** a branch's CI failed and the Work tab is open
- **THEN** a red dot shows beside the Branches tab, and on that tab the Open branches card has a red border

#### Scenario: Nothing to report
- **WHEN** there are no open branches, pull requests or overlaps
- **THEN** those cards keep their dim border and the Branches tab shows no dot

#### Scenario: A branch in progress
- **WHEN** a branch has no verdict yet and nothing is red
- **THEN** the Open branches card has an orange border and the Branches tab shows no dot
