/**
 * @fileoverview 项目看板工具模块
 * @description 提供项目看板和工作记录相关的 MCP 工具，包括看板读取、摘要更新、决策记录、文件申领、工作状态设置以及工作记录列表查询等功能
 */

import { z } from 'zod';
import { SoulEngine } from '../lib/soul-engine.js';
import config from '../lib/config.js';
import type { ToolResponse } from '../types.js';

/** 读取看板输入参数模式 */
const BoardReadSchema = z.object({
  /** 项目名称 */
  project: z.string(),
});

/** 更新看板摘要输入参数模式 */
const BoardUpdateSummarySchema = z.object({
  /** 项目名称 */
  project: z.string(),
  /** 新的摘要内容 */
  summary: z.string(),
  /** 执行操作的 Agent */
  agent: z.string(),
});

/** 添加决策记录输入参数模式 */
const BoardAddDecisionSchema = z.object({
  /** 项目名称 */
  project: z.string(),
  /** 决策内容 */
  decision: z.string(),
  /** 决策原因（可选） */
  why: z.string().optional(),
  /** 执行操作的 Agent */
  agent: z.string(),
});

/** 申领文件输入参数模式 */
const BoardClaimFileSchema = z.object({
  /** 项目名称 */
  project: z.string(),
  /** 文件路径 */
  file_path: z.string(),
  /** 执行操作的 Agent */
  agent: z.string(),
  /** 申领意图 */
  intent: z.string(),
});

/** 释放文件输入参数模式 */
const BoardReleaseFileSchema = z.object({
  /** 项目名称 */
  project: z.string(),
  /** 执行操作的 Agent */
  agent: z.string(),
});

/** 设置当前工作输入参数模式 */
const BoardSetActiveWorkSchema = z.object({
  /** 项目名称 */
  project: z.string(),
  /** 执行操作的 Agent */
  agent: z.string(),
  /** 当前任务描述 */
  task: z.string(),
  /** 相关文件列表（可选） */
  files: z.array(z.string()).optional(),
});

/** 列出工作记录输入参数模式 */
const LedgerListSchema = z.object({
  /** 项目名称 */
  project: z.string(),
  /** 开始日期（可选） */
  start_date: z.string().optional(),
  /** 结束日期（可选） */
  end_date: z.string().optional(),
});

/** 读取工作记录输入参数模式 */
const LedgerReadSchema = z.object({
  /** 项目名称 */
  project: z.string(),
  /** 记录条目 ID */
  entry_id: z.string(),
});

/** 添加项目标签输入参数模式 */
const BoardAddLabelsSchema = z.object({
  /** 项目名称 */
  project: z.string(),
  /** 标签数组 */
  labels: z.array(z.string()),
});

/** 删除项目标签输入参数模式 */
const BoardRemoveLabelsSchema = z.object({
  /** 项目名称 */
  project: z.string(),
  /** 标签数组 */
  labels: z.array(z.string()),
});

/** 列出项目标签输入参数模式 */
const BoardListLabelsSchema = z.object({
  /** 项目名称 */
  project: z.string(),
});

/** 按标签搜索决策输入参数模式 */
const BoardSearchDecisionsSchema = z.object({
  /** 项目名称 */
  project: z.string(),
  /** 标签数组 - 返回匹配任一标签的决策 */
  labels: z.array(z.string()),
});

/** 读取看板输入类型 */
type BoardReadInput = z.infer<typeof BoardReadSchema>;
/** 更新看板摘要输入类型 */
type BoardUpdateSummaryInput = z.infer<typeof BoardUpdateSummarySchema>;
/** 添加决策输入类型 */
type BoardAddDecisionInput = z.infer<typeof BoardAddDecisionSchema>;
/** 申领文件输入类型 */
type BoardClaimFileInput = z.infer<typeof BoardClaimFileSchema>;
/** 释放文件输入类型 */
type BoardReleaseFileInput = z.infer<typeof BoardReleaseFileSchema>;
/** 设置当前工作输入类型 */
type BoardSetActiveWorkInput = z.infer<typeof BoardSetActiveWorkSchema>;
/** 列出工作记录输入类型 */
type LedgerListInput = z.infer<typeof LedgerListSchema>;
/** 读取工作记录输入类型 */
type LedgerReadInput = z.infer<typeof LedgerReadSchema>;

/** SoulEngine 单例实例 */
let _soulEngine: SoulEngine | null = null;

/**
 * 获取 SoulEngine 单例实例
 * @returns SoulEngine 实例
 */
function getSoulEngine(): SoulEngine {
  if (!_soulEngine) {
    _soulEngine = new SoulEngine(config.DATA_DIR);
  }
  return _soulEngine;
}

/**
 * 处理读取看板请求
 * @param input - 包含项目名称的输入参数
 * @returns 看板内容的工具响应
 */
export async function handleBoardRead(input: BoardReadInput): Promise<ToolResponse> {
  const engine = getSoulEngine();
  const board = engine.readBoard(input.project);
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(board),
    }],
  };
}

/**
 * 处理更新看板摘要请求
 * @param input - 包含项目名称、新摘要和 Agent 的输入参数
 * @returns 更新结果的工具响应
 */
export async function handleBoardUpdateSummary(input: BoardUpdateSummaryInput): Promise<ToolResponse> {
  const engine = getSoulEngine();
  const board = engine.readBoard(input.project);
  board.state.summary = input.summary;
  engine.writeBoard(input.project, board);
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ updated: true }),
    }],
  };
}

/**
 * 处理添加决策记录请求
 * @param input - 包含项目名称、决策内容、原因和 Agent 的输入参数
 * @returns 添加结果的工具响应
 */
export async function handleBoardAddDecision(input: BoardAddDecisionInput): Promise<ToolResponse> {
  const engine = getSoulEngine();
  const board = engine.readBoard(input.project);
  const decision = {
    date: new Date().toISOString(),
    by: input.agent,
    what: input.decision,
    why: input.why || '',
  };
  board.state.decisions.push(decision);
  engine.writeBoard(input.project, board);
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ added: true }),
    }],
  };
}

/**
 * 处理申领文件请求
 * @param input - 包含项目名称、文件路径、Agent 和意图的输入参数
 * @returns 申领结果的工具响应
 */
export async function handleBoardClaimFile(input: BoardClaimFileInput): Promise<ToolResponse> {
  const engine = getSoulEngine();
  const result = engine.claimFile(input.project, input.file_path, input.agent, input.intent);
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(result),
    }],
  };
}

/**
 * 处理释放文件请求
 * @param input - 包含项目名称和 Agent 的输入参数
 * @returns 释放结果的工具响应
 */
export async function handleBoardReleaseFile(input: BoardReleaseFileInput): Promise<ToolResponse> {
  const engine = getSoulEngine();
  engine.releaseFiles(input.project, input.agent);
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ released: true }),
    }],
  };
}

/**
 * 处理设置当前工作请求
 * @param input - 包含项目名称、Agent、任务和文件列表的输入参数
 * @returns 更新结果的工具响应
 */
export async function handleBoardSetActiveWork(input: BoardSetActiveWorkInput): Promise<ToolResponse> {
  const engine = getSoulEngine();
  engine.setActiveWork(input.project, input.agent, input.task, input.files);
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ updated: true }),
    }],
  };
}

/**
 * 处理列出工作记录请求
 * @param input - 包含项目名称、开始日期和结束日期的输入参数
 * @returns 工作记录列表的工具响应
 */
export async function handleLedgerList(input: LedgerListInput): Promise<ToolResponse> {
  const engine = getSoulEngine();
  const entries = engine.listLedgerEntries(input.project, input.start_date, input.end_date);
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ entries }),
    }],
  };
}

/**
 * 处理读取工作记录请求（尚未实现）
 * @param input - 包含项目名称和记录 ID 的输入参数
 * @returns 错误信息的工具响应
 */
export async function handleLedgerRead(input: LedgerReadInput): Promise<ToolResponse> {
  const engine = getSoulEngine();
  const entry = engine.readLedgerEntry(input.project, input.entry_id);
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(entry),
    }],
  };
}

/**
 * 处理添加项目标签请求
 * @param input - 包含项目名称和标签数组的输入参数
 * @returns 添加结果的工具响应
 */
export async function handleBoardAddLabels(input: z.infer<typeof BoardAddLabelsSchema>): Promise<ToolResponse> {
  const engine = getSoulEngine();
  const added = engine.addLabels(input.project, input.labels);
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ added, success: added > 0 }),
    }],
  };
}

/**
 * 处理删除项目标签请求
 * @param input - 包含项目名称和标签数组的输入参数
 * @returns 删除结果的工具响应
 */
export async function handleBoardRemoveLabels(input: z.infer<typeof BoardRemoveLabelsSchema>): Promise<ToolResponse> {
  const engine = getSoulEngine();
  const removed = engine.removeLabels(input.project, input.labels);
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ removed, success: removed > 0 }),
    }],
  };
}

/**
 * 处理列出项目所有标签请求
 * @param input - 包含项目名称的输入参数
 * @returns 标签列表的工具响应
 */
export async function handleBoardListLabels(input: z.infer<typeof BoardListLabelsSchema>): Promise<ToolResponse> {
  const engine = getSoulEngine();
  const labels = engine.listLabels(input.project);
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ labels, count: labels.length }),
    }],
  };
}

/**
 * 处理按标签搜索决策请求
 * @param input - 包含项目名称和标签数组的输入参数
 * @returns 匹配决策列表的工具响应
 */
export async function handleBoardSearchDecisions(input: z.infer<typeof BoardSearchDecisionsSchema>): Promise<ToolResponse> {
  const engine = getSoulEngine();
  const decisions = engine.searchDecisionsByLabels(input.project, input.labels);
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ decisions, count: decisions.length }),
    }],
  };
}

export {
  BoardReadSchema,
  BoardUpdateSummarySchema,
  BoardAddDecisionSchema,
  BoardClaimFileSchema,
  BoardReleaseFileSchema,
  BoardSetActiveWorkSchema,
  LedgerListSchema,
  LedgerReadSchema,
  BoardAddLabelsSchema,
  BoardRemoveLabelsSchema,
  BoardListLabelsSchema,
  BoardSearchDecisionsSchema,
};
