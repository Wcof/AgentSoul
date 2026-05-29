export interface PADState {
  pleasure: number;
  arousal: number;
  dominance: number;
  affectiveEnergy: number;
}

export type { PADBaseline } from "@agentsoul/domain";

// 7 种事件 profile 的扰动向量 [pleasure, arousal, dominance]
const EVENT_PROFILES: Record<string, [number, number, number]> = {
  positive: [0.15, 0.05, 0.05],
  negative: [-0.15, 0.05, -0.05],
  stress: [-0.05, 0.2, -0.1],
  surprise: [0.05, 0.15, -0.05],
  conflict: [-0.1, 0.1, -0.15],
  neutral: [0, 0, 0],
  custom: [0, 0, 0],
};

export function applyEventPerturbation(
  current: PADState,
  eventType: string,
  intensity: number,
): PADState {
  const profile = EVENT_PROFILES[eventType] ?? EVENT_PROFILES.neutral;
  return {
    pleasure: clampPad(current.pleasure + profile[0] * intensity),
    arousal: clampPad(current.arousal + profile[1] * intensity),
    dominance: clampPad(current.dominance + profile[2] * intensity),
    affectiveEnergy: current.affectiveEnergy,
  };
}

export interface ResonanceConfig {
  eventType: string;
  count: number;
  boostFactor: number;
  windowMs: number;
}

export function applyEmotionResonance(
  current: PADState,
  config: ResonanceConfig,
): PADState {
  const profile = EVENT_PROFILES[config.eventType] ?? EVENT_PROFILES.neutral;
  const amplifier = 1 + config.boostFactor * (config.count - 1);
  return {
    pleasure: clampPad(current.pleasure + profile[0] * (amplifier - 1)),
    arousal: clampPad(current.arousal + profile[1] * (amplifier - 1)),
    dominance: clampPad(current.dominance + profile[2] * (amplifier - 1)),
    affectiveEnergy: current.affectiveEnergy,
  };
}

export function nameEmotion(pleasure: number, arousal: number, dominance: number): string {
  const THRESHOLD = 0.15;
  const p = pleasure > THRESHOLD ? "+" : pleasure < -THRESHOLD ? "-" : "0";
  const a = arousal > THRESHOLD ? "+" : arousal < -THRESHOLD ? "-" : "0";
  const d = dominance > THRESHOLD ? "+" : dominance < -THRESHOLD ? "-" : "0";
  const key = `${p}${a}${d}`;
  const LABELS: Record<string, string> = {
    "+++": "excited_confident",
    "++-": "surprised_alert",
    "+-+": "relaxed_content",
    "+--": "neutral_calm",
    "-++": "angry_hostile",
    "-+-": "anxious_fearful",
    "--+": "bored_passive",
    "---": "melancholic_sad",
    "000": "neutral_calm",
    "+00": "relaxed_content",
    "-00": "melancholic_sad",
    "0+0": "surprised_alert",
    "0-0": "bored_passive",
    "00+": "excited_confident",
    "00-": "anxious_fearful",
  };
  return LABELS[key] ?? "neutral_calm";
}

export type DriftSeverity = "none" | "mild" | "moderate" | "severe";

export interface DriftReportV2 {
  severity: DriftSeverity;
  distance: number;
  currentPAD: { pleasure: number; arousal: number; dominance: number };
  baselinePAD: { pleasure: number; arousal: number; dominance: number };
  reportedAt: string;
}

export function detectDrift(
  current: PADState,
  baseline: { pleasure: number; arousal: number; dominance: number },
): DriftReportV2 {
  const distance = Math.sqrt(
    (current.pleasure - baseline.pleasure) ** 2 +
    (current.arousal - baseline.arousal) ** 2 +
    (current.dominance - baseline.dominance) ** 2,
  );
  const severity: DriftSeverity =
    distance < 0.2 ? "none" : distance < 0.4 ? "mild" : distance < 0.6 ? "moderate" : "severe";
  return {
    severity,
    distance,
    currentPAD: { pleasure: current.pleasure, arousal: current.arousal, dominance: current.dominance },
    baselinePAD: baseline,
    reportedAt: new Date().toISOString(),
  };
}

export function applyTimeDecay(
  current: PADState,
  baseline: { pleasure: number; arousal: number; dominance: number },
  elapsedHours: number,
  decayRate: number,
): PADState {
  const factor = 1 - Math.min(1, decayRate * elapsedHours);
  return {
    pleasure: current.pleasure * factor + baseline.pleasure * (1 - factor),
    arousal: current.arousal * factor + baseline.arousal * (1 - factor),
    dominance: current.dominance * factor + baseline.dominance * (1 - factor),
    affectiveEnergy: current.affectiveEnergy,
  };
}

export function updateBaseline(
  baseline: { pleasure: number; arousal: number; dominance: number },
  current: PADState,
  weight: number,
): { pleasure: number; arousal: number; dominance: number } {
  return {
    pleasure: baseline.pleasure * (1 - weight) + current.pleasure * weight,
    arousal: baseline.arousal * (1 - weight) + current.arousal * weight,
    dominance: baseline.dominance * (1 - weight) + current.dominance * weight,
  };
}

function clampPad(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

// ─── Config Management (Issue #80) ───

export type { Locale, PersonaSeed, EmotionLabel } from "@agentsoul/domain";

