/**
 * Embedded Assets Extractor
 *
 * When the CLI is compiled to a binary, we embed package.json, README.md,
 * and CHANGELOG.md directly into the binary. This module extracts them
 * to a temp directory at runtime and sets PI_PACKAGE_DIR so that
 * @mariozechner/pi-coding-agent can find them.
 */

import { embeddedFiles } from "bun";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

let extractedDir: string | null = null;

/**
 * Check if we're running from a compiled binary
 */
function isCompiledBinary(): boolean {
  return import.meta.url.includes("/$bunfs/");
}

/**
 * Extract embedded files to a temp directory
 */
export async function extractEmbeddedFiles(): Promise<string | null> {
  // Only run in compiled binary mode
  if (!isCompiledBinary()) {
    return null;
  }

  // Already extracted
  if (extractedDir && existsSync(extractedDir)) {
    return extractedDir;
  }

  // Create temp directory for extracted files
  extractedDir = join(tmpdir(), `orchid-embedded-${Date.now()}`);
  mkdirSync(extractedDir, { recursive: true });

  // Extract all embedded files
  const filesToExtract = ["package.json", "README.md", "CHANGELOG.md"];

  for (const filename of filesToExtract) {
    const embeddedFile = embeddedFiles.find((f) =>
      f.name.endsWith(`/${filename}`) || f.name === filename
    );

    if (embeddedFile) {
      const content = await embeddedFile.text();
      writeFileSync(join(extractedDir, filename), content);
    }
  }

  // If package.json wasn't embedded, create a minimal one
  const pkgPath = join(extractedDir, "package.json");
  if (!existsSync(pkgPath)) {
    writeFileSync(
      pkgPath,
      JSON.stringify({
        name: "orchid",
        version: "1.0.0",
        piConfig: {
          name: "orchid",
          configDir: ".orchid",
        },
      })
    );
  }

  return extractedDir;
}

/**
 * Initialize embedded files extraction.
 * Call this at the very beginning of the CLI before any imports that
 * depend on @mariozechner/pi-coding-agent.
 */
export async function initEmbeddedFiles(): Promise<void> {
  const dir = await extractEmbeddedFiles();
  if (dir) {
    // Set the env var that pi-coding-agent uses to find its package dir
    process.env.PI_PACKAGE_DIR = dir;
  }
}
