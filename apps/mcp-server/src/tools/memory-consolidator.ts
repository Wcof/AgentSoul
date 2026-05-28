/**
 * @fileoverview 记忆合并管线 MCP 工具模块
 * @description 支持日→周→月→年的分层记忆摘要合并
 *
 * 对应 Python 模块: src/memory_enhanced/memory_consolidator.py
 */

import { z } from 'zod';
import { ToolResponse } from '../types.js';
import { PROJECT_ROOT } from '../lib/paths.js';
import { readJson, writeJson } from '../lib/utils.js';
import path from 'path';
import fs from 'fs';

// ============================================================================
// Text Summarizer (rule-based, no LLM)
// ============================================================================

const IMPORTANT_MARKERS = [
  '重要', '关键', '决定', '完成', '失败', '突破', '发现',
  'important', 'key', 'decided', 'completed', 'failed', 'breakthrough', 'found',
  '记住', '注意', '提醒', '目标', '计划',
  'remember', 'note', 'remind', 'goal', 'plan',
];

const EMOTION_MARKERS = [
  '开心', '高兴', '兴奋', '满意', '感谢', '喜欢',
  '难过', '失望', '沮丧', '焦虑', '担心', '讨厌',
  'happy', 'glad', 'excited', 'satisfied', 'grateful', 'like',
  'sad', 'disappointed', 'frustrated', 'anxious', 'worried', 'dislike',
];

function summarizeTexts(
  texts: string[],
  maxLength: number = 500
): { summary: string; key_facts: string[]; emotions: string[] } {
  if (texts.length === 0) {
    return { summary: '', key_facts: [], emotions: [] };
  }

  // Split into sentences
  const allSentences: string[] = [];
  for (const text of texts) {
    const sentences = text.split(/[。！？.!?\n]+/);
    for (const s of sentences) {
      const trimmed = s.trim();
      if (trimmed && trimmed.length > 5) {
        allSentences.push(trimmed);
      }
    }
  }

  if (allSentences.length === 0) {
    return { summary: '', key_facts: [], emotions: [] };
  }

  // Score sentences by importance
  const scored: Array<{ sentence: string; score: number }> = [];
  const keyFacts: string[] = [];
  const emotions: string[] = [];

  for (const sentence of allSentences) {
    let score = 0;

    // Important markers
    for (const marker of IMPORTANT_MARKERS) {
      if (sentence.toLowerCase().includes(marker)) {
        score += 2.0;
        if (keyFacts.length < 20) {
          keyFacts.push(sentence.substring(0, 100));
        }
        break;
      }
    }

    // Emotion markers
    for (const marker of EMOTION_MARKERS) {
      if (sentence.toLowerCase().includes(marker)) {
        score += 1.0;
        if (emotions.length < 10) {
          emotions.push(marker);
        }
        break;
      }
    }

    // Contains numbers
    if (/\d+/.test(sentence)) {
      score += 0.5;
    }

    // Medium length bonus
    if (sentence.length >= 20 && sentence.length <= 100) {
      score += 0.3;
    }

    scored.push({ sentence, score });
  }

  // Deduplicate by word overlap
  const unique: Array<{ sentence: string; score: number }> = [];
  for (const item of scored) {
    const words = new Set(item.sentence.toLowerCase().match(/[\w\u4e00-\u9fff]+/g) || []);
    let isDup = false;
    for (const existing of unique) {
      const existingWords = new Set(existing.sentence.toLowerCase().match(/[\w\u4e00-\u9fff]+/g) || []);
      const intersection = new Set([...words].filter(w => existingWords.has(w)));
      const union = new Set([...words, ...existingWords]);
      if (words.size > 0 && existingWords.size > 0 && union.size > 0) {
        if (intersection.size / union.size > 0.7) {
          isDup = true;
          break;
        }
      }
    }
    if (!isDup) {
      unique.push(item);
    }
  }

  // Sort by score, take top summary
  unique.sort((a, b) => b.score - a.score);

  const parts: string[] = [];
  let currentLength = 0;
  for (const item of unique) {
    if (currentLength + item.sentence.length > maxLength) break;
    parts.push(item.sentence);
    currentLength += item.sentence.length;
  }

  let summary = parts.join('。');
  if (summary && !/[。！？.!?\n]$/.test(summary)) {
    summary += '。';
  }

  // Deduplicate facts and emotions
  const uniqueFacts = [...new Set(keyFacts)];
  const uniqueEmotions = [...new Set(emotions)];

  return { summary, key_facts: uniqueFacts, emotions: uniqueEmotions };
}

// ============================================================================
// Memory Consolidator
// ============================================================================

interface ConsolidationResult {
  success: boolean;
  source_level: string;
  target_level: string;
  source_count: number;
  target_path: string;
  summary_length: number;
  key_facts: string[];
  emotions: string[];
  tags: string[];
  skipped: string[];
  error?: string;
}

function getDateRangeForWeek(year: number, week: number): { start: string; end: string } {
  // ISO week calculation
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7; // Convert Sunday=0 to 7
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - dayOfWeek + 1);

  const weekStart = new Date(startOfWeek1);
  weekStart.setDate(startOfWeek1.getDate() + (week - 1) * 7);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const fmt = (d: Date) => d.toISOString().split('T')[0];
  return { start: fmt(weekStart), end: fmt(weekEnd) };
}

function consolidateDailyToWeekly(
  year: number,
  week: number,
  force: boolean = false
): ConsolidationResult {
  const dayDir = path.join(PROJECT_ROOT, 'data', 'memory', 'day');
  const weekDir = path.join(PROJECT_ROOT, 'data', 'memory', 'week');

  // Ensure week dir exists
  if (!fs.existsSync(weekDir)) {
    fs.mkdirSync(weekDir, { recursive: true });
  }

  const targetFile = path.join(weekDir, `${year}-W${String(week).padStart(2, '0')}.json`);

  // Check if already consolidated
  if (!force && fs.existsSync(targetFile)) {
    const existing = readJson(targetFile) as Record<string, unknown> | null;
    if (existing && existing.consolidation_status === 'complete') {
      return {
        success: true,
        source_level: 'daily',
        target_level: 'weekly',
        source_count: 0,
        target_path: targetFile,
        summary_length: 0,
        key_facts: [],
        emotions: [],
        tags: [],
        skipped: [`already consolidated: ${path.basename(targetFile)}`],
      };
    }
  }

  // Collect daily memories
  const { start: startDate } = getDateRangeForWeek(year, week);
  const startDt = new Date(startDate);
  const sourceTexts: string[] = [];
  let sourceCount = 0;
  const skipped: string[] = [];
  const allTags = new Set<string>();

  for (let i = 0; i < 7; i++) {
    const date = new Date(startDt);
    date.setDate(startDt.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    const dayFile = path.join(dayDir, `${dateStr}.json`);

    if (fs.existsSync(dayFile)) {
      const data = readJson(dayFile) as Record<string, unknown> | null;
      if (data && data.content) {
        sourceTexts.push(data.content as string);
        sourceCount++;
        const tags = (data.tags as string[]) || [];
        tags.forEach((t: string) => allTags.add(t));
      } else {
        skipped.push(`empty: ${dateStr}`);
      }
    } else {
      skipped.push(`missing: ${dateStr}`);
    }
  }

  if (sourceTexts.length === 0) {
    return {
      success: false,
      source_level: 'daily',
      target_level: 'weekly',
      source_count: 0,
      target_path: targetFile,
      summary_length: 0,
      key_facts: [],
      emotions: [],
      tags: [],
      skipped,
      error: 'no_source_data',
    };
  }

  // Summarize
  const { summary, key_facts, emotions } = summarizeTexts(sourceTexts, 500);

  // Write weekly summary
  const weekData = {
    type: 'weekly_summary',
    year,
    week,
    date_range: getDateRangeForWeek(year, week),
    content: summary,
    key_facts,
    emotions,
    tags: [...allTags].sort(),
    source_count: sourceCount,
    consolidation_status: 'complete',
    consolidated_at: new Date().toISOString(),
  };

  writeJson(targetFile, weekData);

  return {
    success: true,
    source_level: 'daily',
    target_level: 'weekly',
    source_count: sourceCount,
    target_path: targetFile,
    summary_length: summary.length,
    key_facts,
    emotions,
    tags: [...allTags].sort(),
    skipped,
  };
}

function consolidateWeeklyToMonthly(
  year: number,
  month: number,
  force: boolean = false
): ConsolidationResult {
  const weekDir = path.join(PROJECT_ROOT, 'data', 'memory', 'week');
  const monthDir = path.join(PROJECT_ROOT, 'data', 'memory', 'month');

  if (!fs.existsSync(monthDir)) {
    fs.mkdirSync(monthDir, { recursive: true });
  }

  const targetFile = path.join(monthDir, `${year}-${String(month).padStart(2, '0')}.json`);

  // Check if already consolidated
  if (!force && fs.existsSync(targetFile)) {
    const existing = readJson(targetFile) as Record<string, unknown> | null;
    if (existing && existing.consolidation_status === 'complete') {
      return {
        success: true,
        source_level: 'weekly',
        target_level: 'monthly',
        source_count: 0,
        target_path: targetFile,
        summary_length: 0,
        key_facts: [],
        emotions: [],
        tags: [],
        skipped: [`already consolidated: ${path.basename(targetFile)}`],
      };
    }
  }

  // Collect weekly summaries
  const sourceTexts: string[] = [];
  let sourceCount = 0;
  const skipped: string[] = [];
  const allTags = new Set<string>();

  // Get weeks that fall within this month
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);

  const weeks = new Set<number>();
  const current = new Date(firstDay);
  while (current <= lastDay) {
    const isoWeek = getISOWeek(current);
    weeks.add(isoWeek);
    current.setDate(current.getDate() + 1);
  }

  for (const week of weeks) {
    const weekFile = path.join(weekDir, `${year}-W${String(week).padStart(2, '0')}.json`);
    if (fs.existsSync(weekFile)) {
      const data = readJson(weekFile) as Record<string, unknown> | null;
      if (data && data.content) {
        sourceTexts.push(data.content as string);
        sourceCount++;
        const tags = (data.tags as string[]) || [];
        tags.forEach((t: string) => allTags.add(t));
      } else {
        skipped.push(`empty: W${String(week).padStart(2, '0')}`);
      }
    } else {
      skipped.push(`missing: W${String(week).padStart(2, '0')}`);
    }
  }

  // Fallback: try daily memories directly
  if (sourceTexts.length === 0) {
    const dayDir = path.join(PROJECT_ROOT, 'data', 'memory', 'day');
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayFile = path.join(dayDir, `${dateStr}.json`);
      if (fs.existsSync(dayFile)) {
        const data = readJson(dayFile) as Record<string, unknown> | null;
        if (data && data.content) {
          sourceTexts.push(data.content as string);
          sourceCount++;
          const tags = (data.tags as string[]) || [];
          tags.forEach((t: string) => allTags.add(t));
        }
      }
    }
  }

  if (sourceTexts.length === 0) {
    return {
      success: false,
      source_level: 'weekly',
      target_level: 'monthly',
      source_count: 0,
      target_path: targetFile,
      summary_length: 0,
      key_facts: [],
      emotions: [],
      tags: [],
      skipped,
      error: 'no_source_data',
    };
  }

  const { summary, key_facts, emotions } = summarizeTexts(sourceTexts, 800);

  const monthData = {
    type: 'monthly_summary',
    year,
    month,
    content: summary,
    key_facts,
    emotions,
    tags: [...allTags].sort(),
    source_count: sourceCount,
    consolidation_status: 'complete',
    consolidated_at: new Date().toISOString(),
  };

  writeJson(targetFile, monthData);

  return {
    success: true,
    source_level: 'weekly',
    target_level: 'monthly',
    source_count: sourceCount,
    target_path: targetFile,
    summary_length: summary.length,
    key_facts,
    emotions,
    tags: [...allTags].sort(),
    skipped,
  };
}

function consolidateMonthlyToYearly(
  year: number,
  force: boolean = false
): ConsolidationResult {
  const monthDir = path.join(PROJECT_ROOT, 'data', 'memory', 'month');
  const yearDir = path.join(PROJECT_ROOT, 'data', 'memory', 'year');

  if (!fs.existsSync(yearDir)) {
    fs.mkdirSync(yearDir, { recursive: true });
  }

  const targetFile = path.join(yearDir, `${year}.json`);

  // Check if already consolidated
  if (!force && fs.existsSync(targetFile)) {
    const existing = readJson(targetFile) as Record<string, unknown> | null;
    if (existing && existing.consolidation_status === 'complete') {
      return {
        success: true,
        source_level: 'monthly',
        target_level: 'yearly',
        source_count: 0,
        target_path: targetFile,
        summary_length: 0,
        key_facts: [],
        emotions: [],
        tags: [],
        skipped: [`already consolidated: ${path.basename(targetFile)}`],
      };
    }
  }

  const sourceTexts: string[] = [];
  let sourceCount = 0;
  const skipped: string[] = [];
  const allTags = new Set<string>();

  for (let m = 1; m <= 12; m++) {
    const monthFile = path.join(monthDir, `${year}-${String(m).padStart(2, '0')}.json`);
    if (fs.existsSync(monthFile)) {
      const data = readJson(monthFile) as Record<string, unknown> | null;
      if (data && data.content) {
        sourceTexts.push(data.content as string);
        sourceCount++;
        const tags = (data.tags as string[]) || [];
        tags.forEach((t: string) => allTags.add(t));
      } else {
        skipped.push(`empty: ${String(m).padStart(2, '0')}`);
      }
    } else {
      skipped.push(`missing: ${String(m).padStart(2, '0')}`);
    }
  }

  if (sourceTexts.length === 0) {
    return {
      success: false,
      source_level: 'monthly',
      target_level: 'yearly',
      source_count: 0,
      target_path: targetFile,
      summary_length: 0,
      key_facts: [],
      emotions: [],
      tags: [],
      skipped,
      error: 'no_source_data',
    };
  }

  const { summary, key_facts, emotions } = summarizeTexts(sourceTexts, 1200);

  const yearData = {
    type: 'yearly_summary',
    year,
    content: summary,
    key_facts,
    emotions,
    tags: [...allTags].sort(),
    source_count: sourceCount,
    consolidation_status: 'complete',
    consolidated_at: new Date().toISOString(),
  };

  writeJson(targetFile, yearData);

  return {
    success: true,
    source_level: 'monthly',
    target_level: 'yearly',
    source_count: sourceCount,
    target_path: targetFile,
    summary_length: summary.length,
    key_facts,
    emotions,
    tags: [...allTags].sort(),
    skipped,
  };
}

/**
 * Get ISO week number for a date
 */
function getISOWeek(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const yearStart = new Date(d.getFullYear(), 0, 4);
  const weekNumber = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNumber;
}

// ============================================================================
// MCP Tool Schemas & Handlers
// ============================================================================

/**
 * Consolidate daily memories into weekly summary
 */
export const ConsolidateDailyToWeeklySchema = z.object({
  year: z.number().int().optional().describe('Year (default: current year)'),
  week: z.number().int().min(1).max(53).optional().describe('ISO week number (default: last week)'),
  force: z.boolean().optional().default(false).describe('Force re-consolidation even if already done'),
});

export async function handleConsolidateDailyToWeekly(
  params: z.infer<typeof ConsolidateDailyToWeeklySchema>
): Promise<ToolResponse> {
  try {
    const now = new Date();
    const year = params.year ?? now.getFullYear();
    // Default to last week
    const lastWeek = new Date(now);
    lastWeek.setDate(now.getDate() - 7);
    const week = params.week ?? getISOWeek(lastWeek);

    const result = consolidateDailyToWeekly(year, week, params.force);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
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
 * Consolidate weekly summaries into monthly summary
 */
export const ConsolidateWeeklyToMonthlySchema = z.object({
  year: z.number().int().optional().describe('Year (default: current year)'),
  month: z.number().int().min(1).max(12).optional().describe('Month (default: last month)'),
  force: z.boolean().optional().default(false).describe('Force re-consolidation'),
});

export async function handleConsolidateWeeklyToMonthly(
  params: z.infer<typeof ConsolidateWeeklyToMonthlySchema>
): Promise<ToolResponse> {
  try {
    const now = new Date();
    const year = params.year ?? now.getFullYear();
    const month = params.month ?? (now.getMonth() === 0 ? 12 : now.getMonth());

    const result = consolidateWeeklyToMonthly(year, month, params.force);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
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
 * Consolidate monthly summaries into yearly summary
 */
export const ConsolidateMonthlyToYearlySchema = z.object({
  year: z.number().int().optional().describe('Year (default: last year)'),
  force: z.boolean().optional().default(false).describe('Force re-consolidation'),
});

export async function handleConsolidateMonthlyToYearly(
  params: z.infer<typeof ConsolidateMonthlyToYearlySchema>
): Promise<ToolResponse> {
  try {
    const now = new Date();
    const year = params.year ?? (now.getFullYear() - 1);

    const result = consolidateMonthlyToYearly(year, params.force);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
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
