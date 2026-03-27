/**
 * Orchid Daemon Process
 *
 * This process runs in the background and manages agent orchestration.
 * It is spawned by the CLI's `up` command and stopped by the `down` command.
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync, unlinkSync } from "node:fs";
import { getPidFile, getOrchidDir, getMainRepoDir, getWorktreesDir } from "./core/files/paths.js";
import { PiSessionAdapter } from "./agent-framework/agents/interface/index.js";
import { log } from "./core/logging/logger.js";

export async function startDaemonProcess() {
  const orchidDir = getOrchidDir();
  const pidFile = getPidFile();
  const mainRepoDir = getMainRepoDir();
  const worktreesDir = getWorktreesDir(() => mainRepoDir);
  
  try {
    // Ensure the orchid directory exists
    if (!existsSync(orchidDir)) {
      mkdirSync(orchidDir, { recursive: true });
    }

    // Check for existing PID file and verify if process is running
    if (existsSync(pidFile)) {
      const existingPid = parseInt(readFileSync(pidFile, 'utf8').trim());
      try {
        // Check if process is actually running
        process.kill(existingPid, 0);
        log.error(`[orchid] Daemon already running with PID ${existingPid}`);
        process.exit(1);
      } catch (err) {
        // Process not running, remove stale PID file
        log.warn(`[orchid] Removing stale PID file from dead process ${existingPid}`);
        unlinkSync(pidFile);
      }
    }

    // Write our PID so the CLI can find and stop us
    writeFileSync(pidFile, process.pid.toString());

    log.log(`[orchid] Starting daemon (PID: ${process.pid})`);

    // Create Pi session manager
    const sessionManager = new PiSessionAdapter({
      instancesDir: worktreesDir,
    });

    log.log("[orchid] Pi session manager initialized");

    // Handle shutdown signals gracefully
    const shutdown = async (signal: string) => {
      log.log(`[orchid] Received ${signal}, shutting down...`);
      await sessionManager.stopAllAgentInstances();
      
      // Remove PID file on shutdown
      try {
        if (existsSync(pidFile)) {
          unlinkSync(pidFile);
          log.log(`[orchid] Removed PID file ${pidFile}`);
        }
      } catch (err) {
        log.warn(`[orchid] Could not remove PID file: ${err}`);
      }
      
      process.exit(0);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
    // Note: Don't register 'exit' event - it fires when event loop is empty and causes premature exit

    log.log("[orchid] Daemon ready");

    // Keep the process alive
    await new Promise(() => {});
  } catch (err: unknown) {
    log.error("[orchid] Failed to start daemon:", err);
    
    // Clean up PID file if it was created
    try {
      if (existsSync(pidFile)) {
        unlinkSync(pidFile);
        log.warn(`[orchid] Removed PID file on startup failure`);
      }
    } catch (cleanupErr) {
      log.warn(`[orchid] Could not remove PID file on startup failure: ${cleanupErr}`);
    }
    
    process.exit(1);
  }
}

// Backward compatibility: also export as main for testing
export { startDaemonProcess as main };

// Run main if this file is executed directly as a script (not as a compiled binary)
// In compiled mode, import.meta.url is file:///$bunfs/root/<name> and process.argv[1] is /$bunfs/root/<name>
// We should only auto-start the daemon if we're NOT being invoked through the CLI
const isCompiledBinary = import.meta.url.includes('/$bunfs/');
const isDirectExecution = import.meta.url === `file://${process.argv[1]}`;

// Only start daemon automatically if:
// 1. We're executed directly (isDirectExecution), AND
// 2. We're NOT a compiled binary (isCompiledBinary), OR we're explicitly running as daemon
if (isDirectExecution && !isCompiledBinary) {
  startDaemonProcess();
}
