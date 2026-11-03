## ADDED Requirements

### Requirement: Tokens call count
An assistant line whose model starts with `<` (for example `<synthetic>`) SHALL NOT count as a call: the client wrote it, not the API.

#### Scenario: Synthetic lines
- **WHEN** a transcript has one assistant line with a `requestId` and two with model `<synthetic>` and zero usage
- **THEN** it counts as one call
