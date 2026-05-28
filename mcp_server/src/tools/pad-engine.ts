/**
 * @fileoverview PAD 引擎增强工具模块
 * @description 基于增强 PAD 引擎的 MCP 工具，支持事件扰动、漂移检测和能量指标
 *
 * 对应 Python 模块: src/adaptive_learning/pad_engine.py
 */

import { z } from 'zod';
import { ToolResponse } from '../types.js';
import { PROJECT_ROOT } from '../lib/paths.js';
import { readJson, writeJson } from '../lib/utils.js';
import path from 'path';
import fs from 'fs';

// ============================================================================
// Types
// ============================================================================

type DriftSeverity = 'none' | 'mild' | 'moderate' | 'severe';
type EventType = 'positive' | 'negative' | 'neutral' | 'surprise' | 'stress' | 'relaxation' | 'conflict';

interface PADEnhancedState {
  pleasure: number;
  arousal: number;
  dominance: number;
  energy: number;
  last_updated: string | null;
  baseline_pleasure: number;
  baseline_arousal: number;
  baseline_dominance: number;
  baseline_energy: number;
  total_interactions: number;
  total_events: number;
  last_interaction_at: string | null;
  emotion_history: Array<Record<string, unknown>>;
  recent_event_types: string[];
  resilience_hours: number;
  resilience_samples: number;
}

interface DriftReport {
  severity: DriftSeverity;
  pleasure_drift: number;
  arousal_drift: number;
  dominance_drift: number;
  energy_drift: number;
  max_drift: number;
  recommendation: string;
  emotion_profile: string;
}

// ============================================================================
// Event Impact Profiles (matching Python)
// ============================================================================

const EVENT_PROFILES: Record<EventType, { pleasure: number; arousal: number; dominance: number; energy: number }> = {
  positive:    { pleasure: 0.15, arousal: 0.08, dominance: 0.05, energy: -0.03 },
  negative:    { pleasure: -0.15, arousal: -0.08, dominance: -0.05, energy: -0.08 },
  neutral:     { pleasure: 0.0, arousal: 0.0, dominance: 0.0, energy: 0.0 },
  surprise:    { pleasure: 0.05, arousal: 0.20, dominance: -0.03, energy: -0.05 },
  stress:      { pleasure: -0.10, arousal: 0.15, dominance: -0.10, energy: -0.12 },
  relaxation:  { pleasure: 0.08, arousal: -0.15, dominance: 0.03, energy: 0.10 },
  conflict:    { pleasure: -0.12, arousal: 0.10, dominance: -0.08, energy: -0.10 },
};

// ============================================================================
// PADEngineTS
// ============================================================================

class PADEngineTS {
  private statePath: string;
  private learningIntensity: number;

  // Drift thresholds
  private driftMild = 0.3;
  private driftModerate = 0.5;
  private driftSevere = 0.7;

  // Energy parameters
  private energyInteractionCost = 0.02;
  private energyRecoveryPerHour = 0.08;
  private energyMinForArousal = 0.2;

  // Decay rate
  private decayRatePerHour = 0.05;

  constructor() {
    this.statePath = path.join(PROJECT_ROOT, 'data', 'soul', 'pad_engine_state.json');
    this.learningIntensity = 0.3;
  }

  private loadState(): PADEnhancedState {
    const data = readJson(this.statePath) as PADEnhancedState | null;
    if (!data) {
      return {
        pleasure: 0.3,
        arousal: 0.2,
        dominance: 0.3,
        energy: 0.8,
        last_updated: null,
        baseline_pleasure: 0.3,
        baseline_arousal: 0.2,
        baseline_dominance: 0.3,
        baseline_energy: 0.8,
        total_interactions: 0,
        total_events: 0,
        last_interaction_at: null,
        emotion_history: [],
        recent_event_types: [],
        resilience_hours: 0,
        resilience_samples: 0,
      };
    }
    // Ensure new fields exist on loaded state
    if (!data.emotion_history) data.emotion_history = [];
    if (!data.recent_event_types) data.recent_event_types = [];
    if (data.resilience_hours === undefined) data.resilience_hours = 0;
    if (data.resilience_samples === undefined) data.resilience_samples = 0;
    return data;
  }

  private saveState(state: PADEnhancedState): void {
    const dir = path.dirname(this.statePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    writeJson(this.statePath, state);
  }

  private clamp(val: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, val));
  }

  private applyTimeDecay(state: PADEnhancedState): PADEnhancedState {
    if (!state.last_updated) return state;

    const now = new Date();
    const lastUpdated = new Date(state.last_updated);
    const elapsedMs = now.getTime() - lastUpdated.getTime();
    const elapsedHours = elapsedMs / (1000 * 60 * 60);

    if (elapsedHours < 0.1) return state;

    const decayFactor = Math.min(1.0, this.decayRatePerHour * elapsedHours);

    state.pleasure += (state.baseline_pleasure - state.pleasure) * decayFactor;
    state.arousal += (state.baseline_arousal - state.arousal) * decayFactor;
    state.dominance += (state.baseline_dominance - state.dominance) * decayFactor;

    // Energy recovery
    if (state.energy < state.baseline_energy) {
      const recovery = this.energyRecoveryPerHour * elapsedHours;
      state.energy = Math.min(state.baseline_energy, state.energy + recovery);
    }

    state.pleasure = this.clamp(state.pleasure, -1, 1);
    state.arousal = this.clamp(state.arousal, -1, 1);
    state.dominance = this.clamp(state.dominance, -1, 1);
    state.energy = this.clamp(state.energy, 0, 1);

    return state;
  }

  private detectDrift(state: PADEnhancedState): DriftReport {
    const pDrift = Math.abs(state.pleasure - state.baseline_pleasure);
    const aDrift = Math.abs(state.arousal - state.baseline_arousal);
    const dDrift = Math.abs(state.dominance - state.baseline_dominance);
    const eDrift = Math.abs(state.energy - state.baseline_energy);
    const maxDrift = Math.max(pDrift, aDrift, dDrift, eDrift);

    let severity: DriftSeverity;
    let recommendation: string;

    if (maxDrift >= this.driftSevere) {
      severity = 'severe';
      recommendation = '人格漂移严重：建议回顾近期交互，考虑重置或调整基线';
    } else if (maxDrift >= this.driftModerate) {
      severity = 'moderate';
      recommendation = '人格漂移中度：关注情感走向，必要时可通过放松事件回归';
    } else if (maxDrift >= this.driftMild) {
      severity = 'mild';
      recommendation = '人格漂移轻微：正常范围，时间衰减会自然回归';
    } else {
      severity = 'none';
      recommendation = '人格稳定，无漂移';
    }

    return {
      severity,
      pleasure_drift: pDrift,
      arousal_drift: aDrift,
      dominance_drift: dDrift,
      energy_drift: eDrift,
      max_drift: maxDrift,
      recommendation,
      emotion_profile: this.classifyEmotionProfile(state.pleasure, state.arousal, state.dominance),
    };
  }

  private classifyEmotionProfile(pleasure: number, arousal: number, dominance: number): string {
    const pPos = pleasure > 0.1;
    const aPos = arousal > 0.1;
    if (pPos && aPos) return 'excited';
    if (pPos && !aPos) return 'relaxed';
    if (!pPos && aPos) return 'anxious';
    if (!pPos && !aPos) return 'depressed';
    return 'neutral';
  }

  private computeResonanceBoost(state: PADEnhancedState, eventType: EventType): number {
    const resonanceWindow = 5;
    const boostFactor = 0.25;
    const recent = state.recent_event_types.slice(-resonanceWindow);
    const sameCount = recent.filter(t => t === eventType).length;
    if (sameCount <= 0) return 1.0;
    return 1.0 + sameCount * boostFactor;
  }

  private recordEmotionSnapshot(state: PADEnhancedState, trigger: string): void {
    const sampleIntervalMinutes = 5;
    const maxHistory = 100;
    const now = new Date();

    if (state.emotion_history.length > 0) {
      const lastTs = state.emotion_history[state.emotion_history.length - 1]?.ts as string | undefined;
      if (lastTs) {
        const lastTime = new Date(lastTs);
        if ((now.getTime() - lastTime.getTime()) < sampleIntervalMinutes * 60 * 1000) {
          return; // Too soon
        }
      }
    }

    state.emotion_history.push({
      ts: now.toISOString(),
      p: Math.round(state.pleasure * 1000) / 1000,
      a: Math.round(state.arousal * 1000) / 1000,
      d: Math.round(state.dominance * 1000) / 1000,
      e: Math.round(state.energy * 1000) / 1000,
      trigger,
    });

    if (state.emotion_history.length > maxHistory) {
      state.emotion_history = state.emotion_history.slice(-maxHistory);
    }
  }

  getSummary(): Record<string, unknown> {
    let state = this.loadState();
    state = this.applyTimeDecay(state);
    const drift = this.detectDrift(state);

    return {
      current: {
        pleasure: Math.round(state.pleasure * 1000) / 1000,
        arousal: Math.round(state.arousal * 1000) / 1000,
        dominance: Math.round(state.dominance * 1000) / 1000,
        energy: Math.round(state.energy * 1000) / 1000,
      },
      baseline: {
        pleasure: Math.round(state.baseline_pleasure * 1000) / 1000,
        arousal: Math.round(state.baseline_arousal * 1000) / 1000,
        dominance: Math.round(state.baseline_dominance * 1000) / 1000,
        energy: Math.round(state.baseline_energy * 1000) / 1000,
      },
      drift: {
        severity: drift.severity,
        max_drift: Math.round(drift.max_drift * 1000) / 1000,
        emotion_profile: drift.emotion_profile,
        recommendation: drift.recommendation,
      },
      resilience: {
        avg_recovery_hours: Math.round(state.resilience_hours * 100) / 100,
        samples: state.resilience_samples,
      },
      resonance: {
        recent_events: state.recent_event_types.slice(-5),
      },
      history: {
        snapshot_count: state.emotion_history.length,
        latest: state.emotion_history[state.emotion_history.length - 1] || null,
      },
      stats: {
        total_interactions: state.total_interactions,
        total_events: state.total_events,
        learning_intensity: this.learningIntensity,
      },
    };
  }

  applyEvent(eventType: EventType, intensity: number = 1.0, description: string = ''): Record<string, unknown> {
    let state = this.loadState();
    state = this.applyTimeDecay(state);

    const profile = EVENT_PROFILES[eventType] || EVENT_PROFILES.neutral;
    const clampedIntensity = this.clamp(intensity, 0, 2);

    // Resonance boost: consecutive same-type events amplify
    const resonanceBoost = this.computeResonanceBoost(state, eventType);
    const effectiveIntensity = clampedIntensity * resonanceBoost;

    const deltaP = profile.pleasure * this.learningIntensity * effectiveIntensity;
    const deltaA = profile.arousal * this.learningIntensity * effectiveIntensity;
    const deltaD = profile.dominance * this.learningIntensity * effectiveIntensity;
    const deltaE = profile.energy * effectiveIntensity;

    const oldP = state.pleasure;
    const oldA = state.arousal;
    const oldD = state.dominance;
    const oldE = state.energy;

    state.pleasure = this.clamp(state.pleasure + deltaP, -1, 1);
    state.arousal = this.clamp(state.arousal + deltaA, -1, 1);
    state.dominance = this.clamp(state.dominance + deltaD, -1, 1);
    state.energy = this.clamp(state.energy + deltaE, 0, 1);

    // Low energy limits arousal
    if (state.energy < this.energyMinForArousal) {
      state.arousal = Math.min(state.arousal, 0.1);
    }

    state.total_events += 1;
    state.last_updated = new Date().toISOString();

    // Track event type for resonance
    state.recent_event_types.push(eventType);
    if (state.recent_event_types.length > 5) {
      state.recent_event_types = state.recent_event_types.slice(-5);
    }

    // Record emotion snapshot
    this.recordEmotionSnapshot(state, `event:${eventType}`);

    this.saveState(state);

    if (!description) {
      description = `Event: ${eventType} (intensity=${clampedIntensity.toFixed(1)})`;
    }

    return {
      success: true,
      event_type: eventType,
      intensity: clampedIntensity,
      description,
      delta: {
        pleasure: Math.round((state.pleasure - oldP) * 1000) / 1000,
        arousal: Math.round((state.arousal - oldA) * 1000) / 1000,
        dominance: Math.round((state.dominance - oldD) * 1000) / 1000,
        energy: Math.round((state.energy - oldE) * 1000) / 1000,
      },
      new_state: {
        pleasure: Math.round(state.pleasure * 1000) / 1000,
        arousal: Math.round(state.arousal * 1000) / 1000,
        dominance: Math.round(state.dominance * 1000) / 1000,
        energy: Math.round(state.energy * 1000) / 1000,
      },
    };
  }

  detectPersonalityDrift(): Record<string, unknown> {
    let state = this.loadState();
    state = this.applyTimeDecay(state);
    const drift = this.detectDrift(state);

    return {
      severity: drift.severity,
      pleasure_drift: Math.round(drift.pleasure_drift * 1000) / 1000,
      arousal_drift: Math.round(drift.arousal_drift * 1000) / 1000,
      dominance_drift: Math.round(drift.dominance_drift * 1000) / 1000,
      energy_drift: Math.round(drift.energy_drift * 1000) / 1000,
      max_drift: Math.round(drift.max_drift * 1000) / 1000,
      emotion_profile: drift.emotion_profile,
      recommendation: drift.recommendation,
    };
  }

  reset(): Record<string, unknown> {
    let state = this.loadState();
    state.pleasure = state.baseline_pleasure;
    state.arousal = state.baseline_arousal;
    state.dominance = state.baseline_dominance;
    state.energy = state.baseline_energy;
    state.last_updated = new Date().toISOString();
    state.last_interaction_at = new Date().toISOString();

    this.saveState(state);

    return {
      success: true,
      message: 'PAD state reset to baseline',
      state: {
        pleasure: Math.round(state.pleasure * 1000) / 1000,
        arousal: Math.round(state.arousal * 1000) / 1000,
        dominance: Math.round(state.dominance * 1000) / 1000,
        energy: Math.round(state.energy * 1000) / 1000,
      },
    };
  }
}

// Singleton
const padEngine = new PADEngineTS();

// ============================================================================
// MCP Tool Schemas & Handlers
// ============================================================================

/**
 * Get PAD Engine Summary (including energy and drift)
 */
export const PadEngineSummarySchema = z.object({});

export async function handlePadEngineSummary(): Promise<ToolResponse> {
  try {
    const summary = padEngine.getSummary();
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          ...summary,
        }),
      }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: (error as Error).message,
        }),
      }],
    };
  }
}

/**
 * Apply an emotional event perturbation
 */
export const PadApplyEventSchema = z.object({
  event_type: z.enum(['positive', 'negative', 'neutral', 'surprise', 'stress', 'relaxation', 'conflict']).describe('Type of emotional event'),
  intensity: z.number().min(0).max(2).optional().default(1.0).describe('Event intensity [0.0, 2.0]'),
  description: z.string().optional().default('').describe('Description of the event'),
});

export async function handlePadApplyEvent(
  params: z.infer<typeof PadApplyEventSchema>
): Promise<ToolResponse> {
  try {
    const result = padEngine.applyEvent(params.event_type, params.intensity, params.description);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result),
      }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: (error as Error).message,
        }),
      }],
    };
  }
}

/**
 * Detect personality drift
 */
export const PadDetectDriftSchema = z.object({});

export async function handlePadDetectDrift(): Promise<ToolResponse> {
  try {
    const drift = padEngine.detectPersonalityDrift();
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          ...drift,
        }),
      }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: (error as Error).message,
        }),
      }],
    };
  }
}

/**
 * Reset PAD state to baseline
 */
export const PadResetSchema = z.object({});

export async function handlePadReset(): Promise<ToolResponse> {
  try {
    const result = padEngine.reset();
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result),
      }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: (error as Error).message,
        }),
      }],
    };
  }
}
