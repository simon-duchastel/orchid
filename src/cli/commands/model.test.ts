import { describe, it, expect, beforeEach, vi } from 'vitest';
import { modelAddAction, modelRemoveAction, modelListAction } from './model.js';

const { mockGetAllProviders, mockGetAllModels, mockAddModel, mockRemoveModel } = vi.hoisted(() => ({
  mockGetAllProviders: vi.fn(),
  mockGetAllModels: vi.fn(),
  mockAddModel: vi.fn(),
  mockRemoveModel: vi.fn(),
}));

const { mockInputPrompt } = vi.hoisted(() => ({
  mockInputPrompt: vi.fn(),
}));

const { mockSelectPrompt } = vi.hoisted(() => ({
  mockSelectPrompt: vi.fn(),
}));

vi.mock("../../agent-framework/models/model-repository.js", () => ({
  createModelRepository: vi.fn(() => ({
    getAllProviders: mockGetAllProviders,
    getAllModels: mockGetAllModels,
    addModel: mockAddModel,
    removeModel: mockRemoveModel,
  })),
}));

vi.mock("@cliffy/prompt/input", () => ({
  Input: {
    prompt: mockInputPrompt,
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

describe('model add command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAllProviders.mockReturnValue([
      { name: 'anthropic', auth: { url: 'https://api.anthropic.com' } },
      { name: 'openai', auth: { url: 'https://api.openai.com' } },
    ]);
    mockGetAllModels.mockReturnValue([]);
  });

  it('should add model with both --provider and --model flags', async () => {
    mockAddModel.mockImplementation(() => {});

    await modelAddAction({ provider: 'anthropic', model: 'claude-3-opus' });

    expect(mockAddModel).toHaveBeenCalledWith({
      provider: 'anthropic',
      modelId: 'claude-3-opus',
    });
    expect(mockConsoleLog).toHaveBeenCalledWith('Successfully added model "anthropic/claude-3-opus"');
  });

  it('should enter interactive mode when neither flag provided', async () => {
    mockSelectPrompt.mockResolvedValue('anthropic');
    mockInputPrompt.mockResolvedValue('claude-3-opus');
    mockAddModel.mockImplementation(() => {});

    await modelAddAction({});

    expect(mockSelectPrompt).toHaveBeenCalledWith({
      message: 'Select a provider to add the model:',
      options: [
        { value: 'anthropic', name: 'anthropic' },
        { value: 'openai', name: 'openai' },
      ],
    });
    expect(mockInputPrompt).toHaveBeenCalledWith({
      message: 'Enter the model ID:',
      validate: expect.any(Function),
    });
    expect(mockAddModel).toHaveBeenCalledWith({
      provider: 'anthropic',
      modelId: 'claude-3-opus',
    });
    expect(mockConsoleLog).toHaveBeenCalledWith('Successfully added model "anthropic/claude-3-opus"');
  });

  it('should exit with error when only --model provided', async () => {
    await expect(modelAddAction({ model: 'claude-3-opus' })).rejects.toThrow('process.exit called with code 1');

    expect(mockConsoleError).toHaveBeenCalledWith("Error: Both --provider and --model are required");
    expect(mockConsoleError).toHaveBeenCalledWith("Usage: orchid model add --model <model-id> --provider <provider>");
    expect(mockConsoleError).toHaveBeenCalledWith("   or: orchid model add    (for interactive mode)");
    expect(mockAddModel).not.toHaveBeenCalled();
  });

  it('should exit with error when only --provider provided', async () => {
    await expect(modelAddAction({ provider: 'openai' })).rejects.toThrow('process.exit called with code 1');

    expect(mockConsoleError).toHaveBeenCalledWith("Error: Both --provider and --model are required");
    expect(mockConsoleError).toHaveBeenCalledWith("Usage: orchid model add --model <model-id> --provider <provider>");
    expect(mockConsoleError).toHaveBeenCalledWith("   or: orchid model add    (for interactive mode)");
    expect(mockAddModel).not.toHaveBeenCalled();
  });

  it('should exit with error if no providers configured', async () => {
    mockGetAllProviders.mockReturnValue([]);

    await expect(modelAddAction({})).rejects.toThrow('process.exit called with code 1');

    expect(mockConsoleError).toHaveBeenCalledWith("Error: No providers configured. Add a provider first with 'orchid provider add <name>'");
    expect(mockAddModel).not.toHaveBeenCalled();
  });

  it('should exit with error if provider does not exist', async () => {
    mockAddModel.mockImplementation(() => {});

    await expect(modelAddAction({ provider: 'nonexistent', model: 'model-id' })).rejects.toThrow('process.exit called with code 1');

    expect(mockConsoleError).toHaveBeenCalledWith('Error: Provider "nonexistent" not found');
    expect(mockAddModel).not.toHaveBeenCalled();
  });

  it('should exit with error if model already exists', async () => {
    mockGetAllModels.mockReturnValue([
      { provider: 'anthropic', modelId: 'claude-3-opus' },
    ]);

    await expect(modelAddAction({ provider: 'anthropic', model: 'claude-3-opus' })).rejects.toThrow('process.exit called with code 1');

    expect(mockConsoleError).toHaveBeenCalledWith('Error: Model "anthropic/claude-3-opus" already exists');
    expect(mockAddModel).not.toHaveBeenCalled();
  });

  it('should exit with error if model already exists in interactive mode', async () => {
    mockGetAllModels.mockReturnValue([
      { provider: 'anthropic', modelId: 'claude-3-opus' },
    ]);
    mockSelectPrompt.mockResolvedValue('anthropic');
    mockInputPrompt.mockResolvedValue('claude-3-opus');

    await expect(modelAddAction({})).rejects.toThrow('process.exit called with code 1');

    expect(mockConsoleError).toHaveBeenCalledWith('Error: Model "anthropic/claude-3-opus" already exists');
    expect(mockAddModel).not.toHaveBeenCalled();
  });

  it('should handle errors from model repository', async () => {
    mockAddModel.mockImplementation(() => {
      throw new Error('Database error');
    });

    await expect(modelAddAction({ provider: 'anthropic', model: 'claude-3' })).rejects.toThrow('process.exit called with code 1');

    expect(mockConsoleError).toHaveBeenCalledWith('Error: Database error');
  });

  it('should handle errors from model repository in interactive mode', async () => {
    mockSelectPrompt.mockResolvedValue('anthropic');
    mockInputPrompt.mockResolvedValue('claude-3');
    mockAddModel.mockImplementation(() => {
      throw new Error('Database error');
    });

    await expect(modelAddAction({})).rejects.toThrow('process.exit called with code 1');

    expect(mockConsoleError).toHaveBeenCalledWith('Error: Database error');
  });
});

describe('model remove command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAllProviders.mockReturnValue([
      { name: 'anthropic', auth: { url: 'https://api.anthropic.com' } },
      { name: 'openai', auth: { url: 'https://api.openai.com' } },
    ]);
    mockGetAllModels.mockReturnValue([
      { provider: 'anthropic', modelId: 'claude-3-opus' },
      { provider: 'openai', modelId: 'gpt-4' },
    ]);
  });

  it('should remove model with both --provider and --model flags', async () => {
    mockRemoveModel.mockReturnValue(true);

    await modelRemoveAction({ provider: 'anthropic', model: 'claude-3-opus' });

    expect(mockRemoveModel).toHaveBeenCalledWith('anthropic', 'claude-3-opus');
    expect(mockConsoleLog).toHaveBeenCalledWith('Successfully removed model "anthropic/claude-3-opus"');
  });

  it('should enter interactive mode when neither flag provided', async () => {
    mockSelectPrompt.mockResolvedValue('anthropic');
    mockInputPrompt.mockResolvedValue('claude-3-opus');
    mockRemoveModel.mockReturnValue(true);

    await modelRemoveAction({});

    expect(mockSelectPrompt).toHaveBeenCalledWith({
      message: 'Select a provider to remove the model:',
      options: [
        { value: 'anthropic', name: 'anthropic' },
        { value: 'openai', name: 'openai' },
      ],
    });
    expect(mockInputPrompt).toHaveBeenCalledWith({
      message: 'Enter the model ID:',
      validate: expect.any(Function),
    });
    expect(mockRemoveModel).toHaveBeenCalledWith('anthropic', 'claude-3-opus');
  });

  it('should exit with error when only --model provided', async () => {
    await expect(modelRemoveAction({ model: 'claude-3-opus' })).rejects.toThrow('process.exit called with code 1');

    expect(mockConsoleError).toHaveBeenCalledWith("Error: Both --provider and --model are required");
    expect(mockConsoleError).toHaveBeenCalledWith("Usage: orchid model remove --model <model-id> --provider <provider>");
    expect(mockConsoleError).toHaveBeenCalledWith("   or: orchid model remove    (for interactive mode)");
    expect(mockRemoveModel).not.toHaveBeenCalled();
  });

  it('should exit with error when only --provider provided', async () => {
    await expect(modelRemoveAction({ provider: 'openai' })).rejects.toThrow('process.exit called with code 1');

    expect(mockConsoleError).toHaveBeenCalledWith("Error: Both --provider and --model are required");
    expect(mockConsoleError).toHaveBeenCalledWith("Usage: orchid model remove --model <model-id> --provider <provider>");
    expect(mockConsoleError).toHaveBeenCalledWith("   or: orchid model remove    (for interactive mode)");
    expect(mockRemoveModel).not.toHaveBeenCalled();
  });

  it('should exit with error if model not found with provider', async () => {
    mockRemoveModel.mockReturnValue(false);

    await expect(modelRemoveAction({ provider: 'anthropic', model: 'nonexistent' })).rejects.toThrow('process.exit called with code 1');

    expect(mockRemoveModel).toHaveBeenCalledWith('anthropic', 'nonexistent');
    expect(mockConsoleError).toHaveBeenCalledWith('Error: Model "anthropic/nonexistent" not found');
  });

  it('should handle errors from model repository', async () => {
    mockRemoveModel.mockImplementation(() => {
      throw new Error('Model assigned to agent');
    });

    await expect(modelRemoveAction({ provider: 'anthropic', model: 'claude-3-opus' })).rejects.toThrow('process.exit called with code 1');

    expect(mockConsoleError).toHaveBeenCalledWith('Error: Model assigned to agent');
  });
});

describe('model list command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display message when no models configured', async () => {
    mockGetAllModels.mockReturnValue([]);

    await modelListAction({});

    expect(mockConsoleLog).toHaveBeenCalledWith('No models configured.');
    expect(mockConsoleLog).toHaveBeenCalledWith('Use "orchid model add --model <model-id> --provider <provider>" to add a model.');
  });

  it('should list all models', async () => {
    mockGetAllModels.mockReturnValue([
      { provider: 'anthropic', modelId: 'claude-3-opus' },
      { provider: 'anthropic', modelId: 'claude-3-sonnet' },
      { provider: 'openai', modelId: 'gpt-4' },
      { provider: 'openai', modelId: 'gpt-3.5-turbo' },
    ]);

    await modelListAction({});

    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('anthropic'));
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('claude-3-opus'));
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('openai'));
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('gpt-4'));
    expect(mockConsoleLog).toHaveBeenCalledWith('\nTotal models: 4');
  });

  it('should filter models by provider', async () => {
    mockGetAllModels.mockReturnValue([
      { provider: 'anthropic', modelId: 'claude-3-opus' },
      { provider: 'anthropic', modelId: 'claude-3-sonnet' },
      { provider: 'openai', modelId: 'gpt-4' },
    ]);

    await modelListAction({ provider: 'anthropic' });

    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('anthropic'));
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('claude-3-opus'));
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('claude-3-sonnet'));
    expect(mockConsoleLog).toHaveBeenCalledWith('\nTotal models: 2');
    expect(mockConsoleLog).not.toHaveBeenCalledWith(expect.stringContaining('openai'));
  });

  it('should display message when no models for specific provider', async () => {
    mockGetAllModels.mockReturnValue([
      { provider: 'anthropic', modelId: 'claude-3-opus' },
    ]);

    await modelListAction({ provider: 'openai' });

    expect(mockConsoleLog).toHaveBeenCalledWith('No models configured for provider "openai".');
  });

  it('should handle empty list with provider filter', async () => {
    mockGetAllModels.mockReturnValue([]);

    await modelListAction({ provider: 'openai' });

    expect(mockConsoleLog).toHaveBeenCalledWith('No models configured for provider "openai".');
  });
});
