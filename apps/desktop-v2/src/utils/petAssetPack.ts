import type {
  AssetValidationSnapshot,
  FrameRect,
  FrameSequence,
  PetAssetPackManifest,
  PetStateName,
} from "../types";
import { convertFileSrc } from "@tauri-apps/api/core";

const REQUIRED_STATES: PetStateName[] = ["idle", "blink", "happy", "attention", "sleep", "degraded"];

export interface NormalizedAssetPack {
  manifest: PetAssetPackManifest;
  states: Record<PetStateName, FrameSequence>;
  validation: AssetValidationSnapshot;
}

export function normalizePetAssetPack(
  raw: Partial<PetAssetPackManifest> | null | undefined,
  assetPackPath: string,
): NormalizedAssetPack {
  const messages: string[] = [];
  const manifest = normalizeManifest(raw, assetPackPath, messages);
  const states = normalizeStates(manifest, messages);
  const level: AssetValidationSnapshot["level"] = messages.length === 0
    ? "ok"
    : messages.some((m) => m.startsWith("error:"))
      ? "error"
      : "warning";

  return {
    manifest,
    states,
    validation: {
      level,
      messages,
    },
  };
}

export function resolveRenderableSpriteSrc(spritePath: string): string {
  const windowLike = typeof window !== "undefined" ? window : undefined;
  const converter = (globalThis as any)?.__TAURI__?.core?.convertFileSrc
    ?? (globalThis as any)?.__TAURI_INTERNALS__?.convertFileSrc
    ?? (windowLike as any)?.__TAURI_INTERNALS__?.convertFileSrc
    ?? convertFileSrc;
  if (typeof converter === "function" && isLocalAbsolutePath(spritePath)) {
    try {
      return converter(spritePath, "asset");
    } catch {
      return spritePath;
    }
  }
  return spritePath;
}

function normalizeManifest(
  raw: Partial<PetAssetPackManifest> | null | undefined,
  assetPackPath: string,
  messages: string[],
): PetAssetPackManifest {
  const safeId = nonEmpty(raw?.id) ?? "unknown-pack";
  const safeName = nonEmpty(raw?.displayName) ?? safeId;
  const safeSprite = nonEmpty(raw?.spritesheetPath) ?? "spritesheet.webp";
  const manifest: PetAssetPackManifest = {
    id: safeId,
    displayName: safeName,
    description: raw?.description,
    spritesheetPath: resolveSpritePath(assetPackPath, safeSprite),
    kind: nonEmpty(raw?.kind) ?? "custom",
    version: nonEmpty(raw?.version) ?? "codex-pet-v1",
    frame: raw?.frame,
    states: raw?.states,
    fps: typeof raw?.fps === "number" && raw.fps > 0 ? raw.fps : 8,
    chromaKey: nonEmpty(raw?.chromaKey),
    anchor: raw?.anchor,
  };

  if (!raw?.states) {
    messages.push("warning: states missing in pet.json, using fallback state map");
  }
  if (!nonEmpty(raw?.spritesheetPath)) {
    messages.push("warning: spritesheetPath missing in pet.json, using spritesheet.webp");
  }
  if (!raw?.frame) {
    messages.push("warning: frame config missing in pet.json, using guessed frame grid");
  }
  return manifest;
}

function normalizeStates(
  manifest: PetAssetPackManifest,
  messages: string[],
): Record<PetStateName, FrameSequence> {
  const guessedStates = guessStates(manifest.frame);
  const normalized = {} as Record<PetStateName, FrameSequence>;
  const declaredStates = manifest.states as Record<string, FrameSequence> | undefined;
  const defaultSource = declaredStates?.idle ?? declaredStates?.default;
  const missingStates: PetStateName[] = [];

  for (const state of REQUIRED_STATES) {
    const source = declaredStates?.[state];
    if (source) {
      normalized[state] = normalizeSequence(source, manifest.fps ?? 8, messages, state);
      continue;
    }
    missingStates.push(state);
    normalized[state] = defaultSource
      ? normalizeSequence(defaultSource, manifest.fps ?? 8, messages, state)
      : guessedStates[state];
  }

  if (missingStates.length > 0 && declaredStates) {
    const fallbackName = declaredStates?.idle ? "idle" : declaredStates?.default ? "default" : "guessed frame grid";
    messages.push(`warning: states ${missingStates.join(", ")} missing, fallback to ${fallbackName}`);
  }

  return normalized;
}

function normalizeSequence(
  source: FrameSequence,
  defaultFps: number,
  messages: string[],
  state: string,
): FrameSequence {
  const hasFrames = Array.isArray(source.frames) && source.frames.length > 0;
  const hasRects = Array.isArray(source.rects) && source.rects.length > 0;
  if (!hasFrames && !hasRects) {
    messages.push(`warning: state '${state}' has empty frame sequence, using frame 0`);
    return { frames: [0], loop: true, fps: defaultFps };
  }
  if (hasRects) {
    const safeRects = (source.rects ?? []).filter(validRect);
    if (safeRects.length === 0) {
      messages.push(`warning: state '${state}' has invalid rects, using frame 0`);
      return { frames: [0], loop: true, fps: defaultFps };
    }
    return {
      rects: safeRects,
      loop: source.loop !== false,
      fps: source.fps && source.fps > 0 ? source.fps : defaultFps,
    };
  }
  return {
    frames: dedupePositiveInts(source.frames ?? [0]),
    loop: source.loop !== false,
    fps: source.fps && source.fps > 0 ? source.fps : defaultFps,
  };
}

function guessStates(frame: PetAssetPackManifest["frame"]): Record<PetStateName, FrameSequence> {
  const frameCount = Math.max(24, frame?.count ?? 48);
  const slice = (start: number, end: number): number[] => {
    const list: number[] = [];
    for (let i = start; i < end && i < frameCount; i += 1) list.push(i);
    return list.length > 0 ? list : [0];
  };

  return {
    idle: { frames: slice(0, 6), loop: true, fps: 8 },
    blink: { frames: slice(6, 8), loop: true, fps: 6 },
    happy: { frames: slice(8, 14), loop: true, fps: 10 },
    attention: { frames: slice(14, 20), loop: true, fps: 9 },
    sleep: { frames: slice(20, 24), loop: true, fps: 5 },
    degraded: { frames: slice(0, 4), loop: true, fps: 4 },
  };
}

function resolveSpritePath(assetPackPath: string, spritePath: string): string {
  if (spritePath.startsWith("/")) {
    return spritePath;
  }
  const normalizedBase = assetPackPath.endsWith("/") ? assetPackPath.slice(0, -1) : assetPackPath;
  return `${normalizedBase}/${spritePath}`;
}

function isLocalAbsolutePath(path: string): boolean {
  return path.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(path);
}

function nonEmpty(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function dedupePositiveInts(values: number[]): number[] {
  const seen = new Set<number>();
  const result: number[] = [];
  for (const value of values) {
    if (!Number.isInteger(value) || value < 0 || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result.length > 0 ? result : [0];
}

function validRect(rect: FrameRect): boolean {
  return Number.isFinite(rect.x) && Number.isFinite(rect.y) && Number.isFinite(rect.w) && Number.isFinite(rect.h)
    && rect.w > 0 && rect.h > 0;
}
