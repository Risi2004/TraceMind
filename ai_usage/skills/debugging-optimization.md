# Debugging and Performance Optimization Skill

## Purpose
Instructions used when AI assisted with diagnosing and optimizing TraceMind.

## Optimization Principle

Performance improvements must not sacrifice:

- Answer accuracy
- Evidence grounding
- Conflict detection
- Source citations
- Multi-agent reasoning
- Uncertainty handling

## Process

1. Diagnose the existing implementation before modifying it.
2. Identify measurable bottlenecks.
3. Add timing and observability where required.
4. Avoid unnecessary architectural changes.
5. Optimize independent operations using controlled concurrency.
6. Reduce repeated LLM context where possible.
7. Allow early termination when evidence is already sufficient.
8. Test answer quality again after optimization.

## Observability

LangSmith is used to inspect:

- Agent execution
- Retrieval rounds
- LLM calls
- Qdrant searches
- Agent latency
- Conflict detection
- Sufficiency decisions
- Final answer generation