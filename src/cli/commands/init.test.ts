import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initAction } from './init';

const { mockInitializeOrchid } = vi.hoisted(() => ({
  mockInitializeOrchid: vi.fn(),
}));

const { mockIsDirectoryEmpty, mockPromptForConfirmation } = vi.hoisted(() => ({
  mockIsDirectoryEmpty: vi.fn(),
  mockPromptForConfirmation: vi.fn(),
}));

vi.mock("../../commands/init/init", () => ({
  initializeOrchid: mockInitializeOrchid,
}));

vi.mock("../../utils/fs-utils", () => ({
  isDirectoryEmpty: mockIsDirectoryEmpty,
  promptForConfirmation: mockPromptForConfirmation,
}));

const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockExit = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
  throw new Error(`process.exit called with code ${code ?? 'undefined'}`);
});

describe('init command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDirectoryEmpty.mockReturnValue(true);
    mockPromptForConfirmation.mockResolvedValue(false);
  });

  it('should initialize orchid successfully in empty directory', async () => {
    mockInitializeOrchid.mockResolvedValue({
      success: true,
      message: 'Successfully initialized orchid',
    });

    await initAction('https://github.com/user/repo.git');

    expect(mockIsDirectoryEmpty).toHaveBeenCalled();
    expect(mockPromptForConfirmation).not.toHaveBeenCalled();
    expect(mockInitializeOrchid).toHaveBeenCalledWith('https://github.com/user/repo.git');
    expect(mockConsoleLog).toHaveBeenCalledWith('Successfully initialized orchid');
  });

  it('should prompt user when directory is not empty and proceed if confirmed', async () => {
    mockIsDirectoryEmpty.mockReturnValue(false);
    mockPromptForConfirmation.mockResolvedValue(true);
    mockInitializeOrchid.mockResolvedValue({
      success: true,
      message: 'Successfully initialized orchid',
    });

    await initAction('https://github.com/user/repo.git');

    expect(mockIsDirectoryEmpty).toHaveBeenCalled();
    expect(mockPromptForConfirmation).toHaveBeenCalledWith(
      "This directory is not empty. Orchid will clone the repository in this directory and create lots of other files. It's best run in an empty directory - are you sure you want to proceed?",
      false
    );
    expect(mockInitializeOrchid).toHaveBeenCalledWith('https://github.com/user/repo.git');
    expect(mockConsoleLog).toHaveBeenCalledWith('Successfully initialized orchid');
  });

  it('should cancel initialization when user declines non-empty directory', async () => {
    mockIsDirectoryEmpty.mockReturnValue(false);
    mockPromptForConfirmation.mockResolvedValue(false);

    await expect(initAction('https://github.com/user/repo.git'))
      .rejects.toThrow('process.exit called with code 0');

    expect(mockIsDirectoryEmpty).toHaveBeenCalled();
    expect(mockPromptForConfirmation).toHaveBeenCalled();
    expect(mockConsoleLog).toHaveBeenCalledWith('Initialization cancelled.');
    expect(mockInitializeOrchid).not.toHaveBeenCalled();
  });

  it('should exit with code 1 on failure', async () => {
    mockInitializeOrchid.mockResolvedValue({
      success: false,
      message: 'Initialization failed',
    });

    await expect(initAction('https://github.com/user/repo.git'))
      .rejects.toThrow('process.exit called with code 1');

    expect(mockConsoleLog).toHaveBeenCalledWith('Initialization failed');
  });
});
