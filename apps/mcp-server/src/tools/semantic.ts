/**
 * @fileoverview 语义搜索工具模块
 * @description 基于向量嵌入的语义记忆检索
 * 
 * 对应 Python 模块: src/memory_enhanced/semantic.py
 */

import { z } from 'zod';
import { ToolResponse } from '../types.js';
import { PROJECT_ROOT } from '../lib/paths.js';
import { readJson, writeJson } from '../lib/utils.js';
import path from 'path';
import fs from 'fs';

// ============================================================================
// Types
// ============================================================================

type PriorityLevel = 'low' | 'medium' | 'high';

interface MemoryData {
  memory_id: string;
  content: string;
  tags?: string[];
  priority?: PriorityLevel;
  created_at: string;
  last_accessed: string;
}

interface VectorEntry {
  vector: number[];
  metadata: {
    embedding_model: string;
    text_hash: string;
    tags?: string[];
    priority?: PriorityLevel;
    created_at?: string;
  };
}

interface VectorStoreData {
  vectors: { [memoryId: string]: number[] };
  metadata: { [memoryId: string]: Record<string, unknown> };
  dimensions: number;
}

interface SemanticMatch {
  memory_id: string;
  content: string;
  score: number;
  tags: string[];
  priority: string;
  last_accessed: string;
  created_at: string;
  embedding_model: string;
}

interface DeduplicationResult {
  is_duplicate: boolean;
  similar_memory_id: string | null;
  similarity_score: number;
  threshold: number;
}

// ============================================================================
// Embedding Service (TypeScript)
// ============================================================================

interface EmbeddingOptions {
  backend?: 'openai' | 'sentence-transformers' | 'mock';
  modelName?: string;
  apiKey?: string;
}

class EmbeddingService {
  private backend: string;
  private modelName: string;
  private apiKey?: string;
  private dimensions: number;
  private client: unknown | null = null;

  private static SUPPORTED_MODELS: Record<string, Record<string, number>> = {
    openai: {
      'text-embedding-3-small': 1536,
      'text-embedding-3-large': 3072,
      'text-embedding-ada-002': 1536,
    },
    'sentence-transformers': {
      'all-MiniLM-L6-v2': 384,
      'all-mpnet-base-v2': 768,
      'paraphrase-multilingual-MiniLM-L12-v2': 384,
    },
    mock: {
      mock: 384,
    },
  };

  constructor(options: EmbeddingOptions = {}) {
    this.backend = options.backend || 'mock';
    this.modelName = options.modelName || 'all-MiniLM-L6-v2';
    this.apiKey = options.apiKey;
    this.dimensions = EmbeddingService.SUPPORTED_MODELS[this.backend]?.[this.modelName] || 384;

    if (this.backend === 'openai') {
      this._initOpenAI();
    }
  }

  private _initOpenAI(): void {
    try {
      // Note: In MCP server, we would use the OpenAI SDK
      // For now, we'll use a simple fetch-based approach
      console.log(`EmbeddingService: Using OpenAI backend with model ${this.modelName}`);
    } catch (e) {
      console.warn('EmbeddingService: OpenAI initialization failed, falling back to mock');
      this.backend = 'mock';
      this.dimensions = 384;
    }
  }

  private _hashText(text: string): string {
    // Simple hash for deduplication
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(16, '0').substring(0, 16);
  }

  private _mockEmbed(text: string): number[] {
    // Deterministic mock embedding based on text content
    const hash = this._hashText(text);
    const vector: number[] = [];
    for (let i = 0; i < this.dimensions; i++) {
      const charCode = hash.charCodeAt(i % hash.length);
      vector.push((charCode % 256) / 256);
    }
    return vector;
  }

  async embed(text: string): Promise<{ vector: number[]; model: string; dimensions: number; textHash: string }> {
    const textHash = this._hashText(text);
    let vector: number[];

    if (this.backend === 'openai' && this.apiKey) {
      try {
        const response = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            input: text,
            model: this.modelName,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          vector = data.data[0].embedding;
        } else {
          console.warn('EmbeddingService: OpenAI API call failed, using mock');
          vector = this._mockEmbed(text);
        }
      } catch (e) {
        console.warn('EmbeddingService: OpenAI request error, using mock');
        vector = this._mockEmbed(text);
      }
    } else {
      vector = this._mockEmbed(text);
    }

    return {
      vector,
      model: `${this.backend}/${this.modelName}`,
      dimensions: vector.length,
      textHash,
    };
  }

  getDimensions(): number {
    return this.dimensions;
  }
}

// ============================================================================
// Vector Store (TypeScript)
// ============================================================================

class VectorStore {
  private backend: string;
  private storagePath: string;
  private dimensions: number;
  private vectors: { [memoryId: string]: number[] } = {};
  private metadata: { [memoryId: string]: Record<string, unknown> } = {};

  constructor(backend: string = 'memory', storagePath: string, dimensions: number = 384) {
    this.backend = backend;
    this.storagePath = storagePath;
    this.dimensions = dimensions;
    this.load();
  }

  add(memoryId: string, vector: number[], metadata: Record<string, unknown>): void {
    if (vector.length !== this.dimensions) {
      throw new Error(`Vector dimension mismatch: expected ${this.dimensions}, got ${vector.length}`);
    }
    this.vectors[memoryId] = vector;
    this.metadata[memoryId] = metadata;
    this.save();
  }

  remove(memoryId: string): boolean {
    if (this.vectors[memoryId]) {
      delete this.vectors[memoryId];
      delete this.metadata[memoryId];
      this.save();
      return true;
    }
    return false;
  }

  get(memoryId: string): { vector: number[]; metadata: Record<string, unknown> } | null {
    if (this.vectors[memoryId]) {
      return {
        vector: this.vectors[memoryId],
        metadata: this.metadata[memoryId],
      };
    }
    return null;
  }

  search(queryVector: number[], topK: number = 10): Array<{ memoryId: string; score: number }> {
    // Cosine similarity search (memory backend)
    const results: Array<{ memoryId: string; score: number }> = [];

    for (const [memoryId, vector] of Object.entries(this.vectors)) {
      const score = this._cosineSimilarity(queryVector, vector);
      results.push({ memoryId, score });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  private _cosineSimilarity(v1: number[], v2: number[]): number {
    let dot = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < v1.length; i++) {
      dot += v1[i] * v2[i];
      norm1 += v1[i] * v1[i];
      norm2 += v2[i] * v2[i];
    }

    if (norm1 === 0 || norm2 === 0) return 0;
    return dot / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  save(): void {
    const data: VectorStoreData = {
      vectors: this.vectors,
      metadata: this.metadata,
      dimensions: this.dimensions,
    };

    const indexPath = path.join(this.storagePath, 'vectors.json');
    writeJson(indexPath, data);
  }

  load(): void {
    const indexPath = path.join(this.storagePath, 'vectors.json');
    if (fs.existsSync(indexPath)) {
      const data = readJson(indexPath) as VectorStoreData;
      if (data) {
        this.vectors = data.vectors || {};
        this.metadata = data.metadata || {};
        this.dimensions = data.dimensions || this.dimensions;
      }
    }
  }

  getStatistics(): { totalVectors: number; dimensions: number; backend: string } {
    return {
      totalVectors: Object.keys(this.vectors).length,
      dimensions: this.dimensions,
      backend: this.backend,
    };
  }
}

// ============================================================================
// Semantic Retriever
// ============================================================================

interface SearchConfig {
  similarityThreshold?: number;
  topK?: number;
  hybridWeight?: number;
  deduplicationThreshold?: number;
}

class SemanticRetriever {
  private embeddingService: EmbeddingService;
  private vectorStore: VectorStore;
  private config: SearchConfig;

  constructor(options: {
    embeddingBackend?: string;
    embeddingModel?: string;
    apiKey?: string;
    config?: SearchConfig;
  } = {}) {
    this.embeddingService = new EmbeddingService({
      backend: options.embeddingBackend as 'openai' | 'sentence-transformers' | 'mock',
      modelName: options.embeddingModel,
      apiKey: options.apiKey,
    });

    const vectorsPath = path.join(PROJECT_ROOT, 'data', 'embeddings', 'vectors');
    this.vectorStore = new VectorStore(
      'memory',
      vectorsPath,
      this.embeddingService.getDimensions()
    );

    this.config = {
      similarityThreshold: 0.7,
      topK: 10,
      hybridWeight: 0.5,
      deduplicationThreshold: 0.85,
      ...options.config,
    };
  }

  async indexMemory(memoryId: string, content: string, metadata: Record<string, unknown>): Promise<void> {
    const embedding = await this.embeddingService.embed(content);
    this.vectorStore.add(memoryId, embedding.vector, {
      ...metadata,
      embedding_model: embedding.model,
      text_hash: embedding.textHash,
    });
  }

  async search(params: {
    query: string;
    tags?: string[];
    priority?: PriorityLevel;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<SemanticMatch[]> {
    const { query, tags, priority, startDate, endDate, limit } = params;

    // Generate query embedding
    const queryEmbedding = await this.embeddingService.embed(query);

    // Vector similarity search
    const vectorResults = this.vectorStore.search(
      queryEmbedding.vector,
      this.config.topK! * 2
    );

    // Load memory files and apply filters
    const memoriesDir = path.join(PROJECT_ROOT, 'data', 'memories');
    const results: SemanticMatch[] = [];

    for (const { memoryId, score } of vectorResults) {
      const memoryPath = path.join(memoriesDir, `${memoryId}.json`);
      if (!fs.existsSync(memoryPath)) continue;

      const memory = readJson(memoryPath) as MemoryData;
      if (!memory) continue;

      const content = memory.content || '';
      const memoryTags = memory.tags || [];
      const memoryPriority = memory.priority || 'medium';
      const createdAt = memory.created_at || '';
      const lastAccessed = memory.last_accessed || createdAt;

      // Apply filters
      if (tags && tags.length > 0) {
        const memoryTagsLower = memoryTags.map(t => t.toLowerCase());
        const allMatch = tags.every(tag =>
          memoryTagsLower.includes(tag.toLowerCase())
        );
        if (!allMatch) continue;
      }

      if (priority && memoryPriority !== priority) continue;
      if (startDate && createdAt && createdAt < startDate) continue;
      if (endDate && createdAt && createdAt > endDate) continue;

      // Hybrid scoring
      let finalScore = score;
      if (this.config.hybridWeight! > 0) {
        const keywordScore = this._keywordMatchScore(query, content, memoryTags);
        finalScore = (
          this.config.hybridWeight! * score +
          (1 - this.config.hybridWeight!) * keywordScore
        );
      }

      if (finalScore < this.config.similarityThreshold!) continue;

      results.push({
        memory_id: memoryId,
        content,
        score: finalScore,
        tags: memoryTags,
        priority: memoryPriority,
        last_accessed: lastAccessed,
        created_at: createdAt,
        embedding_model: queryEmbedding.model,
      });
    }

    // Sort by priority-weighted score
    const priorityWeights: Record<PriorityLevel, number> = { high: 3, medium: 2, low: 1 };
    results.sort((a, b) => {
      const scoreDiff = (b.score * priorityWeights[b.priority as PriorityLevel]) -
                        (a.score * priorityWeights[a.priority as PriorityLevel]);
      if (scoreDiff !== 0) return scoreDiff;
      return b.last_accessed.localeCompare(a.last_accessed);
    });

    return results.slice(0, limit || this.config.topK!);
  }

  private _keywordMatchScore(query: string, content: string, tags: string[]): number {
    const queryLower = query.toLowerCase();
    const contentLower = content.toLowerCase();
    const tagsLower = tags.map(t => t.toLowerCase());

    // Exact match
    if (queryLower.includes(contentLower) || contentLower.includes(queryLower)) {
      return 1.0;
    }

    // Word-level matching (simplified)
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
    if (queryWords.length === 0) return 0;

    const contentWords = contentLower.split(/\s+/);
    const tagWords = tagsLower;

    const contentMatches = queryWords.filter(w =>
      contentWords.some(cw => cw.includes(w) || w.includes(cw))
    ).length / queryWords.length;

    const tagMatches = queryWords.filter(w =>
      tagWords.some(tw => tw.includes(w) || w.includes(tw))
    ).length / queryWords.length;

    return 0.7 * contentMatches + 0.3 * tagMatches;
  }

  async checkDeduplication(content: string, threshold?: number): Promise<DeduplicationResult> {
    const thresh = threshold ?? this.config.deduplicationThreshold!;
    const embedding = await this.embeddingService.embed(content);
    const results = this.vectorStore.search(embedding.vector, 5);

    for (const { memoryId, score } of results) {
      if (score >= thresh) {
        return {
          is_duplicate: true,
          similar_memory_id: memoryId,
          similarity_score: score,
          threshold: thresh,
        };
      }
    }

    return {
      is_duplicate: false,
      similar_memory_id: null,
      similarity_score: 0,
      threshold: thresh,
    };
  }

  getStatistics(): {
    embedding_model: string;
    embedding_backend: string;
    vector_store: { totalVectors: number; dimensions: number; backend: string };
  } {
    return {
      embedding_model: this.embeddingService['modelName'],
      embedding_backend: this.embeddingService['backend'],
      vector_store: this.vectorStore.getStatistics(),
    };
  }

  save(): void {
    this.vectorStore.save();
  }
}

// ============================================================================
// MCP Tool Handlers
// ============================================================================

/**
 * Search memory using semantic similarity
 */
export const SemanticSearchSchema = z.object({
  query: z.string().describe('Natural language search query'),
  tags: z.array(z.string()).optional().describe('Filter by tags (AND semantics)'),
  priority: z.enum(['low', 'medium', 'high']).optional().describe('Filter by priority'),
  start_date: z.string().optional().describe('Start date (YYYY-MM-DD)'),
  end_date: z.string().optional().describe('End date (YYYY-MM-DD)'),
  limit: z.number().optional().default(10).describe('Maximum results to return'),
  similarity_threshold: z.number().optional().default(0.7).describe('Minimum similarity score'),
  hybrid_weight: z.number().optional().default(0.5).describe('Weight for hybrid search (0=keyword, 1=semantic)'),
});

export async function handleSemanticSearch(
  params: z.infer<typeof SemanticSearchSchema>
): Promise<ToolResponse> {
  try {
    const retriever = new SemanticRetriever({
      config: {
        similarityThreshold: params.similarity_threshold,
        hybridWeight: params.hybrid_weight,
      },
    });

    const results = await retriever.search({
      query: params.query,
      tags: params.tags,
      priority: params.priority,
      startDate: params.start_date,
      endDate: params.end_date,
      limit: params.limit,
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          total: results.length,
          data: results,
          query: params.query,
          search_type: 'semantic_hybrid',
        }),
      }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: (error as Error).message,
        }),
      }],
    };
  }
}

/**
 * Check if content is duplicate of existing memory
 */
export const CheckDeduplicationSchema = z.object({
  content: z.string().describe('Content to check for duplicates'),
  threshold: z.number().optional().default(0.85).describe('Similarity threshold for duplicate detection'),
});

export async function handleCheckDeduplication(
  params: z.infer<typeof CheckDeduplicationSchema>
): Promise<ToolResponse> {
  try {
    const retriever = new SemanticRetriever();
    const result = await retriever.checkDeduplication(params.content, params.threshold);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          is_duplicate: result.is_duplicate,
          similar_memory_id: result.similar_memory_id,
          similarity_score: result.similarity_score,
          threshold: result.threshold,
          recommendation: result.is_duplicate
            ? `Consider merging with memory ${result.similar_memory_id}`
            : 'No similar memory found, safe to create new entry',
        }),
      }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: (error as Error).message,
        }),
      }],
    };
  }
}

/**
 * Get semantic search statistics
 */
export const SemanticStatsSchema = z.object({});

export async function handleSemanticStats(
  _params: z.infer<typeof SemanticStatsSchema>
): Promise<ToolResponse> {
  try {
    const retriever = new SemanticRetriever();
    const stats = retriever.getStatistics();

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          data: stats,
        }),
      }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: (error as Error).message,
        }),
      }],
    };
  }
}

/**
 * Index a memory for semantic search
 */
export const IndexMemorySchema = z.object({
  memory_id: z.string().describe('Memory ID to index'),
  content: z.string().describe('Memory content'),
  metadata: z.record(z.unknown()).optional().describe('Additional metadata'),
});

export async function handleIndexMemory(
  params: z.infer<typeof IndexMemorySchema>
): Promise<ToolResponse> {
  try {
    const retriever = new SemanticRetriever();
    await retriever.indexMemory(params.memory_id, params.content, params.metadata || {});
    retriever.save();

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          message: `Memory ${params.memory_id} indexed for semantic search`,
        }),
      }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: (error as Error).message,
        }),
      }],
    };
  }
}

/**
 * Rebuild all semantic indexes from existing memories
 */
export const RebuildIndexSchema = z.object({
  force: z.boolean().optional().default(false).describe('Force rebuild even if index exists'),
});

export async function handleRebuildIndex(
  params: z.infer<typeof RebuildIndexSchema>
): Promise<ToolResponse> {
  try {
    const memoriesDir = path.join(PROJECT_ROOT, 'data', 'memories');
    const vectorsPath = path.join(PROJECT_ROOT, 'data', 'embeddings', 'vectors');

    // Check if index exists
    const indexPath = path.join(vectorsPath, 'vectors.json');
    if (fs.existsSync(indexPath) && !params.force) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: 'Index already exists. Use force=true to rebuild.',
            existing_index: true,
          }),
        }],
      };
    }

    // Ensure directories exist
    fs.mkdirSync(vectorsPath, { recursive: true });

    const retriever = new SemanticRetriever();

    // Read all memory files
    if (!fs.existsSync(memoriesDir)) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: 'No memories found to index',
            indexed: 0,
          }),
        }],
      };
    }

    const files = fs.readdirSync(memoriesDir).filter(f => f.endsWith('.json'));
    let indexed = 0;

    for (const file of files) {
      const memoryPath = path.join(memoriesDir, file);
      const memoryId = file.replace('.json', '');

      try {
        const memory = readJson(memoryPath) as MemoryData;
        if (memory && memory.content) {
          await retriever.indexMemory(
            memoryId,
            memory.content,
            {
              tags: memory.tags,
              priority: memory.priority,
              created_at: memory.created_at,
            }
          );
          indexed++;
        }
      } catch (e) {
        console.warn(`Failed to index memory ${memoryId}:`, e);
      }
    }

    retriever.save();

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          message: `Rebuilt semantic index for ${indexed} memories`,
          indexed,
          total_files: files.length,
        }),
      }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: (error as Error).message,
        }),
      }],
    };
  }
}
