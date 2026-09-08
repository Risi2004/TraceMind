# RAG and Retrieval Skill

## Purpose
Guidelines used when AI assisted with TraceMind's retrieval pipeline.

## Retrieval Pipeline

Documents
→ Extraction
→ Chunking
→ Nomic Embeddings
→ Qdrant
→ Semantic Retrieval
→ Candidate Ranking
→ Agent Analysis

## Guidelines

- Preserve document metadata during ingestion.
- Store document name and page number with chunks where available.
- Use semantic retrieval through Qdrant.
- Deduplicate repeated evidence.
- Preserve source traceability.
- Allow follow-up retrieval using newly discovered entities, aliases,
  identifiers and document references.
- Do not assume the highest similarity result is automatically correct.
- Evidence authority and conflicts must be considered during reasoning.

## Retrieval Technologies

- Qdrant
- Nomic Embeddings
- Ollama