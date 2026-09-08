# AI Usage Disclosure

## Project
TraceMind – Searching the Way a Human Does

## Purpose

This document discloses the use of AI-assisted development tools during the
design, development, testing, debugging, and documentation of TraceMind.

AI tools were used as development assistants. The project architecture,
technical decisions, implementation, integration, testing, and final
submission were reviewed and managed by the team.

---

## AI Tools Used

### 1. Google Antigravity

Google Antigravity was used as an AI-assisted development environment during
the implementation of TraceMind.

It assisted with:

- Code generation and refactoring
- Frontend component development
- Backend implementation
- Debugging and error diagnosis
- RAG pipeline optimization
- Multi-agent workflow implementation
- Performance analysis
- Integration assistance for Qdrant, Ollama, RunPod and LangSmith

All generated or modified code was reviewed and tested by the team before
being included in the final system.

---

### 2. ChatGPT

ChatGPT was used as a development and research assistant.

It assisted with:

- Brainstorming the TraceMind solution
- Architecture discussions
- Multi-agent workflow design
- RAG architecture discussions
- Debugging guidance
- Performance optimization ideas
- Evaluation-question design
- Documentation assistance
- Presentation and technical explanation refinement

AI-generated suggestions were reviewed and adapted by the team before use.

---

## AI Usage in the TraceMind Application

TraceMind itself is an Agentic AI application.

The system uses:

- Google ADK for agent orchestration
- Qwen3 14B as the primary reasoning model
- Qwen3-VL 8B for visual document understanding
- Nomic Embeddings for semantic embeddings
- Qdrant for vector retrieval
- Ollama for model serving
- RunPod for AI infrastructure
- LangSmith for agent observability and evaluation

The TraceMind agent pipeline includes:

1. Planner Agent
2. Retrieval Agent
3. Vision Agent
4. Evidence Calibration Agent
5. Conflict Agent
6. Sufficiency Agent
7. Follow-up Agent
8. Answer Agent

The system retrieves evidence from the supplied document corpus and performs
multi-step reasoning before producing a grounded answer with source
references.

---

## Human Contribution

The team was responsible for:

- Problem analysis
- System architecture
- UI/UX design
- Frontend development
- Backend development
- Agentic AI integration
- RAG pipeline implementation
- Cloud infrastructure configuration
- Database and vector database integration
- Testing and evaluation
- Performance optimization
- Validation of generated outputs
- Final documentation and presentation

AI tools supported the development process but did not replace team review,
decision-making, testing, or validation.

---

## Validation

AI-assisted code and recommendations were not accepted blindly.

The team:

- Reviewed generated code
- Tested application functionality
- Diagnosed retrieval and reasoning failures
- Evaluated answers against known evidence
- Tested conflict detection and evidence sufficiency
- Monitored agent execution using LangSmith
- Optimized retrieval and inference performance
- Manually verified important technical decisions

---

## Disclosure Statement

We acknowledge the use of AI-assisted development tools in the creation of
TraceMind. AI tools were used to accelerate development, support debugging,
assist with technical reasoning, and improve documentation.

The final architecture, implementation decisions, integrations, testing,
evaluation, and submitted solution were reviewed and validated by the
TraceMind development team.