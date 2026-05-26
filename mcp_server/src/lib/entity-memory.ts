/**
 * @fileoverview 实体记忆模块 - 支持时间事实层 (Temporal Fact Layer)
 * @description 提供实体记忆的 CRUD 操作，包含时间有效性事实管理。
 * Entity attributes 使用 EntityFact[] 数组支持事实的时间有效性追踪。
 * 向后兼容旧格式字符串属性，自动转换为事实数组。
 */

import { readJson, writeJson, resolve, generateId, logWAL } from './utils.js';
import config from './config.js';

export type EntityType = 'person' | 'hardware' | 'project' | 'concept' | 'place' | 'service';

export interface EntityFact {
  attribute: string;
  value: string;
  confidence: number;
  valid_from: string;
  valid_to: string | null;
  source_ref: string | null;
  factId: string;
}

export interface Entity {
  type: EntityType;
  name: string;
  description: string;
  aliases: string[];
  /** Attributes stored as fact arrays for temporal validity tracking */
  attributes: Record<string, EntityFact[]>;
  tags: string[];
  /** Flat facts list - maintained for backward compatibility and cross-attribute queries */
  facts: EntityFact[];
  createdAt: string;
  updatedAt: string;
  accessedAt: string;
  accessCount: number;
}

export interface EntityResult {
  success: boolean;
  message: string;
  entity?: Entity;
}

/**
 * Convert legacy string/number/boolean attributes to EntityFact[] format.
 * Provides backward compatibility for data written before the temporal fact layer.
 */
function migrateAttributes(attrs: Record<string, unknown>): Record<string, EntityFact[]> {
  const result: Record<string, EntityFact[]> = {};
  const now = new Date().toISOString();
  for (const [key, value] of Object.entries(attrs)) {
    if (Array.isArray(value) && value.length > 0 && 'factId' in (value[0] as Record<string, unknown>)) {
      // Already in EntityFact[] format
      result[key] = value as EntityFact[];
    } else if (value !== null && value !== undefined) {
      // Legacy format: convert string/number/boolean to EntityFact
      result[key] = [{
        attribute: key,
        value: String(value),
        confidence: 1.0,
        valid_from: now,
        valid_to: null,
        source_ref: null,
        factId: generateId(),
      }];
    } else {
      result[key] = [];
    }
  }
  return result;
}

export class EntityMemory {
  private readonly dataPath: string;

  constructor(dataDir: string) {
    this.dataPath = resolve(dataDir, 'entity-memory', 'entities.json');
  }

  private loadEntities(): Map<string, Entity> {
    const data = readJson(this.dataPath);
    if (data && typeof data === 'object' && 'entities' in data) {
      const entitiesMap = new Map<string, Entity>();
      for (const rawEntity of (data as { entities: Entity[] }).entities) {
        // Backward compatibility: migrate old Record<string, unknown> attributes to Record<string, EntityFact[]>
        const entity = { ...rawEntity };
        if (entity.attributes) {
          const needsMigration = Object.values(entity.attributes).some(
            v => !Array.isArray(v) || (Array.isArray(v) && v.length > 0 && !('factId' in (v[0] as unknown as Record<string, unknown> || {})))
          );
          if (needsMigration) {
            entity.attributes = migrateAttributes(entity.attributes as Record<string, unknown>);
          }
        } else {
          entity.attributes = {};
        }
        entitiesMap.set(entity.name.toLowerCase(), entity);
      }
      return entitiesMap;
    }
    return new Map();
  }

  private saveEntities(entities: Map<string, Entity>): boolean {
    return writeJson(this.dataPath, {
      entities: Array.from(entities.values()), version: 1, updatedAt: new Date().toISOString()
    });
  }

  upsert(entity: Omit<Entity, 'createdAt' | 'updatedAt' | 'accessedAt' | 'accessCount' | 'facts' | 'attributes'> & { attributes?: Record<string, unknown>; facts?: EntityFact[] }): EntityResult {
    const entities = this.loadEntities();
    const key = entity.name.toLowerCase();
    const now = new Date().toISOString();
    const existing = entities.get(key);

    // Handle attributes: migrate if needed
    let attrs: Record<string, EntityFact[]> = {};
    if (entity.attributes) {
      attrs = migrateAttributes(entity.attributes);
    } else if (existing?.attributes) {
      attrs = existing.attributes;
    }

    const newEntity: Entity = {
      ...entity,
      attributes: attrs,
      facts: entity.facts || existing?.facts || [],
      createdAt: existing?.createdAt || now, updatedAt: now, accessedAt: now,
      accessCount: (existing?.accessCount || 0) + 1,
    };
    entities.set(key, newEntity);
    this.saveEntities(entities);
    logWAL('entity_storage_write', `entity:${key}`, { operation: existing ? 'update' : 'create' });
    return {
      success: true,
      message: existing ? `Updated entity "${entity.name}"` : `Created entity "${entity.name}"`,
      entity: newEntity,
    };
  }

  get(name: string): Entity | null {
    const entities = this.loadEntities();
    const entity = entities.get(name.toLowerCase());
    if (entity) {
      entity.accessedAt = new Date().toISOString();
      entity.accessCount++;
      this.saveEntities(entities);
    }
    return entity || null;
  }

  search(query: string): Entity[] {
    const entities = this.loadEntities();
    const queryLower = query.toLowerCase();
    const results: Entity[] = [];
    for (const entity of entities.values()) {
      const searchable = [entity.name, entity.description, ...entity.aliases, ...entity.tags].join(' ').toLowerCase();
      if (searchable.includes(queryLower)) results.push(entity);
    }
    return results;
  }

  list(): Entity[] { return Array.from(this.loadEntities().values()); }

  getByType(type: EntityType): Entity[] { return this.list().filter(e => e.type === type); }

  remove(name: string, type?: EntityType): boolean {
    const entities = this.loadEntities();
    const entity = entities.get(name.toLowerCase());
    if (!entity || (type && entity.type !== type)) return false;
    entities.delete(name.toLowerCase());
    const result = this.saveEntities(entities);
    logWAL('entity_storage_write', `entity:${name.toLowerCase()}`, { operation: 'delete' });
    return result;
  }

  prune(maxAgeDays: number = 90): number {
    const entities = this.loadEntities();
    const now = Date.now();
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
    let pruned = 0;
    for (const [key, entity] of entities.entries()) {
      if (now - new Date(entity.accessedAt).getTime() > maxAgeMs) { entities.delete(key); pruned++; }
    }
    if (pruned > 0) this.saveEntities(entities);
    return pruned;
  }

  /**
   * Add a temporal fact to an entity.
   * Invalidates any current facts with the same attribute (sets valid_to) before adding the new one.
   */
  addFact(name: string, attribute: string, value: string, confidence: number = 1.0, sourceRef: string | null = null): Entity | null {
    const entities = this.loadEntities();
    const entity = entities.get(name.toLowerCase());
    if (!entity) return null;
    const now = new Date().toISOString();

    // Invalidate existing active facts for the same attribute
    for (const fact of entity.facts) {
      if (fact.attribute === attribute && fact.valid_to === null) {
        fact.valid_to = now;
      }
    }

    // Add new fact to flat facts list
    entity.facts.push({ attribute, value, confidence, valid_from: now, valid_to: null, source_ref: sourceRef, factId: generateId() });

    // Also update the attributes map
    if (!entity.attributes[attribute]) {
      entity.attributes[attribute] = [];
    }
    // Invalidate existing active facts in attributes map
    for (const fact of entity.attributes[attribute]) {
      if (fact.valid_to === null) {
        fact.valid_to = now;
      }
    }
    entity.attributes[attribute].push({ attribute, value, confidence, valid_from: now, valid_to: null, source_ref: sourceRef, factId: generateId() });

    entity.updatedAt = now; entity.accessedAt = now; entity.accessCount++;
    entities.set(name.toLowerCase(), entity);
    this.saveEntities(entities);
    logWAL('entity_storage_write', `entity:${name.toLowerCase()}:fact:${attribute}`, { operation: 'add_fact' });
    return entity;
  }

  /**
   * Invalidate all active facts for a given attribute on an entity.
   * Returns the number of facts invalidated.
   */
  invalidateFacts(name: string, attribute: string): number | null {
    const entities = this.loadEntities();
    const entity = entities.get(name.toLowerCase());
    if (!entity) return null;
    const now = new Date().toISOString();
    let invalidated = 0;

    // Invalidate in flat facts list
    for (const fact of entity.facts) {
      if (fact.attribute === attribute && fact.valid_to === null) { fact.valid_to = now; invalidated++; }
    }

    // Invalidate in attributes map
    if (entity.attributes[attribute]) {
      for (const fact of entity.attributes[attribute]) {
        if (fact.valid_to === null) { fact.valid_to = now; }
      }
    }

    if (invalidated > 0) {
      entity.updatedAt = now; entities.set(name.toLowerCase(), entity); this.saveEntities(entities);
      logWAL('entity_storage_write', `entity:${name.toLowerCase()}:fact:${attribute}`, { operation: 'invalidate_facts', count: invalidated });
    }
    return invalidated;
  }

  /**
   * Get all currently valid facts for an entity (valid_to is null).
   */
  getValidFacts(name: string): EntityFact[] | null {
    const entity = this.get(name);
    if (!entity) return null;
    return entity.facts.filter(f => f.valid_to === null);
  }

  /**
   * Get the current value of an attribute - returns only the active (valid_to: null) fact's value.
   */
  getCurrentValue(name: string, attribute: string): string | null {
    const entity = this.get(name);
    if (!entity) return null;
    const activeFact = entity.facts.find(f => f.attribute === attribute && f.valid_to === null);
    return activeFact?.value || null;
  }
}
