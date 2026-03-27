/**
 * Tests for process.ts using Bun.spawn
 * Tests with proper mocking using Vitest - no real process spawning
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { startDaemon, stopDaemon, getStatus, getRunningPid, isRunning } from './process.js';

// Mock node:fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn<(path: import('node:fs').PathLike) => boolean>(),
  readFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

import { existsSync, readFileSync, unlinkSync } from 'node:fs';

// Mock orchid-lifecycle module
vi.mock('./index.js', () => ({
  validateOrchidStructure: vi.fn(),
}));

import { validateOrchidStructure } from './index.js';

// Mock paths module
vi.mock('./paths.js', () => ({
  getOrchidDir: () => '/tmp/test-orchid-daemon/.orchid',
  getPidFile: () => '/tmp/test-orchid-daemon/.orchid/orchid.pid',
  getLogFile: () => '/tmp/test-orchid-daemon/.orchid/orchid.log',
  getErrorLogFile: () => '/tmp/test-orchid-daemon/.orchid/orchid.error.log',
  getMainRepoDir: () => '/tmp/test-orchid-daemon/main',
  getWorktreesDir: () => '/tmp/test-orchid-daemon/worktrees',
}));

// Mock Bun
const mockUnref = vi.fn();
const mockSubprocess = {
  unref: mockUnref,
  pid: 12345,
};

declare global {
  // eslint-disable-next-line no-var
  var Bun: {
    spawn: ReturnType<typeof vi.fn>;
  };
}

vi.stubGlobal('Bun', {
  spawn: vi.fn().mockReturnValue(mockSubprocess),
});

describe('process.ts with Bun.spawn', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockUnref.mockClear();
    vi.stubGlobal('Bun', {
      spawn: vi.fn().mockReturnValue(mockSubprocess),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getRunningPid', () => {
    it('should return null when PID file does not exist', () => {
      vi.mocked(existsSync).mockReturnValue(false);
      
      const result = getRunningPid();
      
      expect(result).toBeNull();
    });

    it('should return null when PID file contains invalid data', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('invalid');
      
      const result = getRunningPid();
      
      expect(result).toBeNull();
    });

    it('should return PID when process is running', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('12345');
      
      const mockKill = vi.spyOn(process, 'kill').mockImplementation(() => true);
      
      const result = getRunningPid();
      
      expect(result).toBe(12345);
      
      mockKill.mockRestore();
    });

    it('should clean up stale PID file when process is not running', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('12345');
      
      const mockKill = vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
        if (signal === 0) {
          throw new Error('Process not found');
        }
        return true;
      });
      
      const result = getRunningPid();
      
      expect(result).toBeNull();
      expect(unlinkSync).toHaveBeenCalledWith('/tmp/test-orchid-daemon/.orchid/orchid.pid');
      
      mockKill.mockRestore();
    });
  });

  describe('isRunning', () => {
    it('should return true when daemon is running', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('12345');
      
      const mockKill = vi.spyOn(process, 'kill').mockImplementation(() => true);
      
      const result = isRunning();
      
      expect(result).toBe(true);
      
      mockKill.mockRestore();
    });

    it('should return false when daemon is not running', () => {
      vi.mocked(existsSync).mockReturnValue(false);
      
      const result = isRunning();
      
      expect(result).toBe(false);
    });
  });

  describe('startDaemon', () => {
    it('should return error when daemon is already running', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('12345');
      
      const mockKill = vi.spyOn(process, 'kill').mockImplementation(() => true);
      
      const result = await startDaemon();
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('already running');
      expect(Bun.spawn).not.toHaveBeenCalled();
      
      mockKill.mockRestore();
    });

    it('should return error for corrupted workspace', async () => {
      vi.mocked(existsSync).mockImplementation((path: import('node:fs').PathLike) => {
        if (String(path).includes('orchid.pid')) return true;
        if (String(path).includes('main')) return false;
        return false;
      });
      vi.mocked(readFileSync).mockReturnValue('12345');
      
      const mockKill = vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
        if (signal === 0) {
          throw new Error('Process not found');
        }
        return true;
      });
      
      const result = await startDaemon();
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('corrupted');
      expect(Bun.spawn).not.toHaveBeenCalled();
      
      mockKill.mockRestore();
    });

    it('should return error when validation fails', async () => {
      const mockValidate = vi.mocked(validateOrchidStructure);
      mockValidate.mockReturnValue(false);
      
      vi.mocked(existsSync).mockImplementation((path: import('node:fs').PathLike) => {
        if (String(path).includes('main')) return true;
        return false;
      });
      
      const result = await startDaemon();
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('not properly initialized');
      expect(Bun.spawn).not.toHaveBeenCalled();
    });

    it('should spawn daemon with Bun.spawn when starting successfully', async () => {
      const mockValidate = vi.mocked(validateOrchidStructure);
      mockValidate.mockReturnValue(true);
      
      vi.mocked(existsSync).mockImplementation((path: import('node:fs').PathLike) => {
        if (String(path).includes('main')) return true;
        if (String(path).includes('orchid.pid')) return false;
        return false;
      });
      
      // Start daemon
      const startPromise = startDaemon();
      
      // Advance timers for the polling loop (up to 20 iterations of 100ms)
      await vi.advanceTimersByTimeAsync(2000);
      
      const result = await startPromise;
      
      expect(Bun.spawn).toHaveBeenCalledWith(
        expect.arrayContaining(['bun', 'run']),
        expect.objectContaining({
          detached: true,
          stdio: ['ignore', 'ignore', 'ignore'],
        })
      );
      expect(mockUnref).toHaveBeenCalled();
    });

    it('should verify daemon started by checking PID', async () => {
      const mockValidate = vi.mocked(validateOrchidStructure);
      mockValidate.mockReturnValue(true);
      
      let callCount = 0;
      vi.mocked(existsSync).mockImplementation((path: import('node:fs').PathLike) => {
        callCount++;
        if (String(path).includes('orchid.pid')) {
          return callCount > 3;
        }
        if (String(path).includes('main')) return true;
        return false;
      });
      vi.mocked(readFileSync).mockReturnValue('12345');
      
      const mockKill = vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
        if (signal === 0) {
          return true;
        }
        return true;
      });
      
      const startPromise = startDaemon();
      await vi.advanceTimersByTimeAsync(2000);
      const result = await startPromise;
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Orchid started');
      expect(result.message).toContain('12345');
      
      mockKill.mockRestore();
    });

    it('should return error when daemon fails to start', async () => {
      const mockValidate = vi.mocked(validateOrchidStructure);
      mockValidate.mockReturnValue(true);
      
      vi.mocked(existsSync).mockImplementation((path: import('node:fs').PathLike) => {
        if (String(path).includes('main')) return true;
        return false;
      });
      
      const startPromise = startDaemon();
      await vi.advanceTimersByTimeAsync(2000);
      const result = await startPromise;
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to start');
    });

    it('should handle Bun.spawn throwing an error', async () => {
      const mockValidate = vi.mocked(validateOrchidStructure);
      mockValidate.mockReturnValue(true);
      
      vi.mocked(existsSync).mockImplementation((path: import('node:fs').PathLike) => {
        if (String(path).includes('main')) return true;
        return false;
      });
      
      vi.stubGlobal('Bun', {
        spawn: vi.fn().mockImplementation(() => {
          throw new Error('Spawn failed');
        }),
      });
      
      const result = await startDaemon();
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Spawn failed');
    });
  });

  describe('stopDaemon', () => {
    it('should return error when daemon is not running', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      
      const result = await stopDaemon();
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('not running');
    });

    it('should stop running daemon successfully', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('12345');
      
      let isRunning = true;
      const mockKill = vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
        if (signal === 'SIGTERM') {
          isRunning = false;
          return true;
        }
        if (signal === 0) {
          if (!isRunning) {
            throw new Error('Process not found');
          }
          return true;
        }
        return true;
      });
      
      const result = await stopDaemon();
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('stopped');
      expect(result.message).toContain('12345');
      
      mockKill.mockRestore();
    });

    it('should use SIGKILL if SIGTERM fails', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('12345');
      
      let sigtermReceived = false;
      const mockKill = vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
        if (signal === 'SIGTERM') {
          sigtermReceived = true;
          return true;
        }
        if (signal === 'SIGKILL') {
          return true;
        }
        if (signal === 0) {
          if (!sigtermReceived) {
            return true;
          }
          throw new Error('Process not found');
        }
        return true;
      });
      
      const result = await stopDaemon();
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('stopped');
      
      mockKill.mockRestore();
    }, 10000);

    it('should remove PID file after stopping', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('12345');
      
      const mockKill = vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
        if (signal === 0) {
          throw new Error('Process not found');
        }
        return true;
      });
      
      await stopDaemon();
      
      expect(unlinkSync).toHaveBeenCalledWith('/tmp/test-orchid-daemon/.orchid/orchid.pid');
      
      mockKill.mockRestore();
    });

    it('should handle errors during stop', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('12345');
      
      const mockKill = vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
        if (signal === 0) {
          return true;
        }
        throw new Error('Permission denied');
      });
      
      const result = await stopDaemon();
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Permission denied');
      
      mockKill.mockRestore();
    });
  });

  describe('getStatus', () => {
    it('should return running status with PID', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('12345');
      
      const mockKill = vi.spyOn(process, 'kill').mockImplementation(() => true);
      
      const result = getStatus();
      
      expect(result.running).toBe(true);
      expect(result.pid).toBe(12345);
      
      mockKill.mockRestore();
    });

    it('should return not running status with null PID', () => {
      vi.mocked(existsSync).mockReturnValue(false);
      
      const result = getStatus();
      
      expect(result.running).toBe(false);
      expect(result.pid).toBeNull();
    });
  });
});
