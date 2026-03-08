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

  it('should add provider non-interactively with all flags', async () => {
    mockAddProvider.mockImplementation(() => {});

    await providerAddAction(
      { url: 'https://api.example.com', 'api-key': 'secret-key-1234' },
      'test-provider'
    );

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

    await providerAddAction(
      { url: 'https://api.example.com' },
      'test-provider'
    );

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

  it('should prompt for URL interactively when not provided', async () => {
    mockInputPrompt.mockResolvedValue('https://interactive.example.com');
    mockSecretPrompt.mockResolvedValue('interactive-api-key');
    mockAddProvider.mockImplementation(() => {});

    await providerAddAction({}, 'interactive-provider');

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
    mockInputPrompt.mockResolvedValue('https://api.example.com');
    mockSecretPrompt.mockResolvedValue('');
    mockAddProvider.mockImplementation(() => {});

    await providerAddAction({}, 'no-key-provider');

    expect(mockAddProvider).toHaveBeenCalledWith({
      name: 'no-key-provider',
      auth: {
        url: 'https://api.example.com',
        apiKey: undefined,
      },
    });
  });

  it('should exit with error if provider already exists', async () => {
    mockGetAllProviders.mockReturnValue([
      { name: 'existing-provider', auth: { url: 'https://api.example.com' } },
    ]);

    await expect(providerAddAction(
      { url: 'https://api.example.com' },
      'existing-provider'
    )).rejects.toThrow('process.exit called with code 1');

    expect(mockConsoleError).toHaveBeenCalledWith('Error: Provider "existing-provider" already exists');
    expect(mockAddProvider).not.toHaveBeenCalled();
  });

  it('should exit with error if URL is invalid', async () => {
    await expect(providerAddAction(
      { url: 'not-a-valid-url' },
      'bad-url-provider'
    )).rejects.toThrow('process.exit called with code 1');

    expect(mockConsoleError).toHaveBeenCalledWith('Error: Invalid URL format: "not-a-valid-url"');
    expect(mockAddProvider).not.toHaveBeenCalled();
  });

  it('should handle errors from model repository', async () => {
    mockAddProvider.mockImplementation(() => {
      throw new Error('Database error');
    });

    await expect(providerAddAction(
      { url: 'https://api.example.com' },
      'error-provider'
    )).rejects.toThrow('process.exit called with code 1');

    expect(mockConsoleError).toHaveBeenCalledWith('Error: Database error');
  });

  it('should mask short API keys completely', async () => {
    mockAddProvider.mockImplementation(() => {});

    await providerAddAction(
      { url: 'https://api.example.com', 'api-key': '1234' },
      'short-key-provider'
    );

    expect(mockConsoleLog).toHaveBeenCalledWith('  API Key: ****');
  });
});

describe('provider remove command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should remove provider successfully', async () => {
    mockGetAllProviders.mockReturnValue([
      { name: 'test-provider', auth: { url: 'https://api.example.com' } },
    ]);
    mockRemoveProvider.mockReturnValue(true);

    await providerRemoveAction({}, 'test-provider');

    expect(mockRemoveProvider).toHaveBeenCalledWith('test-provider');
    expect(mockConsoleLog).toHaveBeenCalledWith('Successfully removed provider "test-provider"');
  });

  it('should exit with error if provider does not exist', async () => {
    mockGetAllProviders.mockReturnValue([
      { name: 'other-provider', auth: { url: 'https://api.example.com' } },
    ]);

    await expect(providerRemoveAction({}, 'nonexistent-provider')).rejects.toThrow('process.exit called with code 1');

    expect(mockConsoleError).toHaveBeenCalledWith('Error: Provider "nonexistent-provider" not found');
    expect(mockRemoveProvider).not.toHaveBeenCalled();
  });

  it('should exit with error if removeProvider returns false', async () => {
    mockGetAllProviders.mockReturnValue([
      { name: 'test-provider', auth: { url: 'https://api.example.com' } },
    ]);
    mockRemoveProvider.mockReturnValue(false);

    await expect(providerRemoveAction({}, 'test-provider')).rejects.toThrow('process.exit called with code 1');

    expect(mockConsoleError).toHaveBeenCalledWith('Error: Provider "test-provider" not found');
  });

  it('should handle errors from model repository', async () => {
    mockGetAllProviders.mockReturnValue([
      { name: 'test-provider', auth: { url: 'https://api.example.com' } },
    ]);
    mockRemoveProvider.mockImplementation(() => {
      throw new Error('Provider in use by 2 model(s)');
    });

    await expect(providerRemoveAction({}, 'test-provider')).rejects.toThrow('process.exit called with code 1');

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
    expect(mockConsoleLog).toHaveBeenCalledWith('Use "orchid provider add <name>" to add a provider.');
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
