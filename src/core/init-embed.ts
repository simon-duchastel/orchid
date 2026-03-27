/**
 * MUST be imported FIRST before any other imports!
 * Intercepts fs.readFileSync to serve embedded package.json
 */

// Load embedded files synchronously
const cache = new Map<string, string>();

if (import.meta.url.includes("/$bunfs/")) {
  // In compiled binary - embeddedFiles is available
  for (const file of (globalThis as any).Bun?.embeddedFiles || []) {
    // Read sync using Blob methods
    const reader = file.stream().getReader();
    const chunks: Uint8Array[] = [];
    
    // Read all chunks (Bun.embeddedFiles are available sync in compiled mode)
    let result = reader.read();
    while (!(result instanceof Promise)) {
      if (result.done) break;
      chunks.push(result.value);
      result = reader.read();
    }
    
    // Combine and cache
    const total = chunks.reduce((a, b) => a + b.length, 0);
    const combined = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    
    const content = new TextDecoder().decode(combined);
    cache.set(file.name, content);
    const basename = file.name.split("/").pop();
    if (basename) cache.set(basename, content);
  }
  
  // Patch fs.readFileSync
  const fs = require("node:fs");
  const original = fs.readFileSync;
  fs.readFileSync = function(path: string, options?: any) {
    const content = cache.get(path) ?? cache.get(path.split("/").pop() ?? "");
    if (content !== undefined) {
      return options?.encoding || options === "utf8" ? content : Buffer.from(content);
    }
    return original.apply(this, arguments);
  };
}
