import { describe, it, expect, beforeEach, vi } from 'vitest';
import { providerAddAction, providerRemoveAction, providerListAction } from './provider.js';

const { mockGetAllProviders, mockAddProvider, mockRemoveProvider } = vi.hoisted(() => ({
  mockGetAllProviders: vi.fn(),
  mockAddProvider: vi.fn(),
  mockRemoveProvider: vi.fn(),
}));

const { mockInputPrompt } = vi.hoisted(() => ({
  mockInputPrompt: vi.fn(),
}));

const { mockSecretPrompt } = vi.hoisted(() => ({
  mockSecretPrompt: vi.fn(),
}));

const { mockSelectPrompt } = vi.hoisted(() => ({
  mockSelectPrompt: vi.fn(),
}));

vi.mock("../../agent-framework/models/model-repository.js", () => ({
  createModelRepository: vi.fn(() => ({
    getAllProviders: mockGetAllProviders,
    addProvider: mockAddProvider,
    removeProvider: mockRemoveProvider,
  })),
}));

vi.mock("@cliffy/prompt/input", () => ({
  Input: {
    prompt: mockInputPrompt,
  },
}));

vi.mock("@cliffy/prompt/secret", () => ({
  Secret: {
    prompt: mockSecretPrompt,
  },
}));

vi.mock("@cliffy/prompt/select", () => ({
  Select: {
    prompt: mockSelectPrompt,
  },
}));

const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
const mockExit = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
  throw new Error(`process.exit called with code ${code ?? 'undefined'}`);
});

describe('provider add command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAllProviders.mockReturnValue([]);
  });

  it('should add provider non-interactively with all required flags', async () => {
    mockAddProvider.mockImplementation(() => {});

    await providerAddAction({
      name: 'test-provider',
      url: 'https://api.example.com',
      'api-key': 'secret-key-1234',
    });

    expect(mockAddProvider).toHaveBeenCalledWith({
      name: 'test-provider',
      auth: {
        url: 'https://api.example.com',
        apiKey: 'secret-key-1234',
      },
    });
    expect(mockConsoleLog).toHaveBeenCalledWith('Successfully added provider "test-provider"');
    expect(mockConsoleLog).toHaveBeenCalledWith('  URL: https://api.example.com');
    expect(mockConsoleLog).toHaveBeenCalledWith('  API Key: ****1234');
  });

  it('should add provider without API key when not provided', async () => {
    mockAddProvider.mockImplementation(() => {});

    await providerAddAction({
      name: 'test-provider',
      url: 'https://api.example.com',
    });

    expect(mockAddProvider).toHaveBeenCalledWith({
      name: 'test-provider',
      auth: {
        url: 'https://api.example.com',
        apiKey: undefined,
      },
    });
    expect(mockConsoleLog).toHaveBeenCalledWith('Successfully added provider "test-provider"');
    expect(mockConsoleLog).toHaveBeenCalledWith('  API Key: (not set)');
  });

  it('should enter interactive mode when no flags provided', async () => {
    mockInputPrompt
      .mockResolvedValueOnce('interactive-provider')
      .mockResolvedValueOnce('https://interactive.example.com');
    mockSecretPrompt.mockResolvedValue('interactive-api-key');
    mockAddProvider.mockImplementation(() => {});

    await providerAddAction({});

    expect(mockInputPrompt).toHaveBeenCalledWith({
      message: 'Enter the provider name:',
      validate: expect.any(Function),
    });
    expect(mockInputPrompt).toHaveBeenCalledWith({
      message: 'Enter the API URL for provider "interactive-provider":',
      validate: expect.any(Function),
    });
    expect(mockSecretPrompt).toHaveBeenCalledWith({
      message: 'Enter the API key for provider "interactive-provider" (leave empty if not required):',
      minLength: 0,
    });
    expect(mockAddProvider).toHaveBeenCalledWith({
      name: 'interactive-provider',
      auth: {
        url: 'https://interactive.example.com',
        apiKey: 'interactive-api-key',
      },
    });
  });

  it('should handle empty API key from interactive prompt', async () => {
    mockInputPrompt
      .mockResolvedValueOnce('no-key-provider')
      .mockResolvedValueOnce('https://api.example.com');
    mockSecretPrompt.mockResolvedValue('');
    mockAddProvider.mockImplementation(() => {});

    await providerAddAction({});

    expect(mockAddProvider).toHaveBeenCalledWith({
      name: 'no-key-provider',
      auth: {
        url: 'https://api.example.com',
        apiKey: undefined,
      },
    });
  });

  it('should exit with error when only --name provided', async () => {
    await expect(providerAddAction({
      name: 'test-provider',
    })).rejects.toThrow('process.exit called with code 1');

    expect(mockConsoleError).toHaveBeenCalledWith('Error: Both --name and --url are required');
    expect(mockConsoleError).toHaveBeenCalledWith('Usage: orchid provider add --name <name> --url <url> [--api-key <key>]');
    expect(mockConsoleError).toHaveBeenCalledWith('   or: orchid provider add    (for interactive mode)');
    expect(mockAddProvider).not.toHaveBeenCalled();
  });

  it('should exit with error when only --url provided', async () => {
    await expect(providerAddAction({
      url: 'https://api.example.com',
    })).rejects.toThrow('process.exit called with code 1');

    expect(mockConsoleError).toHaveBeenCalledWith('Error: Both --name and --url are required');
    expect(mockAddProvider).not.toHaveBeenCalled();
  });

  it('should exit with error if provider already exists', async () => {
    mockGetAllProviders.mockReturnValue([
      { name: 'existing-provider', auth: { url: 'https://api.example.com' } },
    ]);

    await expect(providerAddAction({
      name: 'existing-provider',
      url: 'https://api.example.com',
    })).rejects.toThrow('process.exit called with code 1');

    expect(mockConsoleError).toHaveBeenCalledWith('Error: Provider "existing-provider" already exists');
    expect(mockAddProvider).not.toHaveBeenCalled();
  });

  it('should exit with error if URL is invalid', async () => {
    await expect(providerAddAction({
      name: 'bad-url-provider',
      url: 'not-a-valid-url',
    })).rejects.toThrow('process.exit called with code 1');

    expect(mockConsoleError).toHaveBeenCalledWith('Error: Invalid URL format: "not-a-valid-url"');
    expect(mockAddProvider).not.toHaveBeenCalled();
  });

  it('should handle errors from model repository', async () => {
    mockAddProvider.mockImplementation(() => {
      throw new Error('Database error');
    });

    await expect(providerAddAction({
      name: 'error-provider',
      url: 'https://api.example.com',
    })).rejects.toThrow('process.exit called with code 1');

    expect(mockConsoleError).toHaveBeenCalledWith('Error: Database error');
  });

  it('should mask short API keys completely', async () => {
    mockAddProvider.mockImplementation(() => {});

    await providerAddAction({
      name: 'short-key-provider',
      url: 'https://api.example.com',
      'api-key': '1234',
    });

    expect(mockConsoleLog).toHaveBeenCalledWith('  API Key: ****');
  });
});

describe('provider remove command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should remove provider interactively when no --name flag provided', async () => {
    mockGetAllProviders.mockReturnValue([
      { name: 'anthropic', auth: { url: 'https://api.anthropic.com' } },
      { name: 'openai', auth: { url: 'https://api.openai.com' } },
    ]);
    mockSelectPrompt.mockResolvedValue('anthropic');
    mockRemoveProvider.mockReturnValue(true);

    await providerRemoveAction({});

    expect(mockSelectPrompt).toHaveBeenCalledWith({
      message: 'Select a provider to remove:',
      options: [
        { value: 'anthropic', name: 'anthropic (https://api.anthropic.com)' },
        { value: 'openai', name: 'openai (https://api.openai.com)' },
      ],
    });
    expect(mockRemoveProvider).toHaveBeenCalledWith('anthropic');
    expect(mockConsoleLog).toHaveBeenCalledWith('Successfully removed provider "anthropic"');
  });

  it('should exit with error when no providers configured in interactive mode', async () => {
    mockGetAllProviders.mockReturnValue([]);

    await expect(providerRemoveAction({})).rejects.toThrow('process.exit called with code 1');

    expect(mockConsoleError).toHaveBeenCalledWith('Error: No providers configured.');
    expect(mockRemoveProvider).not.toHaveBeenCalled();
  });

  it('should remove provider successfully with --name flag', async () => {
    mockGetAllProviders.mockReturnValue([
      { name: 'test-provider', auth: { url: 'https://api.example.com' } },
    ]);
    mockRemoveProvider.mockReturnValue(true);

    await providerRemoveAction({ name: 'test-provider' });

    expect(mockRemoveProvider).toHaveBeenCalledWith('test-provider');
    expect(mockConsoleLog).toHaveBeenCalledWith('Successfully removed provider "test-provider"');
  });

  it('should exit with error if provider does not exist', async () => {
    mockGetAllProviders.mockReturnValue([
      { name: 'other-provider', auth: { url: 'https://api.example.com' } },
    ]);

    await expect(providerRemoveAction({ name: 'nonexistent-provider' })).rejects.toThrow('process.exit called with code 1');

    expect(mockConsoleError).toHaveBeenCalledWith('Error: Provider "nonexistent-provider" not found');
    expect(mockRemoveProvider).not.toHaveBeenCalled();
  });

  it('should exit with error if removeProvider returns false', async () => {
    mockGetAllProviders.mockReturnValue([
      { name: 'test-provider', auth: { url: 'https://api.example.com' } },
    ]);
    mockRemoveProvider.mockReturnValue(false);

    await expect(providerRemoveAction({ name: 'test-provider' })).rejects.toThrow('process.exit called with code 1');

    expect(mockConsoleError).toHaveBeenCalledWith('Error: Provider "test-provider" not found');
  });

  it('should handle errors from model repository', async () => {
    mockGetAllProviders.mockReturnValue([
      { name: 'test-provider', auth: { url: 'https://api.example.com' } },
    ]);
    mockRemoveProvider.mockImplementation(() => {
      throw new Error('Provider in use by 2 model(s)');
    });

    await expect(providerRemoveAction({ name: 'test-provider' })).rejects.toThrow('process.exit called with code 1');

    expect(mockConsoleError).toHaveBeenCalledWith('Error: Provider in use by 2 model(s)');
  });
});

describe('provider list command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display message when no providers configured', async () => {
    mockGetAllProviders.mockReturnValue([]);

    await providerListAction();

    expect(mockConsoleLog).toHaveBeenCalledWith('No providers configured.');
    expect(mockConsoleLog).toHaveBeenCalledWith('Use "orchid provider add" to add a provider.');
  });

  it('should list providers with masked API keys', async () => {
    mockGetAllProviders.mockReturnValue([
      { name: 'anthropic', auth: { url: 'https://api.anthropic.com', apiKey: 'sk-ant-1234567890abcdef' } },
      { name: 'openai', auth: { url: 'https://api.openai.com', apiKey: 'sk-openai-key' } },
      { name: 'local', auth: { url: 'http://localhost:8080' } },
    ]);

    await providerListAction();

    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('anthropic'));
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('https://api.anthropic.com'));
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('****cdef'));
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('openai'));
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('****-key'));
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('local'));
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('(not set)'));
    expect(mockConsoleLog).toHaveBeenCalledWith('\nTotal providers: 3');
  });

  it('should handle providers with short API keys', async () => {
    mockGetAllProviders.mockReturnValue([
      { name: 'test', auth: { url: 'https://api.example.com', apiKey: '1234' } },
    ]);

    await providerListAction();

    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('****'));
  });
});
