/**
 * Tests for fs-utils module
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isDirectoryEmpty, promptForConfirmation } from './fs-utils';

// Mock node:fs
vi.mock('node:fs', () => ({
  readdirSync: vi.fn(),
  existsSync: vi.fn(),
}));

// Mock node:readline
const mockQuestion = vi.fn();
const mockClose = vi.fn();

vi.mock('node:readline', () => ({
  createInterface: vi.fn(() => ({
    question: mockQuestion,
    close: mockClose,
  })),
}));

import { readdirSync, existsSync } from 'node:fs';

describe('fs-utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isDirectoryEmpty', () => {
    it('should return true when directory does not exist', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = isDirectoryEmpty('/nonexistent/path');

      expect(result).toBe(true);
      expect(existsSync).toHaveBeenCalledWith('/nonexistent/path');
    });

    it('should return true when directory is empty', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue([]);

      const result = isDirectoryEmpty('/empty/path');

      expect(result).toBe(true);
      expect(readdirSync).toHaveBeenCalledWith('/empty/path');
    });

    it('should return false when directory has files', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue(['file1.txt', 'file2.txt'] as any);

      const result = isDirectoryEmpty('/nonempty/path');

      expect(result).toBe(false);
    });

    it('should return true when readdir throws an error', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = isDirectoryEmpty('/inaccessible/path');

      expect(result).toBe(true);
    });
  });

  describe('promptForConfirmation', () => {
    it('should return true when user inputs "y"', async () => {
      mockQuestion.mockImplementation((msg: string, callback: (answer: string) => void) => {
        callback('y');
      });

      const result = await promptForConfirmation('Are you sure?');

      expect(result).toBe(true);
      expect(mockClose).toHaveBeenCalled();
    });

    it('should return true when user inputs "yes"', async () => {
      mockQuestion.mockImplementation((msg: string, callback: (answer: string) => void) => {
        callback('yes');
      });

      const result = await promptForConfirmation('Are you sure?');

      expect(result).toBe(true);
    });

    it('should return false when user inputs "n"', async () => {
      mockQuestion.mockImplementation((msg: string, callback: (answer: string) => void) => {
        callback('n');
      });

      const result = await promptForConfirmation('Are you sure?');

      expect(result).toBe(false);
    });

    it('should return false when user inputs "no"', async () => {
      mockQuestion.mockImplementation((msg: string, callback: (answer: string) => void) => {
        callback('no');
      });

      const result = await promptForConfirmation('Are you sure?');

      expect(result).toBe(false);
    });

    it('should return default value when user presses enter', async () => {
      mockQuestion.mockImplementation((msg: string, callback: (answer: string) => void) => {
        callback('');
      });

      // Default is false
      const resultFalse = await promptForConfirmation('Are you sure?', false);
      expect(resultFalse).toBe(false);

      // Default is true
      const resultTrue = await promptForConfirmation('Are you sure?', true);
      expect(resultTrue).toBe(true);
    });

    it('should handle uppercase inputs', async () => {
      mockQuestion.mockImplementation((msg: string, callback: (answer: string) => void) => {
        callback('Y');
      });

      const result = await promptForConfirmation('Are you sure?');

      expect(result).toBe(true);
    });

    it('should trim whitespace from input', async () => {
      mockQuestion.mockImplementation((msg: string, callback: (answer: string) => void) => {
        callback('  y  ');
      });

      const result = await promptForConfirmation('Are you sure?');

      expect(result).toBe(true);
    });

    it('should return false for unknown input', async () => {
      mockQuestion.mockImplementation((msg: string, callback: (answer: string) => void) => {
        callback('maybe');
      });

      const result = await promptForConfirmation('Are you sure?');

      expect(result).toBe(false);
    });
  });
});
