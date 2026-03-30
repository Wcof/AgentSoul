/**
 * @fileoverview Entity Memory - Structured entity tracking
 * @description Track structured entities: people, hardware, projects, concepts, places, services
 */

import fs from 'fs';
import path from 'path';
import { safePath } from './utils.js';

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
  /** Key-value attributes storing structured data */
  attributes: Record<string, string>;
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
    return name.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9-_]/g, '');
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
      this.cachedStorage = {
        entities: {},
        version: 1,
      };
      return this.cachedStorage;
    }

    try {
      const content = fs.readFileSync(checkedPath, 'utf-8');
      this.cachedStorage = JSON.parse(content) as EntityStorage;
      return this.cachedStorage;
    } catch (e) {
      console.error('Error reading entity storage:', e);
      this.cachedStorage = {
        entities: {},
        version: 1,
      };
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
      return false;
    }

    try {
      this.cachedStorage = storage;
      const content = JSON.stringify(storage, null, 2);
      fs.writeFileSync(checkedPath, content, 'utf-8');
      return true;
    } catch (e) {
      console.error('Error writing entity storage:', e);
      return false;
    }
  }

  /**
   * Upsert (create or update) an entity
   */
  upsert(entity: Omit<Entity, 'created_at' | 'updated_at' | 'accessed_at'>): Entity {
    const storage = this.readStorage();
    const now = Date.now();
    const key = this.normalizeName(entity.name);

    const existing = storage.entities[key];

    const updatedEntity: Entity = {
      name: entity.name,
      type: entity.type,
      description: entity.description || '',
      aliases: entity.aliases || [],
      attributes: entity.attributes || {},
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
