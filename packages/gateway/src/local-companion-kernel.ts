import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { MemoryEntry as StoredMemoryEntry, MemoryStore } from "@agentsoul/memory";
import type { SkillSourceStore } from "@agentsoul/skills";
import type { MemoryEntry } from "@agentsoul/companion";
import {
  runConversation,
  type AgentLoopMemoryProvider,
  type AgentLoopOptions,
  type AgentLoopResult,
  type AgentLoopSkillProvider,
  type DirectCaller,
} from "./agent-loop";

export interface LocalCompanionKernelOptions {
  memoryStore: Pick<MemoryStore, "query" | "write">;
  skillStore: Pick<SkillSourceStore, "listSkillPacks" | "getEffectiveSkillActivation">;
  directCaller: DirectCaller;
  projectPath?: string;
  maxMemories?: number;
  compression?: AgentLoopOptions["compression"];
}

export interface LocalCompanionKernel {
  runConversation(
    userMessage: string,
    history: Array<{ role: string; content: string }>,
    sessionId?: string,
  ): Promise<AgentLoopResult>;
  memoryProvider: AgentLoopMemoryProvider;
  skillProvider: AgentLoopSkillProvider;
}

export function createLocalCompanionKernel(options: LocalCompanionKernelOptions): LocalCompanionKernel {
  const projectPath = options.projectPath ?? "";
  const memoryProvider = createLocalMemoryProvider(options.memoryStore, options.maxMemories ?? 8);
  const skillProvider = createLocalSkillProvider(options.skillStore, projectPath);

  return {
    memoryProvider,
    skillProvider,
    runConversation(userMessage, history, sessionId) {
      return runConversation(userMessage, history, {
        directCaller: options.directCaller,
        memoryProvider,
        skillProvider,
        sessionId,
        compression: options.compression ?? {
          maxCharacters: 12_000,
          preserveRecentMessages: 8,
        },
      });
    },
  };
}

function createLocalMemoryProvider(
  memoryStore: Pick<MemoryStore, "query" | "write">,
  maxMemories: number,
): AgentLoopMemoryProvider {
  return {
    prefetch(query) {
      return recallMemories(memoryStore, query, maxMemories);
    },
    recall(query) {
      return recallMemories(memoryStore, query, maxMemories);
    },
    syncTurn(userContent, assistantContent) {
      memoryStore.write({
        layer: "day",
        content: `主人：${userContent}\n伴侣：${assistantContent}`,
        priority: "medium",
        tags: keywords(userContent),
      });
    },
  };
}

function recallMemories(
  memoryStore: Pick<MemoryStore, "query">,
  query: string,
  maxMemories: number,
): MemoryEntry[] {
  const queryKeywords = keywords(query);
  return memoryStore
    .query({})
    .map((entry) => ({ entry, score: memoryScore(entry, queryKeywords) }))
    .sort((left, right) => right.score - left.score || right.entry.updatedAt.localeCompare(left.entry.updatedAt))
    .slice(0, maxMemories)
    .map(({ entry }) => ({ text: entry.content }));
}

function memoryScore(entry: StoredMemoryEntry, queryKeywords: string[]): number {
  const haystack = `${entry.content} ${entry.tags.join(" ")}`.toLowerCase();
  const keywordMatches = queryKeywords.filter((keyword) => haystack.includes(keyword.toLowerCase())).length;
  const priorityScore = entry.priority === "high" ? 3 : entry.priority === "medium" ? 2 : 1;
  return keywordMatches * 10 + priorityScore;
}

function keywords(value: string): string[] {
  return [...new Set(value
    .split(/[\s,，。！？、:：;；]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2))];
}

function createLocalSkillProvider(
  skillStore: Pick<SkillSourceStore, "listSkillPacks" | "getEffectiveSkillActivation">,
  projectPath: string,
): AgentLoopSkillProvider {
  return {
    getPromptBlock() {
      const enabledSkills = skillStore.listSkillPacks().filter((skill) => {
        if (projectPath) {
          return skillStore.getEffectiveSkillActivation({
            projectPath,
            skillPackId: skill.id,
          }).enabled;
        }
        return skill.globalDefaultEnabled;
      });
      const blocks = enabledSkills
        .map((skill) => readSkillMarkdown(skill.source.uri))
        .filter((content): content is string => Boolean(content));

      return blocks.length > 0 ? `## 已启用 SKILL.md\n${blocks.join("\n\n")}` : "";
    },
  };
}

function readSkillMarkdown(directory: string): string | undefined {
  const path = join(directory, "SKILL.md");
  return existsSync(path) ? readFileSync(path, "utf8") : undefined;
}
