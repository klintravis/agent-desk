## ADDED Requirements

### Requirement: Masked answer is announced
When redaction changes the text typed under Other in the Decide dialog, the pane SHALL toast that the answer was masked, without the typed text or the secret.

#### Scenario: Masked text is announced
- **WHEN** redaction changes the text typed under Other and the ruling is recorded
- **THEN** a toast says the answer was masked, without the typed text or the secret; text redaction leaves unchanged shows no toast
