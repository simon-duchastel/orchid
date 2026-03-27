/**
 * Embedded Assets Loader
 * 
 * Loads embedded files at startup and patches fs.readFileSync.
 * Import this module FIRST before any other imports.
 */

import { embeddedFiles } from "bun";
import type { PathOrFileDescriptor } from "node:fs";

const embeddedCache = new Map<string, string>();

/**
 * Check if running from compiled binary
 */
function isCompiledBinary(): boolean {
  return import.meta.url.includes("/$bunfs/");
}

/**
 * Get embedded file content
 */
export function getEmbeddedFile(path: string): string | undefined {
  return embeddedCache.get(path) ?? embeddedCache.get(path.split("/").pop() ?? "");
}

/**
 * Initialize embedded files
 * Call this at the VERY START of the application
 */
export async function initEmbeddedFiles(): Promise<void> {
  if (!isCompiledBinary()) {
    return;
  }

  // Load all embedded files into cache
  for (const file of embeddedFiles) {
    const content = await file.text();
    embeddedCache.set(file.name, content);
    const basename = file.name.split("/").pop();
    if (basename) {
      embeddedCache.set(basename, content);
    }
  }
}

// If we're in a compiled binary, patch fs.readFileSync
if (isCompiledBinary()) {
  const fs = require("node:fs") as typeof import("node:fs");
  const originalReadFileSync = fs.readFileSync;
  
  // @ts-expect-error - monkey patching
  fs.readFileSync = function(
    path: PathOrFileDescriptor,
    options?: BufferEncoding | { encoding?: BufferEncoding | null } | null
  ): string | Buffer {
    const pathStr = path.toString();
    const content = getEmbeddedFile(pathStr);
    
    if (content !== undefined) {
      // Return as string if encoding requested
      if (options && (options === "utf8" || options === "utf-8" ||
          (typeof options === "object" && options.encoding))) {
        return content;
      }
      return Buffer.from(content);
    }
    
    return originalReadFileSync(path, options);
  };
}
