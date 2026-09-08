# Limitations

## 1. Inference Latency

Complex multi-hop questions may require multiple agent calls and retrieval
rounds, increasing response time.

Optimization reduced direct factual queries significantly, but complex
investigations can still take longer.

## 2. Large Corpus Ingestion

Large ZIP archives containing hundreds of documents require extraction,
chunking, embedding and indexing before they become fully searchable.

## 3. Vision Processing Cost

Images require additional visual processing using the vision model, making
image-heavy archives more expensive and slower to ingest.

## 4. Retrieval Dependency

The reasoning agents can only evaluate evidence successfully retrieved from
the indexed corpus. Relevant evidence missed during retrieval may affect the
final answer.

## 5. Conflicting Evidence

Some source conflicts cannot legitimately be resolved. In these cases,
TraceMind reports the uncertainty instead of inventing a conclusion.

## 6. GPU Dependency

Local model inference performance depends on available RunPod GPU resources
and model-serving latency.
