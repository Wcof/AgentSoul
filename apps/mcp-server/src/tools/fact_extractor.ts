/**
 * @fileoverview 自动事实提取工具模块
 * @description 从对话中自动抽取结构化事实，支持记忆去重合并
 * 
 * 对应 Python 模块: src/memory_enhanced/fact_extractor.py
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

type FactType = 'personality' | 'preference' | 'habit' | 'knowledge' | 'relationship' | 'goal' | 'event' | 'opinion' | 'other';
type FactConfidence = 'high' | 'medium' | 'low';

interface ExtractedFact {
  fact_id: string;
  fact_type: FactType;
  subject: string;
  attribute: string;
  value: string;
  confidence: FactConfidence;
  source_text: string;
  context: string;
  extracted_at: string;
  requires_verification: boolean;
}

interface ExtractionResult {
  facts: ExtractedFact[];
  conversation_summary: string;
  no_new_facts: boolean;
  processing_time_ms: number;
}

interface MergeStrategy {
  concatenate: 'concatenate';
  longest: 'longest';
  semantic_summary: 'semantic_summary';
}

// ============================================================================
// Fact Extractor (TypeScript Implementation)
// ============================================================================

class FactExtractorTS {
  private factCounter = 0;

  private static readonly PREFERENCE_PATTERNS: Array<{ attribute: string; triggers: string[] }> = [
    { attribute: '喜欢的音乐', triggers: ['喜欢.*音乐', '爱听', '偏好.*音乐', '音乐品味'] },
    { attribute: '喜欢的食物', triggers: ['喜欢.*吃', '爱吃', '不喜欢', '讨厌', '口味偏好'] },
    { attribute: '喜欢的颜色', triggers: ['喜欢.*颜色', '偏爱.*色'] },
    { attribute: '工作方式', triggers: ['喜欢.*工作', '工作习惯', '工作方式', '偏好.*工作'] },
    { attribute: '沟通风格', triggers: ['喜欢.*沟通', '沟通偏好', '不喜欢.*长篇'] },
  ];

  private static readonly PERSONALITY_PATTERNS: Array<{ attribute: string; triggers: string[] }> = [
    { attribute: '性格特征', triggers: ['性格', '为人', '是个.*人', '比较', '性格上'] },
    { attribute: '内向/外向', triggers: ['内向', '外向', '社恐', '社牛', '喜欢独处', '喜欢社交'] },
  ];

  private static readonly KNOWLEDGE_PATTERNS: Array<{ attribute: string; triggers: string[] }> = [
    { attribute: '专业技能', triggers: ['擅长', '精通', '会', '学过', '专业是'] },
    { attribute: '职业/身份', triggers: ['我是', '工作是', '职业是', '职位是', '从事'] },
  ];

  private static readonly HABIT_PATTERNS: Array<{ attribute: string; triggers: string[] }> = [
    { attribute: '作息习惯', triggers: ['早起', '熬夜', '作息', '睡觉时间', '起床时间'] },
    { attribute: '运动习惯', triggers: ['运动', '健身', '跑步', '锻炼'] },
  ];

  private static readonly GOAL_PATTERNS: Array<{ attribute: string; triggers: string[] }> = [
    { attribute: '短期目标', triggers: ['想', '希望', '打算', '计划', '目标'] },
  ];

  private getAllPatterns(): Array<{ type: FactType; attribute: string; triggers: string[] }> {
    const typeMap: Record<string, FactType> = {
      preference: 'preference',
      personality: 'personality',
      knowledge: 'knowledge',
      habit: 'habit',
    };

    return [
      ...FactExtractorTS.PREFERENCE_PATTERNS.map(p => ({ type: typeMap.preference, ...p })),
      ...FactExtractorTS.PERSONALITY_PATTERNS.map(p => ({ type: typeMap.personality, ...p })),
      ...FactExtractorTS.KNOWLEDGE_PATTERNS.map(p => ({ type: typeMap.knowledge, ...p })),
      ...FactExtractorTS.HABIT_PATTERNS.map(p => ({ type: typeMap.habit, ...p })),
    ];
  }

  private generateFactId(): string {
    this.factCounter++;
    const now = new Date();
    return `fact_${now.toISOString().replace(/[:.]/g, '-')}_${String(this.factCounter).padStart(4, '0')}`;
  }

  private determineConfidence(text: string): FactConfidence {
    const highIndicators = ['就是', '确实是', '一直是', '很清楚', '明确', '肯定'];
    if (highIndicators.some(ind => text.includes(ind))) return 'high';

    const mediumIndicators = ['感觉', '好像', '可能', '应该', '我觉得'];
    if (mediumIndicators.some(ind => text.includes(ind))) return 'medium';

    return 'low';
  }

  extractByRules(conversationText: string): ExtractedFact[] {
    const facts: ExtractedFact[] = [];
    const patterns = this.getAllPatterns();

    for (const pattern of patterns) {
      for (const trigger of pattern.triggers) {
        try {
          const regex = new RegExp(trigger, 'gi');
          let match;
          while ((match = regex.exec(conversationText)) !== null) {
            const start = Math.max(0, match.index - 50);
            const end = Math.min(conversationText.length, match.index + match[0].length + 100);
            const context = conversationText.substring(start, end).trim();

            const value = match[0].length > 50 ? match[0].substring(0, 50) + '...' : match[0];
            const confidence = this.determineConfidence(value);

            facts.push({
              fact_id: this.generateFactId(),
              fact_type: pattern.type,
              subject: '用户',
              attribute: pattern.attribute,
              value,
              confidence,
              source_text: match[0],
              context,
              extracted_at: new Date().toISOString(),
              requires_verification: confidence === 'low',
            });
          }
        } catch {
          // Skip invalid regex
        }
      }
    }

    return facts;
  }

  async extractByLLM(conversationText: string, apiKey?: string): Promise<ExtractionResult> {
    const startTime = Date.now();

    const prompt = `请从以下对话中提取结构化事实信息。

对话内容：
${conversationText.substring(0, 2000)}

请按照以下格式输出 JSON（不要输出其他内容）：
{
  "facts": [
    {
      "type": "preference|personality|knowledge|habit|relationship|goal|event|opinion|other",
      "subject": "主体",
      "attribute": "属性名",
      "value": "具体值",
      "confidence": "high|medium|low",
      "source_text": "原文片段",
      "requires_verification": true/false
    }
  ],
  "summary": "对话摘要（1-2 句话）"
}

注意：
- 只提取关于用户的事实
- 置信度：明确陈述=high，间接推断=medium，推测=low
- 需要验证的事实标记 requires_verification=true
- 不要重复提取相同信息`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const result = JSON.parse(data.choices[0].message.content);

      const facts: ExtractedFact[] = result.facts?.map((f: any) => ({
        fact_id: this.generateFactId(),
        fact_type: f.type,
        subject: f.subject || '用户',
        attribute: f.attribute,
        value: f.value,
        confidence: f.confidence,
        source_text: f.source_text || '',
        context: conversationText.substring(0, 500),
        extracted_at: new Date().toISOString(),
        requires_verification: f.requires_verification || false,
      })) || [];

      return {
        facts,
        conversation_summary: result.summary || '',
        no_new_facts: facts.length === 0,
        processing_time_ms: Date.now() - startTime,
      };
    } catch (error) {
      console.warn('FactExtractor: LLM 调用失败，降级到规则模式:', (error as Error).message);
      const facts = this.extractByRules(conversationText);
      return {
        facts,
        conversation_summary: '',
        no_new_facts: facts.length === 0,
        processing_time_ms: Date.now() - startTime,
      };
    }
  }

  getFactStatistics(facts: ExtractedFact[]): {
    totalFacts: number;
    byType: Record<string, number>;
    byConfidence: Record<string, number>;
    verificationNeeded: number;
  } {
    const byType: Record<string, number> = {};
    const byConfidence: Record<string, number> = {};
    let verificationNeeded = 0;

    for (const fact of facts) {
      byType[fact.fact_type] = (byType[fact.fact_type] || 0) + 1;
      byConfidence[fact.confidence] = (byConfidence[fact.confidence] || 0) + 1;
      if (fact.requires_verification) verificationNeeded++;
    }

    return { totalFacts: facts.length, byType, byConfidence, verificationNeeded };
  }
}

// ============================================================================
// Memory Merger
// ============================================================================

class MemoryMerger {
  private memoriesDir: string;

  constructor() {
    this.memoriesDir = path.join(PROJECT_ROOT, 'data', 'memories');
  }

  async mergeMemories(
    sourceIds: string[],
    targetId: string,
    strategy: 'concatenate' | 'longest' | 'semantic_summary' = 'concatenate',
  ): Promise<{ success: boolean; targetId: string; removedIds: string[]; error?: string }> {
    const removedIds: string[] = [];

    // Load target memory
    const targetPath = path.join(this.memoriesDir, `${targetId}.json`);
    if (!fs.existsSync(targetPath)) {
      return { success: false, targetId, removedIds, error: `Target memory ${targetId} not found` };
    }

    const targetMemory = readJson(targetPath) as Record<string, unknown>;
    if (!targetMemory) {
      return { success: false, targetId, removedIds, error: `Failed to load target memory ${targetId}` };
    }

    // Load source memories
    const sourceMemories: Record<string, unknown>[] = [];
    for (const sid of sourceIds) {
      if (sid === targetId) continue;
      const sourcePath = path.join(this.memoriesDir, `${sid}.json`);
      if (fs.existsSync(sourcePath)) {
        const memory = readJson(sourcePath) as Record<string, unknown>;
        if (memory) sourceMemories.push(memory);
      }
    }

    // Merge content
    const targetContent = String(targetMemory.content || '');
    let mergedContent = targetContent;

    if (strategy === 'concatenate') {
      for (const m of sourceMemories) {
        const content = String(m.content || '');
        if (content && !mergedContent.includes(content)) {
          mergedContent += '\n\n---\n\n' + content;
        }
      }
    } else if (strategy === 'longest') {
      const allContents = [targetContent, ...sourceMemories.map(m => String(m.content || ''))];
      mergedContent = allContents.reduce((a, b) => a.length > b.length ? a : b);
    } else if (strategy === 'semantic_summary') {
      // Simple dedup: remove duplicate sentences
      const allSentences = [targetContent, ...sourceMemories.map(m => String(m.content || ''))]
        .join('\n')
        .split(/[。！？\n]+/)
        .map(s => s.trim())
        .filter(s => s.length > 10);

      const unique: string[] = [];
      for (const sentence of allSentences) {
        const isDuplicate = unique.some(existing => this.textSimilarity(sentence, existing) > 0.85);
        if (!isDuplicate) unique.push(sentence);
      }
      mergedContent = unique.join('\n\n');
    }

    // Update target memory
    targetMemory.content = mergedContent;

    // Merge tags
    const allTags = new Set<string>(targetMemory.tags as string[] || []);
    for (const m of sourceMemories) {
      for (const tag of (m.tags as string[]) || []) {
        allTags.add(tag);
      }
    }
    targetMemory.tags = Array.from(allTags).sort();

    // Update metadata
    targetMemory.last_accessed = new Date().toISOString();

    if (!targetMemory.merge_history) targetMemory.merge_history = [];
    (targetMemory.merge_history as any[]).push({
      merged_at: new Date().toISOString(),
      strategy,
      source_ids: sourceIds,
      removed_count: sourceIds.length,
    });

    // Write target
    writeJson(targetPath, targetMemory);

    // Delete source files
    for (const sid of sourceIds) {
      if (sid === targetId) continue;
      const sourcePath = path.join(this.memoriesDir, `${sid}.json`);
      if (fs.existsSync(sourcePath)) {
        fs.unlinkSync(sourcePath);
        removedIds.push(sid);
      }
    }

    return { success: true, targetId, removedIds };
  }

  private textSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    if (words1.size === 0 || words2.size === 0) return 0;

    let intersection = 0;
    for (const w of words1) {
      if (words2.has(w)) intersection++;
    }

    return intersection / Math.max(words1.size, words2.size);
  }
}

// ============================================================================
// MCP Tool Handlers
// ============================================================================

/**
 * Extract facts from conversation text
 */
export const ExtractFactsSchema = z.object({
  conversation: z.string().describe('Conversation text to extract facts from'),
  use_llm: z.boolean().optional().default(false).describe('Use LLM for extraction (requires API key)'),
  api_key: z.string().optional().describe('OpenAI API key (required if use_llm=true)'),
  min_confidence: z.enum(['high', 'medium', 'low']).optional().default('low').describe('Minimum confidence level'),
});

export async function handleExtractFacts(
  params: z.infer<typeof ExtractFactsSchema>
): Promise<ToolResponse> {
  try {
    const extractor = new FactExtractorTS();
    let result: ExtractionResult;

    if (params.use_llm) {
      result = await extractor.extractByLLM(params.conversation, params.api_key);
    } else {
      const facts = extractor.extractByRules(params.conversation);
      const filtered = params.min_confidence
        ? facts.filter(f => {
            const order = { high: 3, medium: 2, low: 1 };
            return order[f.confidence] >= order[params.min_confidence!];
          })
        : facts;

      result = {
        facts: filtered,
        conversation_summary: '',
        no_new_facts: filtered.length === 0,
        processing_time_ms: 0,
      };
    }

    const stats = extractor.getFactStatistics(result.facts);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          facts: result.facts,
          statistics: stats,
          conversation_summary: result.conversation_summary,
          no_new_facts: result.no_new_facts,
          extraction_method: params.use_llm ? 'llm' : 'rules',
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
 * Get fact extraction statistics
 */
export const FactStatsSchema = z.object({
  fact_type: z.enum(['personality', 'preference', 'habit', 'knowledge', 'relationship', 'goal', 'event', 'opinion', 'other']).optional(),
});

export async function handleFactStats(
  _params: z.infer<typeof FactStatsSchema>
): Promise<ToolResponse> {
  // This would query stored facts from EntityMemory in a full implementation
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        success: true,
        message: 'Fact statistics available after extracting facts from conversations',
        usage: 'Call extract_facts first, then analyze the results',
      }),
    }],
  };
}

/**
 * Merge multiple memories into one
 */
export const MergeMemoriesSchema = z.object({
  source_ids: z.array(z.string()).describe('Memory IDs to merge'),
  target_id: z.string().describe('Target memory ID to merge into'),
  strategy: z.enum(['concatenate', 'longest', 'semantic_summary']).optional().default('concatenate').describe('Merge strategy'),
});

export async function handleMergeMemories(
  params: z.infer<typeof MergeMemoriesSchema>
): Promise<ToolResponse> {
  try {
    const merger = new MemoryMerger();
    const result = await merger.mergeMemories(
      params.source_ids,
      params.target_id,
      params.strategy,
    );

    if (result.success) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: `Successfully merged ${result.removedIds.length} memories into ${result.targetId}`,
            target_id: result.targetId,
            removed_ids: result.removedIds,
            strategy: params.strategy,
          }),
        }],
      };
    } else {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: result.error,
          }),
        }],
      };
    }
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
