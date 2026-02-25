/**
 * Tests for paths.ts module
 * These tests focus on pure functions we extracted for testability
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getOrchidDir,
  getPidFile,
  getLogFile,
  getErrorLogFile,
  getMainRepoDir,
  getWorktreesDir,
} from './paths';

describe('paths.ts - Pure Functions', () => {
  describe('getOrchidDir', () => {
    it('should use provided cwd provider', () => {
      const mockCwd = '/mock/current/directory';
      const orchidDir = getOrchidDir(() => mockCwd);
      expect(orchidDir).toBe('/mock/current/directory/.orchid');
    });

    it('should handle nested directories', () => {
      const mockCwd = '/users/test/projects/my-app';
      const orchidDir = getOrchidDir(() => mockCwd);
      expect(orchidDir).toBe('/users/test/projects/my-app/.orchid');
    });

    it('should handle root directory', () => {
      const orchidDir = getOrchidDir(() => '/');
      expect(orchidDir).toBe('/.orchid');
    });
  });

  describe('Path file functions', () => {
    it('should generate correct PID file path', () => {
      const pidFile = getPidFile(() => '/test/directory');
      expect(pidFile).toBe('/test/directory/.orchid/orchid.pid');
    });

    it('should generate correct log file path', () => {
      const logFile = getLogFile(() => '/test/directory');
      expect(logFile).toBe('/test/directory/.orchid/orchid.log');
    });

    it('should generate correct error log file path', () => {
      const errorLogFile = getErrorLogFile(() => '/test/directory');
      expect(errorLogFile).toBe('/test/directory/.orchid/orchid.error.log');
    });

    it('should generate correct main repo directory path', () => {
      const mainRepoDir = getMainRepoDir(() => '/test/directory');
      expect(mainRepoDir).toBe('/test/directory/.orchid/main');
    });

    it('should generate correct worktrees directory path', () => {
      const worktreesDir = getWorktreesDir(() => '/test/directory');
      expect(worktreesDir).toBe('/test/directory/worktrees');
    });
  });

  describe('Integration tests', () => {
    it('should produce consistent results across the full pipeline', () => {
      const mockCwd = '/consistent/project/directory';
      
      const orchidDir1 = getOrchidDir(() => mockCwd);
      const mainRepoDir1 = getMainRepoDir(() => mockCwd);
      const worktreesDir1 = getWorktreesDir(() => mockCwd);
      
      const orchidDir2 = getOrchidDir(() => mockCwd);
      const mainRepoDir2 = getMainRepoDir(() => mockCwd);
      const worktreesDir2 = getWorktreesDir(() => mockCwd);
      
      expect(orchidDir1).toBe(orchidDir2);
      expect(mainRepoDir1).toBe(mainRepoDir2);
      expect(worktreesDir1).toBe(worktreesDir2);
      expect(orchidDir1).toBe('/consistent/project/directory/.orchid');
      expect(mainRepoDir1).toBe('/consistent/project/directory/.orchid/main');
      expect(worktreesDir1).toBe('/consistent/project/directory/worktrees');
    });

    it('should handle edge case paths consistently', () => {
      const edgeCases = [
        '',
        '/',
        '/tmp',
        '/very/deep/nested/path/with/many/segments',
        '/path/with-dashes/and_underscores/and.dots',
        '/path/with/unicode/🚀/characters',
      ];

      edgeCases.forEach(path => {
        const orchidDir = getOrchidDir(() => path);
        expect(orchidDir).toMatch(/\.orchid$/);
        
        // Should be consistent
        const orchidDir2 = getOrchidDir(() => path);
        expect(orchidDir).toBe(orchidDir2);
      });
    });
  });
});
