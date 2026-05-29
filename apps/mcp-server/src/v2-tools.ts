/**
 * @fileoverview v2 packages 工具集成
 * @description 使用 v2 TypeScript packages 实现 MCP 工具
 */

import { createCompanionRuntime } from "@agentsoul/runtime";
import { createMemoryStore } from "@agentsoul/memory";
import { createEntityStore } from "@agentsoul/entity";
import { createSemanticStore, createMockEmbedding } from "@agentsoul/semantic";
import { createUserManagedExportService } from "@agentsoul/export";
import { createHealthChecker } from "@agentsoul/runtime";

export interface V2ToolsOptions {
  dbPath: string;
  clock?: () => Date;
}

export function createV2Tools(options: V2ToolsOptions) {
  const runtime = createCompanionRuntime({ dbPath: options.dbPath });
  const memory = createMemoryStore({ dbPath: options.dbPath });
  const entity = createEntityStore({ dbPath: options.dbPath });
  const embedding = createMockEmbedding();
  const semantic = createSemanticStore({ dbPath: options.dbPath, embedding });
  const exportService = createUserManagedExportService({ 
    dbPath: options.dbPath,
    clock: options.clock,
  });
  const healthChecker = createHealthChecker({ 
    dbPath: options.dbPath,
    clock: options.clock,
  });

  return {
    // Companion 状态查询
    getCompanionState: () => {
      const state = runtime.getCompanionRuntimeState();
      return {
        id: state.companion.id,
        displayName: state.companion.displayName,
        mood: state.companion.mood,
        vitals: state.companion.vitals,
        petAppearance: state.companion.petAppearance,
      };
    },

    // Companion 交互
    performInteraction: (kind: "feed" | "play" | "pet" | "sleep") => {
      const result = runtime.performCompanionInteraction(kind);
      return {
        outcome: result.outcome,
        state: {
          id: result.state.companion.id,
          mood: result.state.companion.mood,
          vitals: result.state.companion.vitals,
        },
      };
    },

    // 记忆写入
    writeMemory: (params: {
      layer: "day" | "week" | "month" | "year" | "topic";
      content: string;
      tags?: string[];
      priority?: "low" | "medium" | "high";
    }) => {
      return memory.write({
        layer: params.layer,
        content: params.content,
        tags: params.tags || [],
        priority: params.priority || "medium",
      });
    },

    // 记忆查询
    queryMemory: (params: {
      layer?: string;
      tags?: string[];
    }) => {
      return memory.query({
        layer: params.layer as any,
        tags: params.tags,
      });
    },

    // 实体管理
    createEntity: (params: {
      name: string;
      type: string;
    }) => {
      return entity.createEntity(params.name, params.type as any);
    },

    getEntity: (id: string) => {
      return entity.getEntity(id);
    },

    findEntitiesByName: (name: string) => {
      return entity.findByName(name);
    },

    // 技能管理
    getInstalledSkillPacks: () => {
      const state = runtime.getCompanionRuntimeState();
      return state.skills.installedSkillPacks;
    },

    getProjectActivations: (projectPath: string) => {
      const state = runtime.getCompanionRuntimeState();
      return state.skills.projectActivations.filter(
        (a) => a.skillPackId.startsWith(projectPath)
      );
    },

    // 会话搜索
    searchSessions: (query: string) => {
      const state = runtime.getCompanionRuntimeState();
      return state.sessions.workSessions.filter(
        (s) => 
          s.evidenceSummary?.includes(query) ||
          s.projectPath.includes(query) ||
          s.client.includes(query)
      );
    },

    // 安全审批
    getApprovalRequests: () => {
      const state = runtime.getCompanionRuntimeState();
      return state.safety.approvalRequests;
    },

    // 数据导出
    createPortableExport: () => {
      return exportService.createPortableDataExport();
    },

    createExportManifest: (kind: "portable" | "sensitive") => {
      return exportService.createExportManifest(kind);
    },

    // 健康检查
    runHealthCheck: () => {
      return healthChecker.runHealthCheck();
    },

    generateCompanionshipReport: () => {
      return healthChecker.generateCompanionshipReport();
    },

    // 关闭资源
    close: () => {
      runtime.close();
      memory.close();
      entity.close();
      semantic.close();
      exportService.close();
    },
  };
}
