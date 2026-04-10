/**
 * @fileoverview Verbatim Evidence Layer tools
 * @description MCP tools for adding and searching verbatim original text fragments
 */

import { z } from 'zod';
import { VerbatimEvidence, VerbatimFragment } from '../lib/verbatim-evidence.js';
import type { ToolResponse } from '../types.js';
import type { SecurityLevel } from '../lib/verbatim-evidence.js';

/** Verbatim add fragment input schema */
const VerbatimAddSchema = z.object({
  /** Original unchanged verbatim text */
  text: z.string().min(1),
  /** Source where this fragment came from (e.g., "conversation:2026-04-10", "topic:agent-architecture") */
  source: z.string().min(1),
  /** Creation date (YYYY-MM-DD) */
  date: z.string().min(1),
  /** Security level - follows AgentSoul 3-level security model: PUBLIC/PROTECTED/SEALED */
  security_level: z.enum(['PUBLIC', 'PROTECTED', 'SEALED']).default('PROTECTED'),
  /** Optional topic name this fragment belongs to */
  topic: z.string().min(1).optional(),
  /** Optional entity name this fragment is about */
  entity: z.string().min(1).optional(),
  /** Optional tags for categorization */
  tags: z.array(z.string().min(1)).optional(),
});

/** Verbatim get fragment input schema */
const VerbatimGetSchema = z.object({
  /** Fragment ID to retrieve */
  id: z.string().min(1),
  /** Request to include PROTECTED level text in output - must also have authorization */
  include_protected_text: z.boolean().optional(),
  /** Caller is authorized to view PROTECTED level content - default false */
  can_view_protected: z.boolean().optional(),
});

/** Verbatim search input schema */
const VerbatimSearchSchema = z.object({
  /** Search query text */
  query: z.string().min(1),
  /** Filter by topic */
  topic: z.string().optional(),
  /** Filter by entity */
  entity: z.string().optional(),
  /** Filter before date (YYYY-MM-DD) */
  date_before: z.string().optional(),
  /** Filter after date (YYYY-MM-DD) */
  date_after: z.string().optional(),
  /** Filter by security level */
  security_level: z.enum(['PUBLIC', 'PROTECTED', 'SEALED']).optional(),
  /** Maximum number of results to return */
  limit: z.number().int().min(1).max(100).optional().default(10),
  /** Request to include PROTECTED level text in output - must also have authorization */
  include_protected_text: z.boolean().optional(),
  /** Caller is authorized to view PROTECTED level content - default false */
  can_view_protected: z.boolean().optional(),
});

/** Verbatim delete fragment input schema */
const VerbatimDeleteSchema = z.object({
  /** Fragment ID to delete */
  id: z.string().min(1),
});

/** Input types */
type VerbatimAddInput = z.infer<typeof VerbatimAddSchema>;
type VerbatimGetInput = z.infer<typeof VerbatimGetSchema>;
type VerbatimSearchInput = z.infer<typeof VerbatimSearchSchema>;
type VerbatimDeleteInput = z.infer<typeof VerbatimDeleteSchema>;

/** Singleton instance */
let _verbatimEvidence: VerbatimEvidence | null = null;

/**
 * Get the singleton instance
 */
function getVerbatimEvidence(): VerbatimEvidence {
  if (!_verbatimEvidence) {
    _verbatimEvidence = new VerbatimEvidence();
  }
  return _verbatimEvidence;
}

/**
 * Apply security filtering to a fragment - never returns SEALED text, PROTECTED is masked by default
 * Double authorization gate: PROTECTED requires BOTH include_protected_text=true AND can_view_protected=true
 */
function applySecurity(
  fragment: VerbatimFragment,
  includeProtectedText: boolean = false,
  canViewProtected: boolean = false
): Partial<VerbatimFragment> {
  if (fragment.security_level === 'SEALED') {
    // SEALED: never return text
    return {
      id: fragment.id,
      source: fragment.source,
      date: fragment.date,
      security_level: fragment.security_level,
      topic: fragment.topic,
      entity: fragment.entity,
      tags: fragment.tags,
      created_at: fragment.created_at,
      text: '[REDACTED - SEALED level content]',
    };
  }

  if (fragment.security_level === 'PROTECTED' && !(includeProtectedText && canViewProtected)) {
    // PROTECTED: mask text unless both flags are explicitly true
    const maskedLength = fragment.text.length;
    return {
      ...fragment,
      text: `[PROTECTED - ${maskedLength} characters available, request include_protected_text=true AND can_view_protected=true to view]`,
    };
  }

  // PUBLIC or PROTECTED with double authorization - return full text
  return fragment;
}

/**
 * Handle add verbatim fragment
 */
export async function handleVerbatimAdd(input: VerbatimAddInput): Promise<ToolResponse> {
  const verbatim = getVerbatimEvidence();
  const id = verbatim.add({
    text: input.text,
    source: input.source,
    date: input.date,
    security_level: input.security_level,
    topic: input.topic,
    entity: input.entity,
    tags: input.tags,
  });

  return {
    content: [{
      type: 'text',
      text: id
        ? JSON.stringify({ success: true, id })
        : JSON.stringify({ success: false, error: 'Failed to add fragment' }),
    }],
  };
}

/**
 * Handle get verbatim fragment by ID
 */
export async function handleVerbatimGet(input: VerbatimGetInput): Promise<ToolResponse> {
  const verbatim = getVerbatimEvidence();
  const fragment = verbatim.get(input.id);

  if (!fragment) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ success: false, error: 'Fragment not found' }),
      }],
    };
  }

  const safeFragment = applySecurity(fragment, input.include_protected_text, input.can_view_protected);

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ success: true, fragment: safeFragment }),
    }],
  };
}

/**
 * Handle search verbatim fragments
 */
export async function handleVerbatimSearch(input: VerbatimSearchInput): Promise<ToolResponse> {
  const verbatim = getVerbatimEvidence();
  const results = verbatim.search(input.query, {
    topic: input.topic,
    entity: input.entity,
    dateBefore: input.date_before,
    dateAfter: input.date_after,
    securityLevel: input.security_level,
    limit: input.limit,
  });

  // Apply security filtering to all results
  const safeResults = results.map(r => applySecurity(r, input.include_protected_text, input.can_view_protected));

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        count: safeResults.length,
        results: safeResults,
      }, null, 2),
    }],
  };
}

/**
 * Handle delete verbatim fragment
 */
export async function handleVerbatimDelete(input: VerbatimDeleteInput): Promise<ToolResponse> {
  const verbatim = getVerbatimEvidence();
  const deleted = verbatim.delete(input.id);

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ deleted }),
    }],
  };
}

export {
  VerbatimAddSchema,
  VerbatimGetSchema,
  VerbatimSearchSchema,
  VerbatimDeleteSchema,
};
