# TraceMind System Architecture

## Overview

TraceMind is a multi-agent document investigation system designed for
Sub-track 1C: Searching the Way a Human Does.

The system retrieves evidence from heterogeneous documents and uses
specialized AI agents to investigate, verify, compare, and synthesize
evidence before producing a grounded answer.

## Architecture Flow

User
→ TraceMind Web Application
→ Google ADK Agent Orchestrator
→ Planner Agent
→ Retrieval / Vision
→ Evidence Calibration Agent + Conflict Agent
→ Sufficiency Agent
→ Follow-up Agent (if more evidence is required)
→ Answer Agent
→ Grounded Answer with Sources

## Main Components

### Frontend
- React
- Vite

Provides document upload, document management, querying and answer display.

### Backend
- Node.js
- Express.js

Handles authentication, document ingestion, retrieval and agent execution.

### Vector Retrieval
- Qdrant
- Nomic Embeddings

Document chunks are embedded and stored in Qdrant for semantic retrieval.

### Agent Orchestration
Google ADK coordinates the specialized agents.

Agents:
- Planner Agent
- Retrieval Agent
- Vision Agent
- Evidence Calibration Agent
- Conflict Agent
- Sufficiency Agent
- Follow-up Agent
- Answer Agent

### Models
- Qwen3 14B – text reasoning
- Qwen3-VL 8B – visual document understanding
- Nomic Embed Text – embeddings

### Infrastructure
- RunPod – GPU infrastructure
- Ollama – model serving
- Cloudflare R2 – document storage
- MongoDB – application database
- LangSmith – tracing, observability and evaluation