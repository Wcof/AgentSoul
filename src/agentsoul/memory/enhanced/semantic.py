"""
AgentSoul · 语义搜索模块
基于向量嵌入的语义记忆检索，支持自然语言查询

架构设计：
- EmbeddingService: 嵌入生成服务（支持多种后端）
- SemanticRetriever: 语义检索器（向量相似度搜索）
- VectorStore: 向量存储（FAISS/Chroma/内存）
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from common import get_project_root, log

from .priority import PriorityLevel

# ============================================================================
# Data Structures
# ============================================================================

@dataclass
class EmbeddingResult:
    """嵌入生成结果"""
    vector: list[float]
    model: str
    dimensions: int
    text_hash: str  # 用于去重检测


@dataclass
class SemanticMatch:
    """语义匹配结果"""
    memory_id: str
    content: str
    score: float  # 余弦相似度，0-1
    tags: list[str]
    priority: str
    last_accessed: datetime
    created_at: str
    embedding_model: str


@dataclass
class DeduplicationResult:
    """去重检测结果"""
    is_duplicate: bool
    similar_memory_id: str | None
    similarity_score: float
    threshold: float


# ============================================================================
# Embedding Service
# ============================================================================

class EmbeddingService:
    """
    嵌入生成服务，支持多种后端

    后端选项：
    - openai: OpenAI embeddings API (text-embedding-3-small/large)
    - huggingface: HuggingFace 模型（本地运行）
    - sentence-transformers: sentence-transformers 库
    - mock: 模拟模式（用于测试，生成随机向量）
    """

    SUPPORTED_MODELS = {
        "openai": {
            "text-embedding-3-small": 1536,
            "text-embedding-3-large": 3072,
            "text-embedding-ada-002": 1536,
        },
        "sentence-transformers": {
            "all-MiniLM-L6-v2": 384,
            "all-mpnet-base-v2": 768,
            "paraphrase-multilingual-MiniLM-L12-v2": 384,  # 支持中文
        },
        "mock": {
            "mock": 384,
        },
    }

    def __init__(
        self,
        backend: str = "sentence-transformers",
        model_name: str = "all-MiniLM-L6-v2",
        api_key: str | None = None,
        cache_dir: Path | None = None,
    ):
        self.backend = backend
        self.model_name = model_name
        self.api_key = api_key
        self.cache_dir = cache_dir or get_project_root() / "data" / "embeddings"
        self.cache_dir.mkdir(parents=True, exist_ok=True)

        self._dimensions = self.SUPPORTED_MODELS.get(backend, {}).get(model_name, 384)
        self._client = None

        if backend == "openai":
            self._init_openai()
        elif backend == "sentence-transformers":
            self._init_sentence_transformers()
        elif backend == "mock":
            log("EmbeddingService: 使用 mock 模式（随机向量）", "INFO")
        else:
            raise ValueError(f"Unsupported embedding backend: {backend}")

    def _init_openai(self) -> None:
        """初始化 OpenAI 客户端"""
        try:
            from openai import OpenAI
            self._client = OpenAI(api_key=self.api_key)
        except ImportError:
            log("EmbeddingService: openai 库未安装，降级到 mock 模式", "WARN")
            self.backend = "mock"
            self._dimensions = 384

    def _init_sentence_transformers(self) -> None:
        """初始化 sentence-transformers 客户端"""
        try:
            from sentence_transformers import SentenceTransformer
            self._client = SentenceTransformer(self.model_name)
            log(f"EmbeddingService: 加载模型 {self.model_name} (维度: {self._dimensions})", "INFO")
        except ImportError:
            log("EmbeddingService: sentence-transformers 库未安装，降级到 mock 模式", "WARN")
            self.backend = "mock"
            self._dimensions = 384

    @property
    def dimensions(self) -> int:
        return self._dimensions

    def _hash_text(self, text: str) -> str:
        """生成文本哈希用于去重检测"""
        return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]

    def embed(self, text: str) -> EmbeddingResult:
        """
        生成文本嵌入向量

        Args:
            text: 要嵌入的文本

        Returns:
            EmbeddingResult 包含向量、模型信息、文本哈希
        """
        text_hash = self._hash_text(text)

        if self.backend == "openai" and self._client:
            try:
                response = self._client.embeddings.create(
                    input=text,
                    model=self.model_name,
                )
                vector = response.data[0].embedding
            except Exception as e:
                log(f"EmbeddingService: OpenAI API 调用失败: {e}", "ERROR")
                vector = self._mock_embed(text)
        elif self.backend == "sentence-transformers" and self._client:
            try:
                vector = self._client.encode(text, convert_to_numpy=True).tolist()
            except Exception as e:
                log(f"EmbeddingService: sentence-transformers 调用失败: {e}", "ERROR")
                vector = self._mock_embed(text)
        else:
            vector = self._mock_embed(text)

        return EmbeddingResult(
            vector=vector,
            model=f"{self.backend}/{self.model_name}",
            dimensions=len(vector),
            text_hash=text_hash,
        )

    def _mock_embed(self, text: str) -> list[float]:
        """生成模拟向量（用于测试）"""
        h = hashlib.sha256(text.encode("utf-8")).digest()
        vector = []
        for i in range(0, min(len(h) * 2, self._dimensions)):
            byte_idx = i // 2
            bit_idx = (i % 2) * 4
            val = (h[byte_idx] >> bit_idx) & 0x0F
            vector.append(val / 15.0)
        return vector[:self._dimensions]

    def embed_batch(self, texts: list[str]) -> list[EmbeddingResult]:
        """批量生成嵌入"""
        return [self.embed(text) for text in texts]


# ============================================================================
# Vector Store
# ============================================================================

class VectorStore:
    """
    向量存储，支持多种后端

    后端选项：
    - faiss: Facebook AI Similarity Search（高性能，需要安装 faiss）
    - chroma: ChromaDB（功能丰富，支持持久化）
    - memory: 内存存储（适合小数据量，无需额外依赖）
    """

    def __init__(
        self,
        backend: str = "memory",
        storage_path: Path | None = None,
        dimensions: int = 384,
    ):
        self.backend = backend
        self.storage_path = storage_path or get_project_root() / "data" / "embeddings" / "vectors"
        self.storage_path.mkdir(parents=True, exist_ok=True)
        self.dimensions = dimensions

        self._vectors: dict[str, list[float]] = {}
        self._metadata: dict[str, dict[str, Any]] = {}
        self._index = None

        if backend == "faiss":
            self._init_faiss()
        elif backend == "chroma":
            self._init_chroma()
        elif backend == "memory":
            log("VectorStore: 使用内存存储模式", "INFO")
        else:
            raise ValueError(f"Unsupported vector store backend: {backend}")

    def _init_faiss(self) -> None:
        """初始化 FAISS 索引"""
        try:
            import faiss
            self._index = faiss.IndexFlatIP(self.dimensions)
            log("VectorStore: FAISS 索引已初始化", "INFO")
        except ImportError:
            log("VectorStore: faiss 库未安装，降级到 memory 模式", "WARN")
            self.backend = "memory"

    def _init_chroma(self) -> None:
        """初始化 ChromaDB"""
        try:
            import chromadb
            self._client = chromadb.PersistentClient(path=str(self.storage_path))
            self._collection = self._client.get_or_create_collection(
                name="memories",
                embedding_function=None,
            )
            log("VectorStore: ChromaDB 已初始化", "INFO")
        except ImportError:
            log("VectorStore: chromadb 库未安装，降级到 memory 模式", "WARN")
            self.backend = "memory"

    def add(self, memory_id: str, vector: list[float], metadata: dict[str, Any]) -> None:
        """添加向量到存储"""
        if len(vector) != self.dimensions:
            raise ValueError(f"Vector dimension mismatch: expected {self.dimensions}, got {len(vector)}")

        self._vectors[memory_id] = vector
        self._metadata[memory_id] = metadata

        if self.backend == "faiss" and self._index:
            import numpy as np
            self._index.add(np.array([vector], dtype=np.float32))
        elif self.backend == "chroma" and hasattr(self, "_collection"):
            self._collection.add(
                embeddings=[vector],
                ids=[memory_id],
                metadatas=[metadata],
            )

    def search(self, query_vector: list[float], top_k: int = 10) -> list[tuple[str, float]]:
        """搜索最相似的向量"""
        if self.backend == "faiss" and self._index:
            import numpy as np
            distances, indices = self._index.search(np.array([query_vector], dtype=np.float32), top_k)
            results = []
            for idx in indices[0]:
                if idx >= 0 and idx < len(self._vectors):
                    memory_ids = list(self._vectors.keys())
                    results.append((memory_ids[idx], float(distances[0][idx])))
            return results
        elif self.backend == "chroma" and hasattr(self, "_collection"):
            results = self._collection.query(
                query_embeddings=[query_vector],
                n_results=top_k,
            )
            return list(zip(results["ids"][0], results["distances"][0]))
        else:
            return self._cosine_search(query_vector, top_k)

    def _cosine_search(self, query_vector: list[float], top_k: int) -> list[tuple[str, float]]:
        """内存模式下的余弦相似度搜索"""
        import math

        def cosine_similarity(v1: list[float], v2: list[float]) -> float:
            dot = sum(a * b for a, b in zip(v1, v2))
            norm1 = math.sqrt(sum(a * a for a in v1))
            norm2 = math.sqrt(sum(b * b for b in v2))
            if norm1 == 0 or norm2 == 0:
                return 0.0
            return dot / (norm1 * norm2)

        scores = [
            (memory_id, cosine_similarity(query_vector, vector))
            for memory_id, vector in self._vectors.items()
        ]
        scores.sort(key=lambda x: x[1], reverse=True)
        return scores[:top_k]

    def remove(self, memory_id: str) -> bool:
        """移除向量"""
        if memory_id in self._vectors:
            del self._vectors[memory_id]
            del self._metadata[memory_id]
            return True
        return False

    def get(self, memory_id: str) -> tuple[list[float], dict[str, Any]] | None:
        """获取向量和元数据"""
        if memory_id in self._vectors:
            return self._vectors[memory_id], self._metadata[memory_id]
        return None

    def save(self) -> None:
        """保存向量存储到磁盘"""
        if self.backend == "memory":
            data = {
                "vectors": self._vectors,
                "metadata": self._metadata,
                "dimensions": self.dimensions,
            }
            path = self.storage_path / "vectors.json"
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

    def load(self) -> None:
        """从磁盘加载向量存储"""
        if self.backend == "memory":
            path = self.storage_path / "vectors.json"
            if path.exists():
                with open(path, encoding="utf-8") as f:
                    data = json.load(f)
                self._vectors = data.get("vectors", {})
                self._metadata = data.get("metadata", {})
                self.dimensions = data.get("dimensions", self.dimensions)


# ============================================================================
# Semantic Retriever
# ============================================================================

@dataclass
class SearchConfig:
    """语义搜索配置"""
    similarity_threshold: float = 0.7
    top_k: int = 10
    hybrid_weight: float = 0.5
    enable_deduplication: bool = True
    deduplication_threshold: float = 0.85


class SemanticRetriever:
    """
    语义记忆检索器

    支持：
    - 纯语义搜索（向量相似度）
    - 混合搜索（语义 + 关键词）
    - 去重检测（跨时间切片）
    - 优先级融合
    """

    def __init__(
        self,
        embedding_service: EmbeddingService | None = None,
        vector_store: VectorStore | None = None,
        config: SearchConfig | None = None,
    ):
        self.embedding_service = embedding_service or EmbeddingService()
        self.vector_store = vector_store or VectorStore(dimensions=self.embedding_service.dimensions)
        self.config = config or SearchConfig()

        self.vector_store.load()

    def index_memory(self, memory_id: str, content: str, metadata: dict[str, Any]) -> None:
        """将记忆索引到向量存储"""
        embedding = self.embedding_service.embed(content)
        self.vector_store.add(memory_id, embedding.vector, {
            **metadata,
            "embedding_model": embedding.model,
            "text_hash": embedding.text_hash,
        })

    def search(
        self,
        query: str,
        tags: list[str] | None = None,
        priority: str | None = None,
        start_date: str | None = None,
        end_date: str | None = None,
        limit: int | None = None,
    ) -> list[SemanticMatch]:
        """语义搜索记忆"""
        query_embedding = self.embedding_service.embed(query)

        vector_results = self.vector_store.search(
            query_embedding.vector,
            top_k=self.config.top_k * 2,
        )

        memories_dir = get_project_root() / "data" / "memories"
        results = []

        for memory_id, score in vector_results:
            memory_path = memories_dir / f"{memory_id}.json"
            if not memory_path.exists():
                continue

            try:
                with open(memory_path, encoding="utf-8") as f:
                    memory = json.load(f)
            except Exception:
                continue

            content = memory.get("content", "")
            memory_tags = memory.get("tags", [])
            memory_priority = memory.get("priority", "medium")
            created_at = memory.get("created_at", "")
            last_accessed = memory.get("last_accessed", created_at)

            if tags:
                memory_tags_lower = [t.lower() for t in memory_tags]
                if not all(any(tag.lower() == mt for mt in memory_tags_lower) for tag in tags):
                    continue

            if priority and memory_priority != priority:
                continue

            if start_date and created_at and created_at < start_date:
                continue

            if end_date and created_at and created_at > end_date:
                continue

            if self.config.hybrid_weight > 0:
                keyword_score = self._keyword_match_score(query, content, memory_tags)
                final_score = (
                    self.config.hybrid_weight * score +
                    (1 - self.config.hybrid_weight) * keyword_score
                )
            else:
                final_score = score

            if final_score < self.config.similarity_threshold:
                continue

            try:
                last_accessed_dt = datetime.fromisoformat(last_accessed)
            except (ValueError, TypeError):
                last_accessed_dt = datetime.now()

            results.append(SemanticMatch(
                memory_id=memory_id,
                content=content,
                score=final_score,
                tags=memory_tags,
                priority=memory_priority,
                last_accessed=last_accessed_dt,
                created_at=created_at,
                embedding_model=query_embedding.model,
            ))

        priority_weights = {
            PriorityLevel.HIGH.value: 3,
            PriorityLevel.MEDIUM.value: 2,
            PriorityLevel.LOW.value: 1,
        }
        results.sort(
            key=lambda r: (r.score * priority_weights.get(r.priority, 1), r.last_accessed),
            reverse=True,
        )

        return results[:limit or self.config.top_k]

    def _keyword_match_score(self, query: str, content: str, tags: list[str]) -> float:
        """关键词匹配分数"""
        import re

        query_lower = query.lower()
        content_lower = content.lower()
        tags_lower = [t.lower() for t in tags]

        if query_lower in content_lower:
            return 1.0

        query_words = set(re.findall(r"[\w\u4e00-\u9fff]+", query_lower))
        if not query_words:
            return 0.0

        content_words = set(re.findall(r"[\w\u4e00-\u9fff]+", content_lower))
        tag_words = set(tags_lower)

        content_matches = len(query_words & content_words) / len(query_words)
        tag_matches = len(query_words & tag_words) / len(query_words) if query_words else 0

        return 0.7 * content_matches + 0.3 * tag_matches

    def check_deduplication(self, content: str, threshold: float | None = None) -> DeduplicationResult:
        """检查内容是否与已有记忆重复"""
        threshold = threshold or self.config.deduplication_threshold
        query_embedding = self.embedding_service.embed(content)

        results = self.vector_store.search(query_embedding.vector, top_k=5)

        for memory_id, score in results:
            if score >= threshold:
                return DeduplicationResult(
                    is_duplicate=True,
                    similar_memory_id=memory_id,
                    similarity_score=score,
                    threshold=threshold,
                )

        return DeduplicationResult(
            is_duplicate=False,
            similar_memory_id=None,
            similarity_score=0.0,
            threshold=threshold,
        )

    def get_statistics(self) -> dict[str, Any]:
        """获取向量存储统计信息"""
        return {
            "backend": self.vector_store.backend,
            "dimensions": self.vector_store.dimensions,
            "total_vectors": len(self.vector_store._vectors),
            "embedding_model": self.embedding_service.model_name,
            "embedding_backend": self.embedding_service.backend,
        }

    def save(self) -> None:
        """保存向量存储"""
        self.vector_store.save()

    def merge_memories(
        self,
        source_ids: list[str],
        target_id: str,
        merge_strategy: str = "concatenate",
    ) -> dict[str, Any]:
        """
        合并多个记忆为一个

        Args:
            source_ids: 要合并的记忆 ID 列表
            target_id: 目标记忆 ID（合并后保留的）
            merge_strategy: 合并策略
                - "concatenate": 内容拼接
                - "longest": 保留最长内容
                - "semantic_summary": 语义去重后拼接（推荐）

        Returns:
            合并结果，包含操作详情
        """

        memories_dir = get_project_root() / "data" / "memories"
        source_memories: list[dict[str, Any]] = []
        removed_ids: list[str] = []

        # 加载所有源记忆
        for sid in source_ids:
            if sid == target_id:
                continue
            memory_path = memories_dir / f"{sid}.json"
            if memory_path.exists():
                try:
                    with open(memory_path, encoding="utf-8") as f:
                        memory = json.load(f)
                    source_memories.append(memory)
                except Exception as e:
                    log(f"Failed to load memory {sid} for merge: {e}", "WARN")

        # 获取目标记忆
        target_path = memories_dir / f"{target_id}.json"
        if not target_path.exists():
            return {"success": False, "error": f"Target memory {target_id} not found"}

        with open(target_path, encoding="utf-8") as f:
            target_memory = json.load(f)

        # 执行合并
        if merge_strategy == "concatenate":
            merged_content = target_memory.get("content", "")
            for m in source_memories:
                content = m.get("content", "")
                if content and content not in merged_content:
                    merged_content += "\n\n---\n\n" + content
            target_memory["content"] = merged_content

        elif merge_strategy == "longest":
            all_contents = [target_memory.get("content", "")] + [
                m.get("content", "") for m in source_memories
            ]
            target_memory["content"] = max(all_contents, key=len, default="")

        elif merge_strategy == "semantic_summary":
            # 语义去重：用向量相似度检测并去除重复片段
            all_contents = [target_memory.get("content", "")]
            for m in source_memories:
                all_contents.append(m.get("content", ""))

            # 按句子分割并去重
            import re
            sentences = []
            for content in all_contents:
                # 按句号/换行分割
                parts = re.split(r"[。！？\n]+", content)
                for part in parts:
                    part = part.strip()
                    if part and len(part) > 10:  # 过滤太短的片段
                        sentences.append(part)

            # 去重：检查语义相似度
            unique_sentences: list[str] = []
            for sentence in sentences:
                is_duplicate = False
                for existing in unique_sentences:
                    # 简单的文本相似度检查
                    if self._text_similarity(sentence, existing) > 0.85:
                        is_duplicate = True
                        break
                if not is_duplicate:
                    unique_sentences.append(sentence)

            target_memory["content"] = "\n\n".join(unique_sentences)

        # 合并标签
        all_tags = set(target_memory.get("tags", []))
        for m in source_memories:
            all_tags.update(m.get("tags", []))
        target_memory["tags"] = sorted(all_tags)

        # 更新最后访问时间
        target_memory["last_accessed"] = datetime.now().isoformat()

        # 添加合并来源记录
        if "merge_history" not in target_memory:
            target_memory["merge_history"] = []
        target_memory["merge_history"].append({
            "merged_at": datetime.now().isoformat(),
            "strategy": merge_strategy,
            "source_ids": source_ids,
            "removed_count": len(source_ids),
        })

        # 写入目标记忆
        with open(target_path, "w", encoding="utf-8") as f:
            json.dump(target_memory, f, ensure_ascii=False, indent=2)

        # 删除源记忆文件
        for sid in source_ids:
            if sid == target_id:
                continue
            source_path = memories_dir / f"{sid}.json"
            if source_path.exists():
                source_path.unlink()
                removed_ids.append(sid)

                # 从向量存储中移除
                self.vector_store.remove(sid)

        # 重新索引目标记忆
        self.index_memory(
            target_id,
            target_memory.get("content", ""),
            {
                "tags": target_memory.get("tags", []),
                "priority": target_memory.get("priority", "medium"),
                "created_at": target_memory.get("created_at", ""),
            }
        )

        return {
            "success": True,
            "target_id": target_id,
            "removed_ids": removed_ids,
            "strategy": merge_strategy,
            "merged_content_length": len(target_memory.get("content", "")),
        }

    def _text_similarity(self, text1: str, text2: str) -> float:
        """简单的文本相似度计算（基于词重叠）"""
        import re

        words1 = set(re.findall(r"[\w\u4e00-\u9fff]+", text1.lower()))
        words2 = set(re.findall(r"[\w\u4e00-\u9fff]+", text2.lower()))

        if not words1 or not words2:
            return 0.0

        intersection = len(words1 & words2)
        union = len(words1 | words2)
        return intersection / union if union > 0 else 0.0
