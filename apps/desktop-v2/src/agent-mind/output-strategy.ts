/**
 * Output Strategy — determines how the companion communicates based on
 * User Presence × Companion Mode × Event Priority.
 *
 * Strategies:
 * - silent: no visible output
 * - queue: buffer output for later delivery
 * - express: show via bubble/surface
 * - interrupt: force notification even during conversation
 */

export type OutputStrategyKind = "silent" | "queue" | "express" | "interrupt";

export interface OutputStrategyInput {
  userPresence: string;
  companionMode: string;
  eventPriority: string;
}

export function resolveOutputStrategy(input: OutputStrategyInput): OutputStrategyKind {
  if (input.eventPriority === "CRITICAL") return "interrupt";
  if (input.userPresence === "OFFLINE" || input.userPresence === "AWAY") return "queue";
  if (input.companionMode === "SLEEPING") return "silent";
  if (input.companionMode === "CONVERSING") {
    return input.eventPriority === "HIGH" ? "interrupt" : "silent";
  }
  return "express";
}
