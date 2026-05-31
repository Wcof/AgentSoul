export type UserPresenceState = "ACTIVE" | "PRESENT" | "IDLE" | "AWAY" | "OFFLINE";
export type CompanionMode = "AUTONOMOUS" | "CONVERSING" | "THINKING" | "QUEUING" | "SLEEPING" | "INTRUDING";
export type CompanionEventPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type CompanionOutputStrategy = "silent" | "queue" | "express" | "interrupt";
export type AutonomousActionKind = "internal" | "communicative" | "tool";

export interface CompanionAutonomyState {
  userPresence: UserPresenceState;
  companionMode: CompanionMode;
  cooldownUntil?: string;
  queuedOutputs: AutonomousAction[];
}

export interface PerceptionEvent {
  id: string;
  source: "time" | "memory" | "conversation" | "system";
  priority: CompanionEventPriority;
  description: string;
  observedAt: string;
}

export interface AutonomousAction {
  kind: AutonomousActionKind;
  name: string;
  description: string;
  priority: CompanionEventPriority;
  outputStrategy: CompanionOutputStrategy;
}

export interface AutonomyDecision {
  nextState: CompanionAutonomyState;
  actions: AutonomousAction[];
}

export function createDefaultAutonomyState(now: Date = new Date()): CompanionAutonomyState {
  return {
    userPresence: "PRESENT",
    companionMode: "AUTONOMOUS",
    cooldownUntil: new Date(now.getTime() + 30_000).toISOString(),
    queuedOutputs: [],
  };
}

export function decideAutonomousActions(
  state: CompanionAutonomyState,
  event: PerceptionEvent,
  now: Date = new Date(),
): AutonomyDecision {
  const outputStrategy = decideOutputStrategy(state, event.priority, now);
  const actions: AutonomousAction[] = [
    {
      kind: "internal",
      name: "reflect-and-update-affect",
      description: `根据感知事件更新 PAD、体征和记忆线索：${event.description}`,
      priority: event.priority,
      outputStrategy: "silent",
    },
  ];

  if (event.source === "memory" || event.priority === "HIGH" || event.priority === "CRITICAL") {
    actions.push({
      kind: "communicative",
      name: "surface-memory-or-status",
      description: `根据事件向主人表达状态或联想：${event.description}`,
      priority: event.priority,
      outputStrategy,
    });
  }

  const nextState = applyOutputStrategy(state, actions, outputStrategy);
  return { nextState, actions };
}

export function decideOutputStrategy(
  state: CompanionAutonomyState,
  priority: CompanionEventPriority,
  now: Date = new Date(),
): CompanionOutputStrategy {
  if (state.companionMode === "SLEEPING" || state.userPresence === "OFFLINE") return "silent";
  if (state.companionMode === "CONVERSING" || state.companionMode === "THINKING") {
    return priority === "CRITICAL" || priority === "HIGH" ? "interrupt" : "queue";
  }
  if (isCoolingDown(state, now) && priority !== "HIGH" && priority !== "CRITICAL") return "queue";
  if (state.userPresence === "AWAY" && priority !== "CRITICAL") return "queue";
  if (priority === "LOW") return "silent";
  return "express";
}

function applyOutputStrategy(
  state: CompanionAutonomyState,
  actions: AutonomousAction[],
  strategy: CompanionOutputStrategy,
): CompanionAutonomyState {
  const communicative = actions.filter((action) => action.kind === "communicative");
  if (strategy === "queue") {
    if (communicative.length === 0) return state;
    return {
      ...state,
      companionMode: "QUEUING",
      queuedOutputs: [...state.queuedOutputs, ...communicative],
    };
  }
  if (strategy === "interrupt") {
    return {
      ...state,
      companionMode: "INTRUDING",
    };
  }
  if (strategy === "express") {
    return {
      ...state,
      companionMode: "AUTONOMOUS",
    };
  }
  return state;
}

function isCoolingDown(state: CompanionAutonomyState, now: Date): boolean {
  if (!state.cooldownUntil) return false;
  const cooldownTime = Date.parse(state.cooldownUntil);
  return Number.isFinite(cooldownTime) && cooldownTime > now.getTime();
}
