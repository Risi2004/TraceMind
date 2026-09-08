# TraceMind – Project Context

## 1. Project Overview

TraceMind is an Agentic AI-powered Intelligent Document Assistant developed
for the SLIIT Codefest 2026 AI Competition.

Chosen Challenge:
Intelligent Document Assistant

Chosen Sub-track:
Sub-track 1C – Searching the Way a Human Does

TraceMind is designed to answer complex questions from large collections of
enterprise-style documents by performing iterative retrieval and reasoning
instead of relying on a single retrieval step.

The system can search documents, evaluate retrieved evidence, detect
conflicting information, determine whether sufficient evidence has been
collected, and perform follow-up searches when necessary.

---

## 2. Challenge Context

The competition corpus is the Ashen Era Archive.

It contains 415 documents and approximately 1,277 pages across mixed formats,
including:

- PDF
- DOCX
- Markdown
- TXT
- Scanned documents
- Images

Information may be distributed across multiple documents, and different
sources may contain conflicting or differently reliable information.

TraceMind therefore focuses on evidence-driven, iterative document
investigation.

---

## 3. Core Agent Workflow

TraceMind uses a multi-agent architecture orchestrated using Google ADK.

Main agents:

1. Planner Agent
   - Understands the user's question.
   - Determines the initial retrieval strategy.

2. Retrieval Agent
   - Performs semantic retrieval against the Qdrant vector database.
   - Retrieves relevant document chunks.

3. Vision Agent
   - Processes visual/scanned document content when required.
   - Uses Qwen3-VL 8B.

4. Evidence Calibration Agent
   - Extracts and evaluates relevant evidence from retrieved content.
   - Distinguishes directly established facts from weaker evidence.

5. Conflict Agent
   - Detects contradictions between retrieved sources.
   - Avoids treating similar-looking names as the same entity without
     explicit supporting evidence.

6. Sufficiency Agent
   - Determines whether enough evidence has been collected to answer
     the question reliably.

7. Follow-up Agent
   - Generates targeted follow-up searches when evidence is insufficient.

8. Answer Agent
   - Produces the final grounded response using the collected evidence.
   - Provides document/page references where available.

---

## 4. Investigation Flow

The general reasoning process is:

User Question
      ↓
Planner Agent
      ↓
Retrieval Agent / Vision Agent
      ↓
Evidence Calibration + Conflict Analysis
      ↓
Sufficiency Check
      ↓
Is Evidence Sufficient?
      ↓
YES → Answer Agent → Final Answer

NO
 ↓
Follow-up Agent
 ↓
Targeted Retrieval
 ↓
Evidence Analysis
 ↓
Sufficiency Check

The investigation continues until sufficient evidence is available or the
configured search limit is reached.

---

## 5. RAG Pipeline

Documents are uploaded and processed through the TraceMind ingestion
pipeline.

General pipeline:

Document Upload
      ↓
Document Extraction
      ↓
Chunking
      ↓
Nomic Embeddings
      ↓
Qdrant Vector Store

During question answering:

Question
      ↓
Query Embedding
      ↓
Qdrant Semantic Search
      ↓
Candidate Ranking
      ↓
Agent Reasoning

Retrieved evidence is then analyzed by the agent system rather than being
immediately passed to a single answer-generation step.

---

## 6. Technology Stack

### Frontend
- React
- Vite

### Backend
- Node.js
- Express.js

### Application Database
- MongoDB

### Vector Database
- Qdrant

### Embeddings
- Nomic Embeddings

### Agent Orchestration
- Google ADK

### Language Model
- Qwen3 14B

### Vision Model
- Qwen3-VL 8B

### Model Serving
- Ollama

### AI Infrastructure
- RunPod

### Object Storage
- Cloudflare R2

### Observability and Evaluation
- LangSmith

---

## 7. Important Design Principles

TraceMind follows several important principles:

### Evidence Grounding
Answers should be based on retrieved document evidence rather than model
general knowledge.

### Iterative Retrieval
The system may perform additional searches when the first retrieval does not
provide sufficient evidence.

### Conflict Awareness
Contradictory claims should be identified rather than silently merged.

### Entity Separation
Similar names must not automatically be considered the same entity.

### Uncertainty Preservation
If the available documents cannot establish an answer conclusively,
TraceMind should report that uncertainty instead of inventing a conclusion.

### Source Traceability
Final answers should identify the documents and pages supporting important
claims.

---

## 8. Performance Considerations

The original implementation used multiple reasoning rounds and several
sequential LLM calls, resulting in high query latency.

Performance analysis identified major bottlenecks including:

- Excessive LLM calls
- Repeated processing of accumulated context
- Sequential ingestion
- Sequential model execution
- Unnecessary follow-up retrieval for directly established facts

The pipeline was optimized while preserving evidence verification,
conflict detection, citations, and multi-agent reasoning.

---

## 9. Observability

LangSmith is used to inspect and evaluate agent execution.

Traces can show:

- Planner execution
- Retrieval rounds
- Query embedding
- Qdrant vector search
- Evidence analysis
- Conflict detection
- Sufficiency decisions
- Follow-up searches
- Answer generation
- Agent execution latency

This allows the team to understand how TraceMind reaches an answer and
identify performance or reasoning issues.

---

## 10. Development Principle

AI development tools were used as assistants during implementation,
debugging, optimization, and documentation.

Technical decisions, architecture, testing, evaluation, and validation were
performed and reviewed by the development team.

Refer to:

ai_usage/ai-usage-disclosure.md

for the complete AI usage disclosure.