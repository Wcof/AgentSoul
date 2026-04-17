/**
 * @fileoverview Entity Memory - Structured entity tracking
 * @description Track structured entities: people, hardware, projects, concepts, places, services
 */

import fs from 'fs';
import path from 'path';
import { safePath, sanitizeTopicName, logWAL } from './utils.js';
import { DATA_ROOT } from './paths.js';

/**
 * Entity types supported
 */
export type EntityType =
  | 'person'      // People (contacts, users, team members)
  | 'project'     // Projects (software, tasks, initiatives)
  | 'hardware'    // Physical devices (computers, servers, peripherals)
  | 'software'    // Software applications, libraries, services
  | 'place'       // Physical or virtual locations
  | 'concept'     // Abstract concepts, ideas, domains
  | 'service'     // Web services, APIs, external services
  | 'other';      // Everything else

/**
 * A single temporal fact - each fact has validity information
 */
export interface EntityFact {
  /** The fact value */
  value: string;
  /** When this fact became valid (unix timestamp ms) */
  valid_from: number;
  /** When this fact stopped being valid (unix timestamp ms) - null means currently valid */
  valid_to: number | null;
  /** Confidence score 0-1 (how confident we are that this fact is correct) */
  confidence: number;
  /** Source reference - where this fact came from (e.g., memory topic, date, verbatim ID) */
  source_ref: string | null;
}

/**
 * A single structured entity
 */
export interface Entity {
  /** Primary name/identifier of the entity */
  name: string;
  /** Type of entity */
  type: EntityType;
  /** Description of what this entity is */
  description: string;
  /** Alternative names/aliases */
  aliases: string[];
  /** Key-value attributes storing structured data - each attribute can have multiple temporal facts */
  attributes: Record<string, EntityFact[]>;
  /** When this entity was first created (unix timestamp ms) */
  created_at: number;
  /** When this entity was last mentioned/updated (unix timestamp ms) */
  updated_at: number;
  /** When this entity was last accessed (unix timestamp ms) */
  accessed_at: number;
  /** Tags for categorization */
  tags: string[];
}

/**
 * Entity storage format
 */
interface EntityStorage {
  entities: Record<string, Entity>;
  version: number;
}

/**
 * Default empty entity storage - created once at module load
 */
const DEFAULT_EMPTY_STORAGE: EntityStorage = {
  entities: {},
  version: 1,
};

/**
 * Get a copy of the default empty storage
 */
function getEmptyEntityStorage(): EntityStorage {
  return { ...DEFAULT_EMPTY_STORAGE, entities: {} };
}

// Precompiled regex patterns for entity name normalization
const WHITESPACE_PATTERN = /\s+/g;

/**
 * Entity Memory class - structured entity tracking
 */
export class EntityMemory {
  private baseDir: string;
  private storagePath: string;
  private cachedStorage: EntityStorage | null = null;

  /**
   * Constructor
   * @param dataDir - Base data directory
   */
  constructor(dataDir: string) {
    this.baseDir = path.join(dataDir, 'entity-memory');
    this.storagePath = path.join(this.baseDir, 'entities.json');
    this.ensureDirectory();
  }

  /**
   * Ensure storage directory exists
   */
  private ensureDirectory(): void {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  /**
   * Normalize entity name for storage (lowercase, no special chars)
   */
  private normalizeName(name: string): string {
    const normalized = name.toLowerCase().trim().replace(WHITESPACE_PATTERN, '_');
    return sanitizeTopicName(normalized);
  }

  /**
   * Read entities from storage (with caching)
   */
  private readStorage(): EntityStorage {
    if (this.cachedStorage) {
      return this.cachedStorage;
    }

    const checkedPath = safePath(this.storagePath, this.baseDir);
    if (!checkedPath || !fs.existsSync(checkedPath)) {
      this.cachedStorage = getEmptyEntityStorage();
      return this.cachedStorage;
    }

    try {
      const content = fs.readFileSync(checkedPath, 'utf-8');
      this.cachedStorage = JSON.parse(content) as EntityStorage;

      // Backward compatibility: convert old string attributes to new temporal fact format
      for (const [key, entity] of Object.entries(this.cachedStorage.entities)) {
        // Check if attributes are in old format (Record<string, string>)
        const firstAttr = Object.values(entity.attributes)[0];
        if (typeof firstAttr === 'string') {
          // Convert each string attribute to a single fact with valid_from = entity.created_at
          const convertedAttributes: Record<string, EntityFact[]> = {};
          for (const [attrKey, attrValue] of Object.entries(entity.attributes as unknown as Record<string, string>)) {
            convertedAttributes[attrKey] = [{
              value: attrValue,
              valid_from: entity.created_at,
              valid_to: null,
              confidence: 1.0,
              source_ref: null,
            }];
          }
          entity.attributes = convertedAttributes;
        }
      }

      return this.cachedStorage;
    } catch (e) {
      console.error('Error reading entity storage:', e);
      this.cachedStorage = getEmptyEntityStorage();
      return this.cachedStorage;
    }
  }

  /**
   * Write entities to storage (updates cache)
   */
  private writeStorage(storage: EntityStorage): boolean {
    const checkedPath = safePath(this.storagePath, this.baseDir);
    if (!checkedPath) {
      console.error('Path traversal detected in entity storage');
      logWAL('entity_storage_write', 'entities', this.storagePath, false, { error: 'Path traversal detected' });
      return false;
    }

    try {
      this.cachedStorage = storage;
      const content = JSON.stringify(storage, null, 2);
      fs.writeFileSync(checkedPath, content, 'utf-8');
      const success = true;
      logWAL('entity_storage_write', 'entities', checkedPath, success, {
        entity_count: Object.keys(storage.entities).length,
      });
      return success;
    } catch (e) {
      console.error('Error writing entity storage:', e);
      logWAL('entity_storage_write', 'entities', checkedPath, false, {
        error: (e as Error).message,
      });
      return false;
    }
  }

  /**
   * Upsert (create or update) an entity
   * For backward compatibility, if attributes are provided as strings, they will be converted to single facts
   */
  upsert(entity: Omit<Entity, 'created_at' | 'updated_at' | 'accessed_at'>): Entity {
    const storage = this.readStorage();
    const now = Date.now();
    const key = this.normalizeName(entity.name);

    const existing = storage.entities[key];

    // Convert any string attributes to EntityFact format for backward compatibility
    const convertedAttributes: Record<string, EntityFact[]> = {};
    for (const [attrKey, attrValue] of Object.entries(entity.attributes || {})) {
      // Check if it's already in EntityFact format
      if (Array.isArray(attrValue) && attrValue.length > 0 && 'value' in attrValue[0]) {
        convertedAttributes[attrKey] = attrValue as EntityFact[];
      } else {
        // It's a plain string value from the old format - convert to single fact
        convertedAttributes[attrKey] = [{
          value: String(attrValue),
          valid_from: now,
          valid_to: null,
          confidence: 1.0,
          source_ref: null,
        }];
      }
    }

    const updatedEntity: Entity = {
      name: entity.name,
      type: entity.type,
      description: entity.description || '',
      aliases: entity.aliases || [],
      attributes: convertedAttributes,
      tags: entity.tags || [],
      created_at: existing ? existing.created_at : now,
      updated_at: now,
      accessed_at: now,
    };

    storage.entities[key] = updatedEntity;
    this.writeStorage(storage);

    return updatedEntity;
  }

  /**
   * Get an entity by name - updates accessed_at (batched by cache)
   * Note: accessed_at updates are cached in memory and written to disk on next write
   * This avoids writing to disk on every read, but could result in lost access time updates
   * if the server exits before the next write. For most use cases this is acceptable.
   */
  get(name: string): Entity | null {
    const storage = this.readStorage();
    const key = this.normalizeName(name);
    const entity = storage.entities[key];

    if (!entity) {
      return null;
    }

    // Update accessed_at in cache only - will be written on next write
    // This avoids writing to disk on every read
    entity.accessed_at = Date.now();
    return entity;
  }

  /**
   * Force write of cached storage to disk to persist any accessed_at updates
   * This can be called after bulk reads to ensure access time data is persisted
   */
  flush(): boolean {
    const storage = this.readStorage();
    return this.writeStorage(storage);
  }

  /**
   * Add a new temporal fact for an attribute. Automatically invalidates any currently valid fact.
   * @param name - Entity name
   * @param attribute - Attribute key (predicate)
   * @param value - Fact value
   * @param confidence - Confidence score 0-1 (default 1.0)
   * @param sourceRef - Source reference where this fact came from
   * @returns The updated entity or null if entity not found
   */
  addFact(
    name: string,
    attribute: string,
    value: string,
    confidence: number = 1.0,
    sourceRef: string | null = null
  ): Entity | null {
    const storage = this.readStorage();
    const key = this.normalizeName(name);
    const entity = storage.entities[key];

    if (!entity) {
      return null;
    }

    const now = Date.now();

    // Invalidate all currently valid facts for this attribute
    if (entity.attributes[attribute]) {
      for (const fact of entity.attributes[attribute]) {
        if (fact.valid_to === null) {
          fact.valid_to = now;
        }
      }
    }

    // Create new fact
    const newFact: EntityFact = {
      value,
      valid_from: now,
      valid_to: null,
      confidence,
      source_ref: sourceRef,
    };

    // Add to attribute array
    if (!entity.attributes[attribute]) {
      entity.attributes[attribute] = [];
    }
    entity.attributes[attribute].push(newFact);
    entity.updated_at = now;

    this.writeStorage(storage);
    return entity;
  }

  /**
   * Invalidate all currently valid facts for a specific attribute.
   * @param name - Entity name
   * @param attribute - Attribute key to invalidate
   * @returns Number of facts invalidated, or null if entity not found
   */
  invalidateFacts(name: string, attribute: string): number | null {
    const storage = this.readStorage();
    const key = this.normalizeName(name);
    const entity = storage.entities[key];

    if (!entity) {
      return null;
    }

    if (!entity.attributes[attribute]) {
      return 0;
    }

    const now = Date.now();
    let invalidated = 0;

    for (const fact of entity.attributes[attribute]) {
      if (fact.valid_to === null) {
        fact.valid_to = now;
        invalidated++;
      }
    }

    if (invalidated > 0) {
      entity.updated_at = now;
      this.writeStorage(storage);
    }

    return invalidated;
  }

  /**
   * Get all currently valid facts for a specific attribute.
   * @param entity - The entity to get facts from
   * @param attribute - Attribute key
   * @returns Array of currently valid facts (empty if none)
   */
  getValidFacts(entity: Entity, attribute: string): EntityFact[] {
    if (!entity.attributes[attribute]) {
      return [];
    }
    return entity.attributes[attribute].filter(fact => fact.valid_to === null);
  }

  /**
   * Get the current (latest valid) value for an attribute.
   * @param entity - The entity to get value from
   * @param attribute - Attribute key
   * @returns The current value or null if no valid fact
   */
  getCurrentValue(entity: Entity, attribute: string): string | null {
    const validFacts = this.getValidFacts(entity, attribute);
    if (validFacts.length === 0) {
      return null;
    }
    // Return the most recently added fact (last in array)
    return validFacts[validFacts.length - 1].value;
  }

  /**
   * Invalidate the cache - forces re-read from disk on next access
   * Use this when external changes to the file may have occurred
   */
  invalidateCache(): void {
    this.cachedStorage = null;
  }

  /**
   * Search entities by keyword in name, description, aliases, or tags
   */
  search(keyword: string): Entity[] {
    const storage = this.readStorage();
    const lowerKeyword = keyword.toLowerCase();
    const results: Entity[] = [];

    for (const entity of Object.values(storage.entities)) {
      // Search name
      if (entity.name.toLowerCase().includes(lowerKeyword)) {
        results.push(entity);
        continue;
      }
      // Search description
      if (entity.description.toLowerCase().includes(lowerKeyword)) {
        results.push(entity);
        continue;
      }
      // Search aliases
      if (entity.aliases.some(a => a.toLowerCase().includes(lowerKeyword))) {
        results.push(entity);
        continue;
      }
      // Search tags
      if (entity.tags.some(t => t.toLowerCase().includes(lowerKeyword))) {
        results.push(entity);
        continue;
      }
    }

    // Sort by most recently updated
    return results.sort((a, b) => b.updated_at - a.updated_at);
  }

  /**
   * List entities by type
   */
  getByType(type: EntityType): Entity[] {
    return this.list(type);
  }

  /**
   * List all entities, optionally filtered by type
   */
  list(type?: EntityType): Entity[] {
    const storage = this.readStorage();
    let entities = Object.values(storage.entities);

    if (type) {
      entities = entities.filter(e => e.type === type);
    }

    // Sort by most recently updated
    return entities.sort((a, b) => b.updated_at - a.updated_at);
  }

  /**
   * Delete an entity by name (alias for delete, backward compatibility)
   */
  remove(name: string, _type?: EntityType): boolean {
    return this.delete(name);
  }

  /**
   * Delete an entity by name
   */
  delete(name: string): boolean {
    const storage = this.readStorage();
    const key = this.normalizeName(name);

    if (!storage.entities[key]) {
      return false;
    }

    delete storage.entities[key];
    return this.writeStorage(storage);
  }

  /**
   * Prune entities that haven't been updated before the cutoff date
   * @param maxAgeDays - Maximum age in days to keep (default: 90 days)
   * @returns Number of entities pruned
   */
  prune(maxAgeDays: number = 90): number {
    const storage = this.readStorage();
    const cutoffTimestamp = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
    const originalCount = Object.keys(storage.entities).length;

    for (const [key, entity] of Object.entries(storage.entities)) {
      if (entity.updated_at < cutoffTimestamp) {
        delete storage.entities[key];
      }
    }

    const newCount = Object.keys(storage.entities).length;
    this.writeStorage(storage);

    return originalCount - newCount;
  }

  /**
   * Count total entities
   */
  count(): number {
    const storage = this.readStorage();
    return Object.keys(storage.entities).length;
  }
}

export default EntityMemory;
