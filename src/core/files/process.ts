/**
 * Process Manager
 *
 * Handles starting and stopping the orchid daemon process.
 * Uses PID file to track running instance and manages the daemon lifecycle.
 */

import { spawn } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, mkdirSync, openSync, closeSync, writeSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getPidFile,
  getLogFile,
  getErrorLogFile,
  getOrchidDir,
  getMainRepoDir,
} from "./paths.js";
import { validateOrchidStructure } from "./index.js";

/**
 * Check if a process with the given PID is running
 */
function isProcessRunning(pid: number): boolean {
  try {
    // Sending signal 0 checks if process exists without killing it
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the PID of the running daemon, if any
 */
export function getRunningPid(): number | null {
  const pidFile = getPidFile();
  if (!existsSync(pidFile)) {
    return null;
  }

  try {
    const pid = parseInt(readFileSync(pidFile, "utf-8").trim(), 10);
    if (isNaN(pid)) {
      return null;
    }

    // Verify the process is actually running
    if (!isProcessRunning(pid)) {
      // Stale PID file - clean it up
      unlinkSync(pidFile);
      return null;
    }

    return pid;
  } catch {
    return null;
  }
}

/**
 * Check if the daemon is currently running
 */
export function isRunning(): boolean {
  return getRunningPid() !== null;
}

/**
 * Start the daemon process
 *
 * @returns Object with success status and message
 */
export async function startDaemon(): Promise<{ success: boolean; message: string }> {
  // Check if already running
  const existingPid = getRunningPid();
  if (existingPid !== null) {
    return {
      success: false,
      message: `Orchid is already running (PID: ${existingPid})`,
    };
  }

  // Check for corrupted setup: PID file exists but main directory doesn't
  const pidFile = getPidFile();
  const mainRepoDir = getMainRepoDir();
  if (existsSync(pidFile) && !existsSync(mainRepoDir)) {
    return {
      success: false,
      message: "Orchid workspace is corrupted: PID file exists but main repository directory is missing. Please reinitialize with 'orchid init <repository-url>'.",
    };
  }

  // Validate orchid structure if this is an initialized workspace
  if (existsSync(getMainRepoDir())) {
    if (!validateOrchidStructure()) {
      return {
        success: false,
        message: "Orchid workspace is not properly initialized. Please run 'orchid init <repository-url>' to set up the workspace.",
      };
    }
  }

  // Get directory-specific paths
  const orchidDir = getOrchidDir();
  const logFile = getLogFile();
  const errorLogFile = getErrorLogFile();

  // Ensure orchid directory exists
  if (!existsSync(orchidDir)) {
    mkdirSync(orchidDir, { recursive: true });
  }

  // Find the daemon script and determine if we're in dev mode
  // Note: When running from a compiled binary, __dirname points to the virtual filesystem
  // (/$bunfs/root), so we need to detect this and find the actual source directory
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const isCompiledBinary = import.meta.url.includes('/$bunfs/');
  
  // For compiled binaries, we need the ORCHID_SOURCE_DIR env var set
  // to know where the orchid source code is located
  if (isCompiledBinary && !process.env.ORCHID_SOURCE_DIR) {
    return {
      success: false,
      message: "Cannot start daemon from compiled binary without ORCHID_SOURCE_DIR. " +
        "Please set the environment variable to your orchid source directory:\n\n" +
        "  ORCHID_SOURCE_DIR=/path/to/orchid orchid up\n\n" +
        "For example:\n" +
        "  ORCHID_SOURCE_DIR=/home/bob/orchid orchid up",
    };
  }
  
  // Use env var for source directory (required for compiled binaries)
  // For dev/prod, calculate from __dirname - the file is at src/core/files/process.ts
  // so we go up 3 levels to get to the repo root
  const orchidSourceDir = process.env.ORCHID_SOURCE_DIR || join(__dirname, "..", "..", "..");
  
  const daemonScript = join(orchidSourceDir, "dist", "cliMain.js");
  const devDaemonScript = join(orchidSourceDir, "src", "cliMain.ts");
  const isDev = !existsSync(daemonScript);

  // Open log files
  const outFd = openSync(logFile, "a");
  const errFd = openSync(errorLogFile, "a");

  // Write timestamps to log files
  const timestamp = new Date().toISOString();
  writeSync(outFd, `[${timestamp}] Starting orchid daemon\n`);
  writeSync(errFd, `[${timestamp}] Starting orchid daemon\n`);

  try {
    let child;

    // Find bun executable (bun might not be in PATH when running directly)
    const bunPaths = [
      "/home/bob/.bun/bin/bun",
      "/usr/local/bin/bun",
      "/usr/bin/bun",
    ];
    const bunPath = bunPaths.find(p => existsSync(p)) || "bun";

    // Set PI_PACKAGE_DIR for the Pi SDK so it can find its assets
    // The Pi SDK needs to know where to find package.json and other files
    const piPackageDir = join(orchidSourceDir, "node_modules", "@mariozechner", "pi-coding-agent");

    if (isDev) {
      child = spawn(bunPath, [devDaemonScript], {
        detached: true,
        stdio: ["ignore", outFd, errFd],
        env: {
          ...process.env,
          PI_PACKAGE_DIR: piPackageDir,
        },
      });
    } else {
      child = spawn(bunPath, [daemonScript], {
        detached: true,
        stdio: ["ignore", outFd, errFd],
        env: {
          ...process.env,
          PI_PACKAGE_DIR: piPackageDir,
        },
      });
    }

    // Let the child run independently
    child.unref();

    // Wait a moment for the daemon to start and write its PID
    // Note: Pi SDK takes ~1 second to initialize
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Verify it started
    const pid = getRunningPid();
    if (pid !== null) {
      return {
        success: true,
        message: `Orchid started (PID: ${pid})\nLogs: ${logFile}`,
      };
    } else {
      return {
        success: false,
        message: `Failed to start orchid. Check logs at ${errorLogFile}`,
      };
    }
  } finally {
    closeSync(outFd);
    closeSync(errFd);
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Stop the running daemon
 */
export async function stopDaemon(): Promise<{ success: boolean; message: string }> {
  const pid = getRunningPid();

  if (pid === null) {
    return {
      success: false,
      message: "Orchid is not running",
    };
  }

  try {
    process.kill(pid, "SIGTERM");

    for (let i = 0; i < 10; i++) {
      if (!isProcessRunning(pid)) break;
      await sleep(100);
    }

    if (isProcessRunning(pid)) {
      process.kill(pid, "SIGKILL");
    }

    const pidFile = getPidFile();
    if (existsSync(pidFile)) {
      unlinkSync(pidFile);
    }

    return {
      success: true,
      message: `Orchid stopped (was PID: ${pid})`,
    };
  } catch (err) {
    return {
      success: false,
      message: `Failed to stop orchid: ${err}`,
    };
  }
}

/**
 * Get status information about the daemon
 */
export function getStatus(): {
  running: boolean;
  pid: number | null;
} {
  const pid = getRunningPid();
  return {
    running: pid !== null,
    pid,
  };
}
