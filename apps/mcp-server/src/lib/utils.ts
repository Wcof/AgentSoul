/**
 * @fileoverview Shared utility functions
 * @description Common utilities for file operations, path safety, and string processing
 */

import fs from 'fs';
import path from 'path';
import { PROJECT_ROOT, DATA_ROOT } from './paths.js';

/**
 * Safely check for path traversal attacks
 * @param filePath - The requested file path
 * @param baseDir - The base directory that should contain the file
 * @returns The resolved absolute path if safe, null if traversal detected
 */
export function safePath(filePath: string, baseDir: string): string | null {
  const resolved = path.resolve(filePath);
  const resolvedBase = path.resolve(baseDir);

  if (!resolved.startsWith(resolvedBase)) {
    return null;
  }

  return resolved;
}

/**
 * Safely read a file from disk
 * @param filePath - Path to the file to read
 * @returns File content as string, or null if error
 */
export function readFile(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    // File doesn't exist or error reading
    return null;
  }
}

/**
 * Safely write a file to disk, creating parent directories if needed
 * @param filePath - Path to write to
 * @param content - Content to write
 * @returns true if successful, false otherwise
 */
export function writeFile(filePath: string, content: string): boolean {
  try {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  } catch (e) {
    console.error(`Error writing file ${filePath}:`, e);
    return false;
  }
}

// Precompiled regex patterns for date/time validation
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const WEEK_PATTERN = /^\d{4}-W\d{2}$/;
const MONTH_PATTERN = /^\d{4}-\d{2}$/;
const YEAR_PATTERN = /^\d{4}$/;
const SAFE_FILENAME_PATTERN = /[^a-zA-Z0-9-_]/g;

/**
 * Parse a date string to ensure it's in the expected format
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns true if valid, false otherwise
 */
export function isValidDateString(dateStr: string): boolean {
  if (!DATE_PATTERN.test(dateStr)) {
    return false;
  }

  const date = new Date(dateStr);
  return date.toISOString().split('T')[0] === dateStr;
}

/**
 * Parse a week string in YYYY-WW format
 * @param weekStr - Year-week string
 * @returns true if valid
 */
export function isValidWeekString(weekStr: string): boolean {
  return WEEK_PATTERN.test(weekStr);
}

/**
 * Parse a month string in YYYY-MM format
 * @param monthStr - Year-month string
 * @returns true if valid
 */
export function isValidMonthString(monthStr: string): boolean {
  return MONTH_PATTERN.test(monthStr);
}

/**
 * Parse a year string in YYYY format
 * @param yearStr - Year string
 * @returns true if valid
 */
export function isValidYearString(yearStr: string): boolean {
  return YEAR_PATTERN.test(yearStr);
}

/**
 * Sanitize a topic name for file storage
 * Replaces unsafe characters with underscores
 * @param topic - Original topic name
 * @returns Sanitized name safe for filenames
 */
export function sanitizeTopicName(topic: string): string {
  return topic.replace(SAFE_FILENAME_PATTERN, '_');
}

/**
 * Format a timestamp to ISO date string
 * @param timestamp - Unix timestamp (ms)
 * @returns YYYY-MM-DD date string
 */
export function timestampToDate(timestamp: number): string {
  return new Date(timestamp).toISOString().split('T')[0];
}

/**
 * Truncate text to a maximum length
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @returns Truncated text
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Log an error message to stderr
 * @param context - Context description where the error occurred
 * @param error - The error object or message
 */
export function logError(context: string, error: unknown): void {
  console.error(`[ERROR] ${context}:`, error);
}

/**
 * Read and parse JSON from a file
 * @param filePath - Path to the JSON file
 * @returns Parsed object, or null if error
 */
export function readJson<T>(filePath: string): T | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (e) {
    logError('readJson', e);
    return null;
  }
}

/**
 * Write object as JSON to a file
 * @param filePath - Path to write
 * @param data - Data to serialize
 * @returns true if successful, false otherwise
 */
export function writeJson<T>(filePath: string, data: T): boolean {
  try {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    const content = JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  } catch (e) {
    logError('writeJson', e);
    return false;
  }
}

/**
 * Get current time as ISO 8601 string
 * @returns Current timestamp in ISO format
 */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Convert a value to list of strings
 * Supports array, comma-separated string, and single string
 * @param v - Input value
 * @returns Normalized string array
 */
export function toList(v: unknown): string[] {
  if (Array.isArray(v)) return (v as string[]).filter(x => typeof x === 'string' && x.trim());
  if (typeof v === 'string') {
    if (v.includes(',')) {
      return v.split(',').map(x => x.trim()).filter(x => x);
    }
    return v.trim() ? [v.trim()] : [];
  }
  return [];
}

/**
 * Safely get a property value from an object with default fallback
 * @param obj - Target object
 * @param key - Property key
 * @param defaultValue - Default value if key not found or null/undefined
 * @returns Property value or default
 */
export function safeGet<T>(obj: Record<string, unknown> | undefined, key: string, defaultValue: T): T {
  if (!obj || typeof obj !== 'object') return defaultValue;
  const val = obj[key];
  return val === undefined || val === null ? defaultValue : val as T;
}

/**
 * Write-Ahead Log (WAL) - Log all write operations for auditing
 * @param operation Name of the operation being performed
 * @param identifier Target identifier (date, topic name, entity name, etc.)
 * @param targetPath Full path to the file being written
 * @param success Whether the write operation succeeded
 * @param metadata Optional additional metadata
 */
export function logWAL(
  operation: string,
  identifier: string,
  targetPath: string,
  success: boolean,
  metadata?: Record<string, unknown>
): void {
  try {
    const walDir = path.join(DATA_ROOT, 'wal');
    // Ensure WAL directory exists before writing
    fs.mkdirSync(walDir, { recursive: true });
    const walPath = path.join(walDir, 'write_log.jsonl');

    // Handle target path - if relative goes outside project root, use absolute path
    let relativePath = path.relative(PROJECT_ROOT, targetPath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      // Path outside project root - keep as absolute with marker
      relativePath = `absolute://${targetPath}`;
    }

    const entry = {
      timestamp: new Date().toISOString(),
      operation,
      identifier,
      targetPath: relativePath,
      success,
      metadata: metadata || {},
    };

    const line = JSON.stringify(entry) + '\n';
    fs.appendFileSync(walPath, line, 'utf8');
  } catch (e) {
    // Don't fail the write if WAL logging fails - but output structured error
    console.error(JSON.stringify({
      component: 'WAL',
      operation,
      identifier,
      error: String(e),
    }, null, 2));
  }
}

export default {
  safePath,
  readFile,
  writeFile,
  isValidDateString,
  isValidWeekString,
  isValidMonthString,
  isValidYearString,
  sanitizeTopicName,
  timestampToDate,
  truncateText,
  logError,
  readJson,
  writeJson,
  nowISO,
  toList,
  safeGet,
  logWAL,
};
