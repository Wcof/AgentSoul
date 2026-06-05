import {
  getDefaultSoul,
} from "@agentsoul/companion/soul";
import type { MasterModel, MasterModelLearningStage } from "@agentsoul/companion/soul";
import { applyMasterModelCommand as applyPureMasterModelCommand } from "@agentsoul/memory";
import type { DesktopBodySnapshot } from "../types";

export type MasterModelEditAction =
  | { kind: "record"; claim: string; evidence: string[]; confidence: number }
  | { kind: "advance"; observationId: string; stage: MasterModelLearningStage }
  | { kind: "forget"; observationId: string };

export function applyMasterModelCommand(input: {
  snapshot: DesktopBodySnapshot;
  action: MasterModelEditAction;
}): DesktopBodySnapshot {
  const masterModel = input.snapshot.companion.masterModel ?? createDefaultMasterModelForSnapshot(input.snapshot);
  const nextMasterModel = applyPureMasterModelCommand(masterModel as MasterModel, input.action);
  return {
    ...input.snapshot,
    companion: {
      ...input.snapshot.companion,
      masterModel: nextMasterModel,
    },
  };
}

export const applyMasterModelEdit = applyMasterModelCommand;

export function createDefaultMasterModelForSnapshot(snapshot: DesktopBodySnapshot): MasterModel {
  const companion = snapshot.companion;
  return getDefaultSoul({
    id: companion.id,
    displayName: companion.displayName,
    soulId: companion.soulId,
    petAppearance: {
      kind: companion.petAppearance.kind,
      skin: companion.petAppearance.skin,
      outfit: companion.petAppearance.outfit,
      animationStyle: companion.petAppearance.animationStyle,
    },
    vitals: {
      level: companion.vitals.level,
      xp: companion.vitals.xp,
      companionEnergy: companion.vitals.companionEnergy as never,
      hunger: companion.vitals.hunger,
      intimacy: companion.vitals.intimacy as never,
    },
    mood: companion.mood as never,
  }, companion.petAppearance.displayName || companion.displayName).masterModel;
}

export type { MasterModelLearningStage };
