/**
 * Long-term Memory — layered memory store for the companion.
 *
 * Memory layers: day / week / month / year / topic
 * Supports: priority levels, tags, semantic search, deduplication.
 *
 * The Memory package (@agentsoul/memory) provides the core implementation.
 * This module re-exports the app-level interface.
 */

export {
  applyMasterModelCommand as applyMemoryCommand,
} from "@agentsoul/memory";
export type {
  MasterModel as MemoryMasterModel,
} from "@agentsoul/companion/soul";
