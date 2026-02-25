import { join, resolve } from "node:path";

/**
 * Base directory for orchid configuration and state (per-directory)
 */
export function getOrchidDir(cwdProvider: () => string = () => process.cwd()): string {
  return join(resolve(cwdProvider()), '.orchid');
}

/**
 * Path to the PID file that tracks the running daemon (per-directory)
 */
export function getPidFile(cwdProvider?: () => string): string {
  return join(getOrchidDir(cwdProvider), 'orchid.pid');
}

/**
 * Path to the log file for daemon output (per-directory)
 */
export function getLogFile(cwdProvider?: () => string): string {
  return join(getOrchidDir(cwdProvider), 'orchid.log');
}

/**
 * Path to the error log file (per-directory)
 */
export function getErrorLogFile(cwdProvider?: () => string): string {
  return join(getOrchidDir(cwdProvider), 'orchid.error.log');
}

/**
 * Path to the main repository clone
 */
export function getMainRepoDir(cwdProvider?: () => string): string {
  return join(getOrchidDir(cwdProvider), 'main');
}

/**
 * Path to the worktrees directory
 */
export function getWorktreesDir(cwdProvider?: () => string): string {
  return join(resolve(cwdProvider ? cwdProvider() : process.cwd()), 'worktrees');
}

// Legacy exports for backward compatibility
export const ORCHID_DIR = getOrchidDir();
export const PID_FILE = getPidFile();
export const LOG_FILE = getLogFile();
export const ERROR_LOG_FILE = getErrorLogFile();
