# Agentic AI Development Skill

## Purpose
Instructions used when AI assisted with designing and implementing
TraceMind's multi-agent investigation system.

## Architecture

TraceMind uses Google ADK for agent orchestration.

Agents:

- Planner Agent
- Retrieval Agent
- Vision Agent
- Evidence Calibration Agent
- Conflict Agent
- Sufficiency Agent
- Follow-up Agent
- Answer Agent

## Core Principles

### Evidence Grounding
Agents must base conclusions on retrieved document evidence.

### Conflict Detection
Conflicting claims must be explicitly identified.

### Entity Resolution
Similar-looking names must not automatically be treated as the same entity.
Entity equivalence requires explicit evidence such as aliases, identifiers,
cross-references, or supporting records.

### Uncertainty
When evidence cannot resolve a question, the system should state that the
answer cannot be conclusively established.

### Iterative Search
If evidence is insufficient, the Follow-up Agent should generate a targeted
search based on missing information.

### Sufficiency
Stop searching when enough reliable evidence exists to answer the question.

### Citation
Final answers should provide document and page references whenever available.