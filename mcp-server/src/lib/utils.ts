/**
 * @fileoverview Shared utility functions
 * @description Common utilities for file operations, path safety, and string processing
 */

import fs from 'fs';
import path from 'path';

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

/**
 * Parse a date string to ensure it's in the expected format
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns true if valid, false otherwise
 */
export function isValidDateString(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
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
  return /^\d{4}-W\d{2}$/.test(weekStr);
}

/**
 * Parse a month string in YYYY-MM format
 * @param monthStr - Year-month string
 * @returns true if valid
 */
export function isValidMonthString(monthStr: string): boolean {
  return /^\d{4}-\d{2}$/.test(monthStr);
}

/**
 * Parse a year string in YYYY format
 * @param yearStr - Year string
 * @returns true if valid
 */
export function isValidYearString(yearStr: string): boolean {
  return /^\d{4}$/.test(yearStr);
}

/**
 * Sanitize a topic name for file storage
 * Replaces unsafe characters with underscores
 * @param topic - Original topic name
 * @returns Sanitized name safe for filenames
 */
export function sanitizeTopicName(topic: string): string {
  return topic.replace(/[^a-zA-Z0-9-_]/g, '_');
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
};
