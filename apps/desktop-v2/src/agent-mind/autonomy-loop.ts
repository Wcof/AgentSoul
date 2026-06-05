import type { DesktopBodySnapshot } from "../types";
import { resolveVisualState } from "../shared/utils";

export function projectAutonomyRuntime(input: {
  snapshot: DesktopBodySnapshot;
  status?: string;
}): {
  autonomy: NonNullable<DesktopBodySnapshot["companion"]["autonomy"]>;
  bubbleText: string;
  visualState: string;
  labels: {
    userPresence: string;
    companionMode: string;
    eventPriority: string;
    outputStrategy: string;
  };
} {
  const autonomy = normalizeAutonomySnapshot(input.snapshot.companion.autonomy);
  return {
    autonomy,
    bubbleText: buildProjectedBubbleText(input.snapshot, autonomy, input.status),
    visualState: buildProjectedVisualState(input.snapshot, autonomy),
    labels: {
      userPresence: presenceZh(autonomy.userPresence),
      companionMode: companionModeZh(autonomy.companionMode),
      eventPriority: priorityZh(autonomy.lastEventPriority ?? "LOW"),
      outputStrategy: outputStrategyZh(autonomy.lastOutputStrategy ?? "silent"),
    },
  };
}

export function normalizeAutonomySnapshot(
  autonomy: DesktopBodySnapshot["companion"]["autonomy"] | undefined,
): NonNullable<DesktopBodySnapshot["companion"]["autonomy"]> {
  return {
    userPresence: autonomy?.userPresence ?? "PRESENT",
    companionMode: autonomy?.companionMode ?? "AUTONOMOUS",
    lastEventPriority: autonomy?.lastEventPriority ?? "LOW",
    lastOutputStrategy: autonomy?.lastOutputStrategy ?? "silent",
    queuedOutputCount: autonomy?.queuedOutputCount ?? 0,
    lastAction: autonomy?.lastAction,
    cooldownUntil: autonomy?.cooldownUntil,
  };
}

function buildProjectedBubbleText(
  snapshot: DesktopBodySnapshot,
  autonomy: NonNullable<DesktopBodySnapshot["companion"]["autonomy"]>,
  status: string | undefined,
): string {
  if (status?.trim()) return status.trim();
  const companion = snapshot.companion;
  if (autonomy.companionMode === "QUEUING" && autonomy.queuedOutputCount > 0) {
    return `我有 ${autonomy.queuedOutputCount} 条想法排队，等你方便再说。`;
  }
  if (autonomy.companionMode === "THINKING") return "我在想这件事，马上回来。";
  if (autonomy.companionMode === "SLEEPING" || companion.mood === "sleeping") return "我先眯一会儿，有事轻轻叫我。";
  if (companion.summary && companion.summary !== "Local runtime pending") return companion.summary;
  if (companion.vitals.companionEnergy < 25) return "能量有点低，适合摸摸或休息。";
  return "我在桌面陪着你，可以直接和我说话。";
}

function buildProjectedVisualState(
  snapshot: DesktopBodySnapshot,
  autonomy: NonNullable<DesktopBodySnapshot["companion"]["autonomy"]>,
): string {
  if (autonomy.companionMode === "QUEUING" || autonomy.companionMode === "INTRUDING") return "attention";
  if (autonomy.companionMode === "SLEEPING") return "sleep";
  return snapshot.companion.activityState ?? resolveVisualState(snapshot);
}

function presenceZh(presence: string): string {
  return {
    ACTIVE: "正在交互",
    PRESENT: "在电脑前",
    IDLE: "短暂离开",
    AWAY: "长时间离开",
    OFFLINE: "应用关闭",
  }[presence] ?? presence;
}

function companionModeZh(mode: string): string {
  return {
    AUTONOMOUS: "自主",
    CONVERSING: "对话中",
    THINKING: "思考中",
    QUEUING: "等待输出",
    SLEEPING: "睡眠",
    INTRUDING: "主动打断",
  }[mode] ?? mode;
}

function outputStrategyZh(strategy: string): string {
  return {
    silent: "静默",
    queue: "排队",
    express: "表达",
    interrupt: "打断",
  }[strategy] ?? strategy;
}

function priorityZh(priority: string): string {
  return {
    LOW: "低",
    MEDIUM: "中",
    HIGH: "高",
    CRITICAL: "关键",
  }[priority] ?? priority;
}
