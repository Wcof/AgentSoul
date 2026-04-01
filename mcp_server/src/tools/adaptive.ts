/**
 * @fileoverview 自适应学习工具模块
 * @description 提供用户偏好学习和 PAD 情感状态自适应调整功能
 */

import { z } from 'zod';
import { StorageManager } from '../storage.js';
import { ToolResponse } from '../types.js';
import { readJson, writeJson } from '../lib/utils.js';
import { PROJECT_ROOT } from '../lib/paths.js';
import path from 'path';

const storage = new StorageManager();

/**
 * 读取 JSON 文件工具函数
 */
const readJsonFile = readJson;

/**
 * 写入 JSON 文件工具函数
 */
const writeJsonFile = writeJson;

/**
 * 获取学习偏好 Schema
 */
export const GetLearningPreferencesSchema = z.object({});

/**
 * 获取学习偏好
 * @returns 当前学习偏好
 */
export async function handleGetLearningPreferences(): Promise<ToolResponse> {
  const dataPath = path.join(PROJECT_ROOT, 'data', 'learning', 'preferences.json');
  const preferences = readJsonFile(dataPath);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          success: true,
          data: preferences || {
            preferred_tone: null,
            preferred_response_length: null,
            preferred_emoji_freq: null,
            preferred_topics: [],
            learning_confidence: 0,
          },
        }),
      },
    ],
  };
}

/**
 * 提交反馈 Schema
 */
export const SubmitFeedbackSchema = z.object({
  /** 反馈类型: positive, negative, neutral */
  feedback: z.enum(['positive', 'negative', 'neutral']),
  /** 调整前 PAD 值 */
  pad_before: z.object({
    pleasure: z.number(),
    arousal: z.number(),
    dominance: z.number(),
  }).optional(),
  /** 调整后 PAD 值 */
  pad_after: z.object({
    pleasure: z.number(),
    arousal: z.number(),
    dominance: z.number(),
  }).optional(),
  /** 响应长度 */
  response_length: z.number().optional(),
  /** 涉及主题 */
  topics: z.array(z.string()).optional(),
  /** 用户输入 */
  user_input: z.string().optional(),
  /** Agent 响应 */
  agent_response: z.string().optional(),
});

/**
 * 提交反馈进行学习
 * @param params 反馈参数
 * @returns 提交结果
 */
export async function handleSubmitFeedback(
  params: z.infer<typeof SubmitFeedbackSchema>
): Promise<ToolResponse> {
  try {
    const dataPath = path.join(PROJECT_ROOT, 'data', 'learning');
    const sessionsPath = path.join(dataPath, 'interactions.json');
    const sessions = readJsonFile(sessionsPath) || [];
    const sessionId = `session_${Date.now()}`;

    const record = {
      session_id: sessionId,
      timestamp: new Date().toISOString(),
      pad_before: params.pad_before || { pleasure: 0.3, arousal: 0.2, dominance: 0.3 },
      pad_after: params.pad_after || { pleasure: 0.3, arousal: 0.2, dominance: 0.3 },
      feedback: params.feedback,
      response_length: params.response_length,
      topics: params.topics,
      user_input: params.user_input,
      agent_response: params.agent_response,
    };

    (sessions as unknown[]).push(record);
    const success = writeJsonFile(sessionsPath, sessions);

    if (success) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: '反馈提交成功，学习系统已更新',
              data: { session_id: sessionId },
            }),
          },
        ],
      };
    } else {
      throw new Error('Failed to write interaction data');
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: (error as Error).message,
          }),
        },
      ],
    };
  }
}

/**
 * 重置学习数据 Schema
 */
export const ResetLearningSchema = z.object({});

/**
 * 重置学习数据到默认值
 * @returns 重置结果
 */
export async function handleResetLearning(): Promise<ToolResponse> {
  try {
    const dataPath = path.join(PROJECT_ROOT, 'data', 'learning');
    const interactionsPath = path.join(dataPath, 'interactions.json');
    const preferencesPath = path.join(dataPath, 'preferences.json');

    writeJsonFile(interactionsPath, []);
    writeJsonFile(preferencesPath, {});

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: '学习数据已重置为默认值',
          }),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: (error as Error).message,
          }),
        },
      ],
    };
  }
}

/**
 * 设置学习强度 Schema
 */
export const SetLearningIntensitySchema = z.object({
  /** 学习强度 (0-1) */
  intensity: z.number().min(0).max(1),
});

/**
 * 设置学习强度
 * @param params 参数包含 intensity
 * @returns 设置结果
 */
export async function handleSetLearningIntensity(
  params: z.infer<typeof SetLearningIntensitySchema>
): Promise<ToolResponse> {
  try {
    const settingsPath = path.join(PROJECT_ROOT, 'data', 'learning', 'settings.json');
    const settings = readJsonFile(settingsPath) || {};

    (settings as Record<string, unknown>).learning_intensity = params.intensity;
    writeJsonFile(settingsPath, settings);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: `学习强度已设置为 ${params.intensity}`,
          }),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: (error as Error).message,
          }),
        },
      ],
    };
  }
}

/**
 * 获取交互统计 Schema
 */
export const GetInteractionStatisticsSchema = z.object({});

/**
 * 获取交互统计信息
 * @returns 统计数据
 */
export async function handleGetInteractionStatistics(): Promise<ToolResponse> {
  try {
    const dataPath = path.join(PROJECT_ROOT, 'data', 'learning');
    const sessionsPath = path.join(dataPath, 'interactions.json');
    const sessions = readJsonFile(sessionsPath) || [];

    const sessionsArray = sessions as unknown[];
    const stats = {
      total_interactions: sessionsArray.length,
      positive_feedback: sessionsArray.filter((s: any) => s.feedback === 'positive').length,
      negative_feedback: sessionsArray.filter((s: any) => s.feedback === 'negative').length,
      neutral_feedback: sessionsArray.filter((s: any) => s.feedback === 'neutral').length,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            data: stats,
          }),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: (error as Error).message,
          }),
        },
      ],
    };
  }
}
