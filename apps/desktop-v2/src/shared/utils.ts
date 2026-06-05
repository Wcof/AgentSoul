/**
 * Shared utility functions extracted from renderers.ts
 * These are used across all areas and shared modules.
 */
import type {
  DesktopBodySnapshot,
  CompanionVisualState,
  CompanionInteractionKind,
} from "../types";
import i18nInstance from "../i18n";

export function t(key: string, fallback: string): string {
  // @ts-ignore
  const instance = typeof i18nInstance !== "undefined" ? i18nInstance : (typeof globalThis.i18nInstance !== "undefined" ? globalThis.i18nInstance : null);
  if (instance && typeof instance.t === "function") {
    return instance.t(key);
  }
  return fallback;
}

export function resolveVisualState(snapshot: DesktopBodySnapshot): CompanionVisualState {
  const { mood, vitals } = snapshot.companion;
  if (mood === "sleeping") return "sleep";
  if (mood === "fatigued" || vitals.companionEnergy < 20) return "fatigue";
  if (mood === "positive") return "positive";
  if (mood === "negative" || vitals.hunger < 20) return "attention";
  return "idle";
}

export function faceForState(state: CompanionVisualState): string {
  const faces: Record<CompanionVisualState, string> = {
    idle: "-",
    positive: "^",
    fatigue: ".",
    sleep: "z",
    attention: "!",
  };
  return faces[state];
}

export function labelForInteraction(kind: CompanionInteractionKind): string {
  const labels: Record<CompanionInteractionKind, string> = {
    feed: "Feed",
    play: "Play",
    pet: "Pet",
    sleep: "Sleep",
  };
  return labels[kind];
}

export function formatMix<T extends "provider" | "model">(
  values: Array<Record<T, string> & { percent: number }>,
  key: T,
): string {
  return values.map((value) => `${value[key]} ${value.percent}%`).join(", ");
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

export function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
