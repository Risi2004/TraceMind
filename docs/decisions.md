# Technical Decisions

## 1. Multi-Agent Architecture

Decision:
Use specialized agents instead of a single LLM/RAG call.

Reason:
Complex questions may require planning, repeated retrieval, evidence
verification, conflict detection and follow-up searches.

## 2. Qdrant Vector Database

Decision:
Use Qdrant for vector retrieval.

Reason:
Provides efficient semantic similarity search over document chunks.

## 3. Nomic Embeddings

Decision:
Use Nomic Embed Text for document and query embeddings.

Reason:
Provides semantic representations suitable for document retrieval.

## 4. Google ADK

Decision:
Use Google ADK for agent orchestration.

Reason:
Allows the investigation process to be divided among specialized agents
with controlled responsibilities.

## 5. Separate Conflict Agent

Decision:
Introduce a dedicated Conflict Agent.

Reason:
Retrieved documents may contain contradictory claims or similar-looking
entity names. The agent checks whether evidence represents a genuine
conflict, entity mismatch, or insufficient evidence.

## 6. Evidence Sufficiency Check

Decision:
Evaluate whether enough evidence has been collected before answering.

Reason:
The system should search again when evidence is incomplete rather than
immediately generating an unsupported answer.

## 7. Multimodal Processing

Decision:
Use Qwen3-VL for visual evidence.

Reason:
The supplied corpus can contain information that cannot be reliably
recovered from plain text retrieval alone.

## 8. LangSmith Observability

Decision:
Trace the multi-agent workflow using LangSmith.

Reason:
Allows us to inspect agent execution, latency, retrieval rounds and
reasoning pipeline performance.