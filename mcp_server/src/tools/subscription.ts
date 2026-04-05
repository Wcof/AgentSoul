/**
 * @fileoverview 订阅推送工具
 * @description 该模块处理 MCP 灵魂订阅推送机制，支持注册 Webhook 订阅特定事件
 */

import { z } from 'zod';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { Subscription, SubscriptionEvent, ToolResponse, AgentSoulConfig } from '../types.js';
import { safePath, readJson, writeJson } from '../lib/utils.js';
import { PROJECT_ROOT } from '../lib/paths.js';
import { getLanguageResources } from '../language/index.js';

/** 订阅存储文件路径 */
const SUBSCRIPTIONS_PATH = safePath(
  PROJECT_ROOT + '/data/subscriptions/subscriptions.json',
  PROJECT_ROOT
);

/**
 * 读取所有订阅
 * @returns 订阅数组
 */
function readSubscriptions(): Subscription[] {
  if (!SUBSCRIPTIONS_PATH) {
    return [];
  }
  const result = readJson<Subscription[]>(SUBSCRIPTIONS_PATH);
  return result || [];
}

/**
 * 写入所有订阅
 * @param subscriptions - 订阅数组
 * @returns 是否写入成功
 */
function writeSubscriptions(subscriptions: Subscription[]): boolean {
  if (!SUBSCRIPTIONS_PATH) {
    return false;
  }
  return writeJson(SUBSCRIPTIONS_PATH, subscriptions);
}

/**
 * 生成唯一订阅 ID
 * @returns 唯一 ID
 */
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

/** 订阅事件Schema - 允许 'all' 和特定事件 */
const ALLOWED_EVENTS: SubscriptionEvent[] = [
  'all',
  'memory_written',
  'memory_archived',
  'soul_state_updated',
  'persona_updated',
];

/** 创建订阅的输入参数 Schema */
export const SubscribeSchema = z.object({
  /** Webhook URL 回调地址 */
  url: z.string().url(),
  /** 要订阅的事件列表，如果不传订阅所有事件 */
  events: z.array(z.enum(ALLOWED_EVENTS as [string, ...string[]])).optional(),
  /** 可选的密钥，会在回调时作为 X-Webhook-Secret 请求头发送 */
  secret: z.string().optional(),
  /** 最大失败次数后自动取消订阅，默认 5 */
  max_failures: z.number().int().min(1).max(100).optional(),
});

/** 取消订阅的输入参数 Schema */
export const UnsubscribeSchema = z.object({
  /** 要取消的订阅 ID */
  subscription_id: z.string(),
});

/** 列出所有订阅的输入参数 Schema */
export const ListSubscriptionsSchema = z.object({});

/**
 * 创建新订阅
 * @param params - 创建参数
 * @returns 创建结果
 */
export async function handleSubscribe(
  params: z.infer<typeof SubscribeSchema>
): Promise<ToolResponse> {
  const events = (params.events || ['all']) as SubscriptionEvent[];
  const secret = params.secret || null;
  const maxFailures = params.max_failures || 5;

  const subscription: Subscription = {
    id: generateId(),
    url: params.url,
    events,
    createdAt: new Date().toISOString(),
    lastCalled: null,
    failureCount: 0,
    maxFailures,
    secret,
  };

  const subscriptions = readSubscriptions();
  subscriptions.push(subscription);
  const success = writeSubscriptions(subscriptions);

  if (!success) {
    throw new McpError(ErrorCode.InternalError, 'Failed to save subscription');
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          success: true,
          subscription,
          total_subscriptions: subscriptions.length,
        }, null, 2),
      },
    ],
  };
}

/**
 * 取消订阅
 * @param params - 取消参数
 * @returns 取消结果
 */
export async function handleUnsubscribe(
  params: z.infer<typeof UnsubscribeSchema>
): Promise<ToolResponse> {
  const subscriptions = readSubscriptions();
  const initialLength = subscriptions.length;
  const filtered = subscriptions.filter(s => s.id !== params.subscription_id);

  if (filtered.length === initialLength) {
    throw new McpError(ErrorCode.InvalidRequest, `Subscription ${params.subscription_id} not found`);
  }

  const success = writeSubscriptions(filtered);
  if (!success) {
    throw new McpError(ErrorCode.InternalError, 'Failed to save subscriptions after unsubscribe');
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          success: true,
          removed_id: params.subscription_id,
          remaining_subscriptions: filtered.length,
        }, null, 2),
      },
    ],
  };
}

/**
 * 列出所有当前订阅
 * @returns 订阅列表
 */
export async function handleListSubscriptions(): Promise<ToolResponse> {
  const subscriptions = readSubscriptions();
  const lang = getLanguageResources();

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          count: subscriptions.length,
          subscriptions: subscriptions.map(function(s) {
            return {
              id: s.id,
              url: s.url,
              events: s.events,
              created_at: s.createdAt,
              last_called: s.lastCalled,
              failure_count: s.failureCount,
            };
          }),
        }, null, 2),
      },
    ],
  };
}

/**
 * 触发推送事件 - 调用所有匹配的订阅 webhook
 * @param event - 事件类型
 * @param payload - 事件数据 payload
 */
export async function triggerEvent(event: SubscriptionEvent, payload: unknown): Promise<void> {
  const subscriptions = readSubscriptions();
  if (subscriptions.length === 0) {
    return;
  }

  // 匹配订阅：包含 'all' 或包含该事件
  const matching = subscriptions.filter(s =>
    s.events.includes('all') || s.events.includes(event)
  );

  if (matching.length === 0) {
    return;
  }

  // Get config for timeout
  const timeoutMs = getConfigTimeout();

  // Trigger all matching webhooks in parallel
  const promises = matching.map(async (sub) => {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (sub.secret) {
        headers['X-Webhook-Secret'] = sub.secret;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(sub.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          event,
          subscription_id: sub.id,
          timestamp: new Date().toISOString(),
          payload,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Update last called and reset failure count on success
      if (response.ok) {
        sub.lastCalled = new Date().toISOString();
        sub.failureCount = 0;
      } else {
        sub.failureCount++;
        console.error(`[AgentSoul Subscription] Webhook failed for ${sub.id}: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      sub.failureCount++;
      console.error(`[AgentSoul Subscription] Webhook error for ${sub.id}:`, error);
    }

    // Auto-unsubscribe if max failures reached
    if (sub.failureCount >= sub.maxFailures) {
      console.error(`[AgentSoul Subscription] Auto-unsubscribing ${sub.id} after ${sub.failureCount} failures`);
      const current = readSubscriptions();
      const filtered = current.filter(s => s.id !== sub.id);
      writeSubscriptions(filtered);
    }
  });

  // Update subscriptions in storage with failure counts and lastCalled
  await Promise.allSettled(promises);
  writeSubscriptions(subscriptions);
}

/**
 * 缓存的配置超时
 */
let cachedTimeout: number | null = null;

/**
 * 获取配置的超时
 */
function getConfigTimeout(): number {
  const defaultTimeout = 5000;
  if (cachedTimeout !== null) {
    return cachedTimeout;
  }
  try {
    const configPath = PROJECT_ROOT + '/config/agentsoul.json';
    const checkedPath = safePath(configPath, PROJECT_ROOT);
    if (!checkedPath) {
      cachedTimeout = defaultTimeout;
      return defaultTimeout;
    }
    const config = readJson<AgentSoulConfig>(checkedPath);
    if (config && config.subscription && config.subscription.enabled) {
      cachedTimeout = config.subscription.timeoutMs || defaultTimeout;
      return cachedTimeout;
    }
    cachedTimeout = defaultTimeout;
    return defaultTimeout;
  } catch {
    cachedTimeout = defaultTimeout;
    return defaultTimeout;
  }
}
