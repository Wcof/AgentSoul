/**
 * @fileoverview 多语言支持模块
 * @description 提供多语言资源加载和缓存功能，根据配置文件动态加载对应语言
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { PROJECT_ROOT } from '../lib/paths.js';
import { readFile } from '../lib/utils.js';
import { StorageManager } from '../storage.js';
import type { PersonaConfig } from '../types.js';

/**
 * 工具索引条目结构
 */
export interface ToolIndexEntry {
  name: string;
  description: string;
  parameters: string;
  whenToUse: string;
  required: boolean;
  example: string;
}

/**
 * 分类描述结构
 */
export interface CategoryIndex {
  category: string;
  description: string;
  tools: ToolIndexEntry[];
}

/**
 * 工具索引消息文本
 */
export interface ToolIndexMessages {
  purpose: string;
  important_instruction: string;
  how_to_call: string;
  tool_not_found: string;
  specific_tool_purpose: string;
  specific_tool_header: string;
  specific_tool_intro: string;
  specific_tool_payattention: string;
  specific_tool_usage: string;
}

/**
 * 语言资源结构
 */
export interface LanguageResources {
  language: string;
  startup_messages: Record<string, string>;
  tool_descriptions: Record<string, string>;
  categories: Record<string, string>;
  tool_index: Record<string, Omit<ToolIndexEntry, 'name'>>;
  usage_guide: string;
  tool_index_messages: ToolIndexMessages;
}

/**
 * 默认回退语言资源
 */
const FALLBACK_LANGUAGE: LanguageResources = {
  language: 'english',
  startup_messages: {},
  tool_descriptions: {},
  categories: {},
  tool_index: {},
  usage_guide: '',
  tool_index_messages: {
    purpose: 'AgentSoul MCP Tool Index - complete reference of all available tools',
    important_instruction: '',
    how_to_call: '',
    tool_not_found: 'Tool "%s" not found in AgentSoul MCP',
    specific_tool_purpose: 'AgentSoul MCP Tool Reference - Detailed information for tool: %s',
    specific_tool_header: 'YOU REQUESTED DETAILS FOR: %s',
    specific_tool_intro: 'This is the complete reference for this specific tool. Verify all information below BEFORE calling.',
    specific_tool_payattention: 'Pay close attention to:\n1. **parameters**: Exact parameter names and types\n2. **example**: Copy the pattern from the example - it shows correct format',
    specific_tool_usage: 'After verifying:\n- Use the exact name "%s" when calling\n- Use parameters exactly as documented in the "parameters" field\n- Copy the format from the "example" field\n\nIf you follow this, you will succeed.',
  },
};

/**
 * 缓存已加载的语言资源
 */
let cachedResources: LanguageResources | null = null;

/**
 * 解析语言文件路径
 * @param language - 语言名称 (chinese | english)
 * @returns 语言文件的绝对路径
 */
function getLanguageFilePath(language: string): string {
  return path.join(PROJECT_ROOT, 'apps', 'mcp-server', 'src', 'language', `${language}.yaml`);
}

/**
 * 加载并解析语言资源文件
 * @param language - 目标语言
 * @returns 解析后的语言资源，如果加载失败返回 null
 */
function loadLanguageFile(language: string): LanguageResources | null {
  const filePath = getLanguageFilePath(language);
  const content = readFile(filePath);
  if (content === null) {
    console.error(getStartupMessage('file_load_error', language, filePath));
    return null;
  }
  try {
    return yaml.load(content) as LanguageResources;
  } catch (e) {
    console.error(getStartupMessage('parse_error', filePath, String(e)));
    return null;
  }
}

/**
 * 从人格配置中获取语言设置
 * @returns 语言设置，默认为 'english'
 */
function getLanguageFromConfig(): string {
  const storage = new StorageManager();
  const config = storage.readPersonaConfig();
  const interactionStyle = config.ai.interaction_style;
  if (interactionStyle && typeof interactionStyle.language === 'string') {
    return interactionStyle.language;
  }
  return 'english';
}

/**
 * 初始化语言系统，加载对应语言资源
 * 应该在服务器启动时调用
 */
export function initLanguage(): LanguageResources {
  if (cachedResources !== null) {
    return cachedResources;
  }

  const language = getLanguageFromConfig();

  let resources = loadLanguageFile(language);
  if (resources === null) {
    // 如果目标语言加载失败，尝试回退到英语
    if (language !== 'english') {
      console.error(getStartupMessage('fallback_to_english'));
      resources = loadLanguageFile('english');
    }
    // 如果英语也加载失败，使用空回退
    if (resources === null) {
      console.error(getStartupMessage('critical_no_english'));
      resources = FALLBACK_LANGUAGE;
    }
  }

  // Only output debug info if debug mode enabled
  if (process.env.AGENTSOUL_DEBUG === '1') {
    console.error(getStartupMessage('language_initializing', language));
    console.error(getStartupMessage('language_loaded', language));
  }

  cachedResources = resources;
  return resources;
}

/**
 * 获取当前缓存的语言资源
 * 如果尚未初始化，会自动调用 initLanguage()
 */
export function getLanguageResources(): LanguageResources {
  if (cachedResources !== null) {
    return cachedResources;
  }
  return initLanguage();
}

/**
 * 获取工具描述，如果当前语言没有则回退到英语
 * @param toolName - 工具名称
 * @param fallback - 回退描述（英语原文）
 */
export function getToolDescription(toolName: string, fallback: string): string {
  const resources = getLanguageResources();
  const description = resources.tool_descriptions[toolName];
  return description ?? fallback;
}

// Precompile regex once at module load time (avoid recompiling on every call)
// Global flag 'g' needed to replace ALL placeholders (not just the first one)
const PLACEHOLDER_REGEX = /(%s|%d)/g;

// Fallback messages defined once at module load time (recreated every miss was inefficient)
const FALLBACK_MESSAGES: Record<string, string> = {
  paths_search_start: "[AgentSoul paths] Starting search from __dirname: %s",
  paths_checking: "[AgentSoul paths] Checking %s",
  paths_found: "[AgentSoul paths] Found config/persona.yaml at %s",
  paths_fallback1_candidate: "[AgentSoul paths] Fallback 1 candidate: %s, checking %s",
  paths_fallback1_found: "[AgentSoul paths] Found config in fallback 1: %s",
  paths_fallback2_candidate: "[AgentSoul paths] Fallback 2 candidate: %s, checking %s",
  paths_fallback2_found: "[AgentSoul paths] Found config in fallback 2: %s",
  paths_not_found: "[AgentSoul] WARNING: Could not find config/persona.yaml in any searched locations.",
  paths_fallback_cwd: "[AgentSoul] Falling back to working directory: %s",
  server_starting: "AgentSoul MCP Server starting...",
  project_root: "- PROJECT_ROOT: %s",
  working_dir: "- Working directory: %s",
  language_initializing: "[AgentSoul Language] Initializing for language: %s",
  language_loaded: "[AgentSoul Language] Loaded: %s",
  tools_cached: "[AgentSoul MCP] Tools cached: %d tools",
  fallback_to_english: "[AgentSoul Language] Falling back to English",
  critical_no_english: "[AgentSoul Language] CRITICAL: Could not load English language file, using empty fallback",
  server_running: "AgentSoul MCP Server running on stdio",
  file_load_error: "[AgentSoul Language] WARNING: Could not load language file for %s at %s",
  parse_error: "[AgentSoul Language] ERROR: Failed to parse YAML from %s: %s",
};

/**
 * 获取启动消息，支持占位符替换
 * @param key - 消息键
 * @param args - 占位符参数（%s -> 字符串, %d -> 数字）
 *
 * NOTE: During initial language loading, this function uses hardcoded fallback
 * messages directly to avoid infinite recursion since cachedResources isn't set yet.
 */
export function getStartupMessage(key: string, ...args: (string | number)[]): string {
  // If cachedResources is not initialized yet (during initial load error reporting),
  // skip getLanguageResources() and go straight to fallback to prevent infinite recursion.
  // This fixes the recursion issue when loadLanguageFile() is called from initLanguage()
  // before cachedResources is set.
  let message: string | undefined;
  if (cachedResources !== null) {
    message = cachedResources.startup_messages?.[key];
  }

  if (!message) {
    message = FALLBACK_MESSAGES[key] ?? key;
  }

  // Replace placeholders: %s for string, %d for number
  let result = message;
  args.forEach(arg => {
    result = result.replace(PLACEHOLDER_REGEX, String(arg));
  });
  return result;
}

/**
 * 重新加载语言资源（用于配置变更后）
 */
export function reloadLanguage(): LanguageResources {
  cachedResources = null;
  return initLanguage();
}

export default {
  initLanguage,
  getLanguageResources,
  getToolDescription,
  getStartupMessage,
  reloadLanguage,
};
