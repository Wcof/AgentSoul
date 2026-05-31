import { randomUUID } from "node:crypto";
import {
  createDefaultAutonomyState,
  decideAutonomousActions,
  type AutonomousAction,
  type AutonomyDecision,
  type CompanionEventPriority,
  type CompanionMode,
  type CompanionOutputStrategy,
  type PerceptionEvent,
  type UserPresenceState,
} from "@agentsoul/companion";

export interface CompanionAutonomySnapshot {
  userPresence: UserPresenceState;
  companionMode: CompanionMode;
  lastEventPriority?: CompanionEventPriority;
  lastOutputStrategy?: CompanionOutputStrategy;
  queuedOutputCount: number;
  lastAction?: string;
  cooldownUntil?: string;
}

export interface AutonomousLoopOptions {
  clock?: () => Date;
  tickIntervalMs?: number;
  onDecision?: (decision: AutonomyDecision) => void;
}

export interface AutonomousLoopService {
  getSnapshot(): CompanionAutonomySnapshot;
  processEvent(event: PerceptionEvent): AutonomyDecision;
  tick(now?: Date): AutonomyDecision;
  updatePresence(presence: UserPresenceState): CompanionAutonomySnapshot;
  updateMode(mode: CompanionMode): CompanionAutonomySnapshot;
  drainQueuedOutputs(): AutonomousAction[];
  close(): void;
}

export function createAutonomousLoopService(options: AutonomousLoopOptions = {}): AutonomousLoopService {
  const clock = options.clock ?? (() => new Date());
  let state = createDefaultAutonomyState(clock());
  let lastEventPriority: CompanionEventPriority | undefined;
  let lastOutputStrategy: CompanionOutputStrategy | undefined;
  let lastAction: string | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;

  function snapshot(): CompanionAutonomySnapshot {
    return {
      userPresence: state.userPresence,
      companionMode: state.companionMode,
      lastEventPriority,
      lastOutputStrategy,
      queuedOutputCount: state.queuedOutputs.length,
      lastAction,
      cooldownUntil: state.cooldownUntil,
    };
  }

  function processEvent(event: PerceptionEvent): AutonomyDecision {
    const decision = decideAutonomousActions(state, event, clock());
    state = decision.nextState;
    lastEventPriority = event.priority;
    lastOutputStrategy = latestOutputStrategy(decision.actions);
    lastAction = decision.actions.at(-1)?.name;
    options.onDecision?.(decision);
    return decision;
  }

  const service: AutonomousLoopService = {
    getSnapshot: snapshot,
    processEvent,
    tick(now = clock()) {
      return processEvent({
        id: randomUUID(),
        source: "time",
        priority: "LOW",
        description: "周期时间感知：检查状态、冷却和待处理记忆",
        observedAt: now.toISOString(),
      });
    },
    updatePresence(presence) {
      state = { ...state, userPresence: presence };
      return snapshot();
    },
    updateMode(mode) {
      state = { ...state, companionMode: mode };
      return snapshot();
    },
    drainQueuedOutputs() {
      const actions = [...state.queuedOutputs];
      state = {
        ...state,
        companionMode: state.companionMode === "QUEUING" ? "AUTONOMOUS" : state.companionMode,
        queuedOutputs: [],
      };
      return actions;
    },
    close() {
      if (timer) {
        clearInterval(timer);
        timer = undefined;
      }
    },
  };

  if (options.tickIntervalMs && options.tickIntervalMs > 0) {
    timer = setInterval(() => service.tick(), options.tickIntervalMs);
    timer.unref?.();
  }

  return service;
}

function latestOutputStrategy(actions: AutonomousAction[]): CompanionOutputStrategy | undefined {
  for (let index = actions.length - 1; index >= 0; index -= 1) {
    if (actions[index].kind === "communicative") {
      return actions[index].outputStrategy;
    }
  }
  return actions.at(-1)?.outputStrategy;
}
