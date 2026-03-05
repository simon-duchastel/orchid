/**
 * Files Module
 * 
 * File operations and directory management for orchid
 */

export {
  initializeOrchid,
  isOrchidInitialized,
  validateOrchidStructure,
  createOrchidStructure,
  isDirectoryEmpty,
} from './orchidDir.js';
export type { InitResult, InitializeOrchidOptions } from './orchidDir.js';

export {
  getOrchidDir,
  getPidFile,
  getLogFile,
  getErrorLogFile,
  getMainRepoDir,
  getWorktreesDir,
  ORCHID_DIR,
  PID_FILE,
  LOG_FILE,
  ERROR_LOG_FILE,
} from './paths.js';

export {
  startDaemon,
  stopDaemon,
  getStatus,
  getRunningPid,
  isRunning,
} from './process.js';
