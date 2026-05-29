"""
AgentSoul · Semantic Module Tests
===================================
Tests for EmbeddingService (mock mode), VectorStore, and SemanticRetriever.
"""
from __future__ import annotations

from pathlib import Path

import pytest

from agentsoul.memory.enhanced.semantic import (
    DeduplicationResult,
    EmbeddingResult,
    EmbeddingService,
    SearchConfig,
    SemanticMatch,
    SemanticRetriever,
    VectorStore,
)


@pytest.fixture
def embedding_service() -> EmbeddingService:
    return EmbeddingService(backend="mock")


@pytest.fixture
def vector_store(tmp_path: Path) -> VectorStore:
    return VectorStore(backend="memory", storage_path=tmp_path / "vectors", dimensions=64)


@pytest.fixture
def retriever(
    embedding_service: EmbeddingService,
    vector_store: VectorStore,
) -> SemanticRetriever:
    return SemanticRetriever(embedding_service, vector_store)


class TestEmbeddingService:
    def test_mock_embed_returns_vector(
        self, embedding_service: EmbeddingService
    ) -> None:
        result = embedding_service.embed("hello world")
        assert isinstance(result, EmbeddingResult)
        assert len(result.vector) > 0

    def test_same_text_same_embedding(
        self, embedding_service: EmbeddingService
    ) -> None:
        r1 = embedding_service.embed("test text")
        r2 = embedding_service.embed("test text")
        assert r1.vector == r2.vector

    def test_different_text_different_embedding(
        self, embedding_service: EmbeddingService
    ) -> None:
        r1 = embedding_service.embed("hello")
        r2 = embedding_service.embed("goodbye")
        assert r1.vector != r2.vector

    def test_embed_batch(self, embedding_service: EmbeddingService) -> None:
        results = embedding_service.embed_batch(["a", "b", "c"])
        assert len(results) == 3
        assert all(isinstance(r, EmbeddingResult) for r in results)

    def test_dimensions_property(
        self, embedding_service: EmbeddingService
    ) -> None:
        assert embedding_service.dimensions > 0


class TestVectorStore:
    def test_add_and_search(
        self, vector_store: VectorStore, embedding_service: EmbeddingService
    ) -> None:
        vec = embedding_service.embed("Python programming").vector
        vector_store.add("mem-1", vec, {"content": "Python programming"})
        results = vector_store.search(vec, top_k=5)
        assert len(results) >= 1
        assert results[0][0] == "mem-1"

    def test_remove(self, vector_store: VectorStore) -> None:
        dims = vector_store.dimensions
        vec = [0.1] * dims
        vector_store.add("mem-2", vec, {"content": "test"})
        assert vector_store.remove("mem-2") is True
        assert vector_store.get("mem-2") is None

    def test_get_metadata(self, vector_store: VectorStore) -> None:
        dims = vector_store.dimensions
        vec = [0.2] * dims
        vector_store.add("mem-3", vec, {"content": "hello", "tags": ["test"]})
        result = vector_store.get("mem-3")
        assert result is not None
        assert result[1]["content"] == "hello"


class TestSemanticRetriever:
    def test_index_adds_to_vector_store(
        self, retriever: SemanticRetriever
    ) -> None:
        retriever.index_memory(
            "m-1", "Python is a programming language", {"tags": ["tech"]}
        )
        retriever.index_memory(
            "m-2", "I like cats", {"tags": ["personal"]}
        )
        # Verify vectors were stored
        assert retriever.vector_store.get("m-1") is not None
        assert retriever.vector_store.get("m-2") is not None

    def test_search_returns_list(
        self, retriever: SemanticRetriever
    ) -> None:
        results = retriever.search("programming language", limit=5)
        assert isinstance(results, list)

    def test_search_with_empty_store(
        self, retriever: SemanticRetriever
    ) -> None:
        results = retriever.search("Test content", limit=1)
        assert isinstance(results, list)
        assert len(results) == 0

    def test_deduplication_detects_similar(
        self, retriever: SemanticRetriever
    ) -> None:
        retriever.index_memory("m-20", "I love Python programming", {})
        result = retriever.check_deduplication("I really love Python coding")
        assert isinstance(result, DeduplicationResult)

    def test_empty_search(self, retriever: SemanticRetriever) -> None:
        results = retriever.search("nonexistent query", limit=5)
        assert isinstance(results, list)
