/**
 * Tests for git-manager.ts module
 * Tests git operations with dependency injection for mocking
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import type { SimpleGit } from 'simple-git';
import { 
  ProductionGitOperations, 
  MockGitOperations, 
  cloneRepository, 
  getRepositoryInfo,
  defaultGitOperations 
} from './manager.js';

// Mock simple-git module
vi.mock('simple-git', () => ({
  default: vi.fn()
}));

// Import the mocked module to configure it
import simpleGit from 'simple-git';

describe('git-manager.ts - Git Operations', () => {
  describe('ProductionGitOperations', () => {
    let gitOps: ProductionGitOperations;
    let mockClone: Mock;

    beforeEach(() => {
      vi.clearAllMocks();
      gitOps = new ProductionGitOperations();
      mockClone = vi.fn().mockResolvedValue(undefined);
      (simpleGit as Mock).mockReturnValue({
        clone: mockClone
      } as unknown as SimpleGit);
    });

    describe('validateRepoUrl', () => {
      it('should validate HTTPS git URLs', () => {
        expect(gitOps.validateRepoUrl('https://github.com/user/repo.git')).toBe(true);
        expect(gitOps.validateRepoUrl('https://gitlab.com/user/repo.git')).toBe(true);
        expect(gitOps.validateRepoUrl('http://github.com/user/repo.git')).toBe(true);
      });

      it('should validate SSH git URLs', () => {
        expect(gitOps.validateRepoUrl('git@github.com:user/repo.git')).toBe(true);
        expect(gitOps.validateRepoUrl('git@gitlab.com:user/repo.git')).toBe(true);
      });

      it('should validate HTTPS URLs without .git extension', () => {
        expect(gitOps.validateRepoUrl('https://github.com/user/repo')).toBe(true);
        expect(gitOps.validateRepoUrl('https://gitlab.com/user/repo')).toBe(true);
      });

      it('should reject invalid URLs', () => {
        expect(gitOps.validateRepoUrl('not-a-url')).toBe(false);
        expect(gitOps.validateRepoUrl('ftp://example.com/repo.git')).toBe(false);
        expect(gitOps.validateRepoUrl('')).toBe(false);
        expect(gitOps.validateRepoUrl('github.com/user/repo')).toBe(false);
      });

      it('should handle edge cases', () => {
        expect(gitOps.validateRepoUrl('https://github.com/')).toBe(false);
        expect(gitOps.validateRepoUrl('https://github.com/user')).toBe(false);
        expect(gitOps.validateRepoUrl('git@')).toBe(false);
      });
    });

    describe('clone', () => {
      it('should call simple-git clone with correct parameters', async () => {
        const repoUrl = 'https://github.com/user/repo.git';
        const targetDir = '/tmp/repo';
        
        await gitOps.clone(repoUrl, targetDir);
        
        expect(simpleGit).toHaveBeenCalled();
        expect(mockClone).toHaveBeenCalledWith(repoUrl, targetDir);
      });

      it('should throw when clone fails', async () => {
        mockClone.mockRejectedValueOnce(new Error('Clone failed'));
        
        await expect(gitOps.clone('https://github.com/user/repo.git', '/tmp/repo'))
          .rejects.toThrow('Clone failed');
      });
    });
  });

  describe('MockGitOperations', () => {
    describe('successful operations', () => {
      let gitOps: MockGitOperations;

      beforeEach(() => {
        gitOps = new MockGitOperations();
      });

      it('should validate simple URLs', () => {
        expect(gitOps.validateRepoUrl('user/repo')).toBe(true);
        expect(gitOps.validateRepoUrl('github.com/user/repo')).toBe(true);
      });

      it('should reject invalid simple URLs', () => {
        expect(gitOps.validateRepoUrl('')).toBe(false);
        expect(gitOps.validateRepoUrl('user')).toBe(false);
        expect(gitOps.validateRepoUrl('a')).toBe(false);
      });

      it('should perform mock clone successfully', async () => {
        await expect(gitOps.clone('user/repo', '/tmp/repo'))
          .resolves.not.toThrow();
      });
    });

    describe('failing operations', () => {
      let gitOps: MockGitOperations;

      beforeEach(() => {
        gitOps = new MockGitOperations(true); // Set clone to fail
      });

      it('should fail clone when configured to do so', async () => {
        await expect(gitOps.clone('user/repo', '/tmp/repo'))
          .rejects.toThrow('Mock git clone failed');
      });
    });
  });

  describe('cloneRepository', () => {
    it('should reject invalid URLs', async () => {
      const mockGitOps = new MockGitOperations();
      const result = await cloneRepository('invalid-url', '/tmp/repo', mockGitOps);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid git repository URL');
    });

    it('should handle clone failures', async () => {
      const mockGitOps = new MockGitOperations(true); // Configure to fail
      const result = await cloneRepository('valid/repo', '/tmp/repo', mockGitOps);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to clone repository');
    });

    it('should succeed with valid URL and successful clone', async () => {
      const mockGitOps = new MockGitOperations();
      const result = await cloneRepository('valid/repo', '/tmp/repo', mockGitOps);
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Successfully cloned');
    });

    it('should use default git operations when none provided', async () => {
      // Mock the clone call to succeed
      const mockClone = vi.fn().mockResolvedValue(undefined);
      (simpleGit as Mock).mockReturnValue({
        clone: mockClone
      } as unknown as SimpleGit);
      
      const result = await cloneRepository('https://github.com/user/repo.git', '/tmp/repo');
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Successfully cloned');
      expect(mockClone).toHaveBeenCalledWith('https://github.com/user/repo.git', '/tmp/repo');
    });
  });

  describe('getRepositoryInfo', () => {
    it('should return null (TODO)', () => {
      expect(getRepositoryInfo('https://github.com/user/repo.git')).toBe(null);
      expect(getRepositoryInfo('git@github.com:user/repo.git')).toBe(null);
    });
  });

  describe('defaultGitOperations', () => {
    it('should be an instance of ProductionGitOperations', () => {
      expect(defaultGitOperations).toBeInstanceOf(ProductionGitOperations);
    });
  });
});
