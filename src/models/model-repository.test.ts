import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { AgentType } from "../agent-framework/session-repository.js";
import { ModelRepository, createModelRepository } from "./model-repository.js";
import type { Model, Provider } from "./types.js";

// Mock the fs module
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

const TEST_CONFIG_PATH = "/test/.orchid/config.json";

describe("ModelRepository", () => {
  let repository: ModelRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(mkdirSync).mockImplementation(() => undefined);
    vi.mocked(writeFileSync).mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should create with default path when no options provided", () => {
      repository = createModelRepository();
      expect(repository.getAllModels()).toEqual([]);
      expect(repository.getAllProviders()).toEqual([]);
    });

    it("should use custom path when provided", () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        return path === "/custom/config.json";
      });
      vi.mocked(readFileSync).mockReturnValue('{"providers": [], "models": [{"provider": "test", "modelId": "model"}], "agentModels": {}}');

      repository = createModelRepository({ configPath: "/custom/config.json" });
      
      const models = repository.getAllModels();
      expect(models).toHaveLength(1);
      expect(models[0]).toEqual({ provider: "test", modelId: "model" });
    });

    it("should handle missing config.json gracefully", () => {
      vi.mocked(existsSync).mockReturnValue(false);
      
      repository = createModelRepository({ configPath: TEST_CONFIG_PATH });
      
      expect(repository.getAllModels()).toEqual([]);
      expect(repository.getAllProviders()).toEqual([]);
    });

    it("should handle corrupted config.json gracefully", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue("invalid json");
      
      repository = createModelRepository({ configPath: TEST_CONFIG_PATH });
      
      expect(repository.getAllModels()).toEqual([]);
      expect(repository.getAllProviders()).toEqual([]);
    });
  });

  describe("getAllModels", () => {
    it("should return empty array when no models", () => {
      repository = createModelRepository({ configPath: TEST_CONFIG_PATH });
      expect(repository.getAllModels()).toEqual([]);
    });

    it("should return all models from file", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        providers: [],
        models: [
          { provider: "anthropic", modelId: "claude-3" },
          { provider: "openai", modelId: "gpt-4" }
        ],
        agentModels: {}
      }));

      repository = createModelRepository({ configPath: TEST_CONFIG_PATH });
      
      const models = repository.getAllModels();
      expect(models).toHaveLength(2);
      expect(models[0]).toEqual({ provider: "anthropic", modelId: "claude-3" });
      expect(models[1]).toEqual({ provider: "openai", modelId: "gpt-4" });
    });
  });

  describe("addModel", () => {
    beforeEach(() => {
      repository = createModelRepository({ configPath: TEST_CONFIG_PATH });
    });

    it("should add a model", () => {
      const model: Model = { provider: "anthropic", modelId: "claude-3" };
      
      repository.addModel(model);
      
      expect(repository.getAllModels()).toContainEqual(model);
      expect(writeFileSync).toHaveBeenCalled();
    });

    it("should throw if model already exists", () => {
      const model: Model = { provider: "anthropic", modelId: "claude-3" };
      repository.addModel(model);
      
      expect(() => repository.addModel(model)).toThrow("Model anthropic/claude-3 already exists");
    });

    it("should persist to file", () => {
      const model: Model = { provider: "openai", modelId: "gpt-4" };
      
      repository.addModel(model);
      
      expect(writeFileSync).toHaveBeenCalledWith(
        TEST_CONFIG_PATH,
        expect.stringContaining('"models"')
      );
    });
  });

  describe("removeModel", () => {
    beforeEach(() => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        providers: [],
        models: [
          { provider: "anthropic", modelId: "claude-3" },
          { provider: "openai", modelId: "gpt-4" }
        ],
        agentModels: {}
      }));
      repository = createModelRepository({ configPath: TEST_CONFIG_PATH });
    });

    it("should remove a model", () => {
      const result = repository.removeModel("anthropic", "claude-3");
      
      expect(result).toBe(true);
      expect(repository.getAllModels()).toHaveLength(1);
      expect(repository.getAllModels()[0].modelId).toBe("gpt-4");
    });

    it("should return false if model not found", () => {
      const result = repository.removeModel("unknown", "model");
      
      expect(result).toBe(false);
    });

    it("should throw if model is assigned to an agent", () => {
      // Set up a model assigned to an agent
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        providers: [],
        models: [{ provider: "anthropic", modelId: "claude-3" }],
        agentModels: { [AgentType.IMPLEMENTOR]: { provider: "anthropic", modelId: "claude-3" } }
      }));
      repository = createModelRepository({ configPath: TEST_CONFIG_PATH });
      
      expect(() => repository.removeModel("anthropic", "claude-3"))
        .toThrow("Cannot remove model anthropic/claude-3 - assigned to implementor");
    });

    it("should persist to file after removal", () => {
      repository.removeModel("anthropic", "claude-3");
      
      expect(writeFileSync).toHaveBeenCalled();
    });
  });

  describe("getModelForAgent", () => {
    beforeEach(() => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        providers: [],
        models: [
          { provider: "anthropic", modelId: "claude-3" },
          { provider: "openai", modelId: "gpt-4" }
        ],
        agentModels: {
          [AgentType.IMPLEMENTOR]: { provider: "anthropic", modelId: "claude-3" },
          [AgentType.REVIEWER]: { provider: "openai", modelId: "gpt-4" }
        }
      }));
      repository = createModelRepository({ configPath: TEST_CONFIG_PATH });
    });

    it("should get model for implementor", () => {
      const model = repository.getModelForAgent(AgentType.IMPLEMENTOR);
      
      expect(model).toEqual({ provider: "anthropic", modelId: "claude-3" });
    });

    it("should get model for reviewer", () => {
      const model = repository.getModelForAgent(AgentType.REVIEWER);
      
      expect(model).toEqual({ provider: "openai", modelId: "gpt-4" });
    });

    it("should return undefined if no model set for agent", () => {
      const model = repository.getModelForAgent(AgentType.MERGER);
      
      expect(model).toBeUndefined();
    });
  });

  describe("setModelForAgent", () => {
    beforeEach(() => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        providers: [
          { name: "anthropic", auth: { url: "https://api.anthropic.com" } },
          { name: "openai", auth: { url: "https://api.openai.com" } }
        ],
        models: [
          { provider: "anthropic", modelId: "claude-3" },
          { provider: "openai", modelId: "gpt-4" }
        ],
        agentModels: {}
      }));
      repository = createModelRepository({ configPath: TEST_CONFIG_PATH });
    });

    it("should set model for agent", () => {
      repository.setModelForAgent(AgentType.IMPLEMENTOR, "anthropic", "claude-3");
      
      const model = repository.getModelForAgent(AgentType.IMPLEMENTOR);
      expect(model).toEqual({ provider: "anthropic", modelId: "claude-3" });
    });

    it("should throw if model does not exist", () => {
      expect(() => repository.setModelForAgent(AgentType.IMPLEMENTOR, "unknown", "model"))
        .toThrow("Model unknown/model not found");
    });

    it("should update existing assignment", () => {
      repository.setModelForAgent(AgentType.IMPLEMENTOR, "anthropic", "claude-3");
      repository.setModelForAgent(AgentType.IMPLEMENTOR, "openai", "gpt-4");
      
      const model = repository.getModelForAgent(AgentType.IMPLEMENTOR);
      expect(model).toEqual({ provider: "openai", modelId: "gpt-4" });
    });

    it("should persist to file", () => {
      repository.setModelForAgent(AgentType.IMPLEMENTOR, "anthropic", "claude-3");
      
      expect(writeFileSync).toHaveBeenCalledWith(
        TEST_CONFIG_PATH,
        expect.stringContaining('"implementor"')
      );
    });
  });

  describe("provider methods", () => {
    beforeEach(() => {
      repository = createModelRepository({ configPath: TEST_CONFIG_PATH });
    });

    describe("getAllProviders", () => {
      it("should return empty array when no providers", () => {
        expect(repository.getAllProviders()).toEqual([]);
      });

      it("should return all providers from file", () => {
        vi.mocked(existsSync).mockImplementation((path) => path === TEST_CONFIG_PATH);
        vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
          providers: [
            { name: "anthropic", auth: { url: "https://api.anthropic.com" } },
            { name: "openai", auth: { url: "https://api.openai.com", apiKey: "sk-test" } }
          ],
          models: [],
          agentModels: {}
        }));
        
        repository = createModelRepository({ configPath: TEST_CONFIG_PATH });
        
        const providers = repository.getAllProviders();
        expect(providers).toHaveLength(2);
        expect(providers[0].name).toBe("anthropic");
        expect(providers[1].name).toBe("openai");
      });
    });

    describe("addProvider", () => {
      it("should add a provider", () => {
        const provider: Provider = { name: "anthropic", auth: { url: "https://api.anthropic.com" } };
        
        repository.addProvider(provider);
        
        const providers = repository.getAllProviders();
        expect(providers).toHaveLength(1);
        expect(providers[0]).toEqual(provider);
      });

      it("should add a provider with apiKey", () => {
        const provider: Provider = { name: "openai", auth: { url: "https://api.openai.com", apiKey: "sk-test" } };
        
        repository.addProvider(provider);
        
        const savedProvider = repository.getAllProviders()[0];
        expect(savedProvider.auth.apiKey).toBe("sk-test");
      });

      it("should throw if provider already exists", () => {
        const provider: Provider = { name: "anthropic", auth: { url: "https://api.anthropic.com" } };
        repository.addProvider(provider);
        
        expect(() => repository.addProvider(provider))
          .toThrow("Provider anthropic already exists");
      });

      it("should persist to file", () => {
        const provider: Provider = { name: "anthropic", auth: { url: "https://api.anthropic.com" } };
        
        repository.addProvider(provider);
        
        expect(writeFileSync).toHaveBeenCalledWith(
          TEST_CONFIG_PATH,
          expect.stringContaining("anthropic")
        );
      });
    });

    describe("removeProvider", () => {
      beforeEach(() => {
        repository.addProvider({ name: "anthropic", auth: { url: "https://api.anthropic.com" } });
        repository.addProvider({ name: "openai", auth: { url: "https://api.openai.com" } });
      });

      it("should remove a provider", () => {
        const result = repository.removeProvider("anthropic");
        
        expect(result).toBe(true);
        expect(repository.getAllProviders()).toHaveLength(1);
        expect(repository.getAllProviders()[0].name).toBe("openai");
      });

      it("should return false if provider not found", () => {
        const result = repository.removeProvider("unknown");
        
        expect(result).toBe(false);
      });

      it("should throw if provider is in use by models", () => {
        repository.addModel({ provider: "anthropic", modelId: "claude-3" });
        
        expect(() => repository.removeProvider("anthropic"))
          .toThrow("Cannot remove provider anthropic - in use by 1 model(s)");
      });

      it("should persist to file after removal", () => {
        repository.removeProvider("anthropic");
        
        expect(writeFileSync).toHaveBeenCalled();
      });
    });
  });

  describe("persistence", () => {
    it("should create directory if needed when saving", () => {
      vi.mocked(existsSync).mockReturnValue(false);
      repository = createModelRepository({ configPath: TEST_CONFIG_PATH });
      
      repository.addModel({ provider: "test", modelId: "model" });
      
      expect(mkdirSync).toHaveBeenCalledWith("/test/.orchid", { recursive: true });
    });

    it("should save valid JSON with all data types", () => {
      repository = createModelRepository({ configPath: TEST_CONFIG_PATH });
      repository.addProvider({ name: "anthropic", auth: { url: "https://api.anthropic.com" } });
      repository.addModel({ provider: "anthropic", modelId: "claude-3" });
      repository.setModelForAgent(AgentType.IMPLEMENTOR, "anthropic", "claude-3");
      
      const writeCall = vi.mocked(writeFileSync).mock.calls[2]; // Third call
      const written = JSON.parse(writeCall[1] as string);
      
      expect(written.providers).toContainEqual({ name: "anthropic", auth: { url: "https://api.anthropic.com" } });
      expect(written.models).toContainEqual({ provider: "anthropic", modelId: "claude-3" });
      expect(written.agentModels.implementor).toEqual({ provider: "anthropic", modelId: "claude-3" });
    });
  });

  describe("edge cases", () => {
    it("should handle models with special characters in modelId", () => {
      repository = createModelRepository({ configPath: TEST_CONFIG_PATH });
      
      const model: Model = { provider: "test", modelId: "model-v1.0-beta_test" };
      repository.addModel(model);
      
      expect(repository.getAllModels()).toContainEqual(model);
    });

    it("should handle multiple agents with same model", () => {
      repository = createModelRepository({ configPath: TEST_CONFIG_PATH });
      
      repository.addProvider({ name: "anthropic", auth: { url: "https://api.anthropic.com" } });
      repository.addModel({ provider: "anthropic", modelId: "claude-3" });
      repository.setModelForAgent(AgentType.IMPLEMENTOR, "anthropic", "claude-3");
      repository.setModelForAgent(AgentType.REVIEWER, "anthropic", "claude-3");
      
      expect(repository.getModelForAgent(AgentType.IMPLEMENTOR)).toEqual({ provider: "anthropic", modelId: "claude-3" });
      expect(repository.getModelForAgent(AgentType.REVIEWER)).toEqual({ provider: "anthropic", modelId: "claude-3" });
    });

    it("should allow removing model after unassigning from all agents", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        providers: [
          { name: "anthropic", auth: { url: "https://api.anthropic.com" } },
          { name: "openai", auth: { url: "https://api.openai.com" } }
        ],
        models: [{ provider: "anthropic", modelId: "claude-3" }],
        agentModels: { [AgentType.IMPLEMENTOR]: { provider: "anthropic", modelId: "claude-3" } }
      }));
      repository = createModelRepository({ configPath: TEST_CONFIG_PATH });
      
      // First clear the assignment by setting to a different model
      repository.addModel({ provider: "openai", modelId: "gpt-4" });
      repository.setModelForAgent(AgentType.IMPLEMENTOR, "openai", "gpt-4");
      
      // Now we can remove the anthropic model
      const result = repository.removeModel("anthropic", "claude-3");
      
      expect(result).toBe(true);
    });
  });
});
