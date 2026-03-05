/**
 * Model Repository
 *
 * Simple model configuration management for agents.
 * Stores models in .orchid/models.json with agent type assignments.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { AgentType } from "../agent-framework/session-repository.js";
import { getOrchidDir } from "../config/paths.js";
import type { Model, Provider, ProviderAuth, ModelsJson, ProvidersJson } from "./types.js";

/**
 * Options for creating a ModelRepository
 */
export interface ModelRepositoryOptions {
  /** Path to models.json file */
  modelsJsonPath?: string;
  /** Path to providers.json file */
  providersJsonPath?: string;
}

/**
 * Simple repository for managing model configurations.
 * Reads/writes to .orchid/models.json and providers.json
 */
export class ModelRepository {
  private modelsJsonPath: string;
  private providersJsonPath: string;
  private data: ModelsJson = { models: [], agentModels: {} };
  private providersData: ProvidersJson = { providers: [] };

  constructor(options: ModelRepositoryOptions = {}) {
    this.modelsJsonPath = options.modelsJsonPath ?? join(getOrchidDir(), "models.json");
    this.providersJsonPath = options.providersJsonPath ?? join(getOrchidDir(), "providers.json");
    this.load();
    this.loadProviders();
  }

  /**
   * Get all configured models
   */
  getAllModels(): Model[] {
    return [...this.data.models];
  }

  /**
   * Add a model
   * @param model - The model to add
   * @throws Error if model already exists
   */
  addModel(model: Model): void {
    if (this.hasModel(model.provider, model.modelId)) {
      throw new Error(`Model ${model.provider}/${model.modelId} already exists`);
    }
    this.data.models.push({ provider: model.provider, modelId: model.modelId });
    this.save();
  }

  /**
   * Remove a model
   * @param provider - The provider identifier
   * @param modelId - The model identifier
   * @returns true if removed, false if not found
   * @throws Error if model is assigned to an agent
   */
  removeModel(provider: string, modelId: string): boolean {
    const key = this.getModelKey(provider, modelId);
    
    // Check if assigned to any agent
    for (const [agentType, assignedModel] of Object.entries(this.data.agentModels)) {
      if (this.getModelKey(assignedModel.provider, assignedModel.modelId) === key) {
        throw new Error(`Cannot remove model ${key} - assigned to ${agentType}`);
      }
    }

    const index = this.data.models.findIndex(
      m => m.provider === provider && m.modelId === modelId
    );
    
    if (index === -1) {
      return false;
    }

    this.data.models.splice(index, 1);
    this.save();
    return true;
  }

  /**
   * Get the model assigned to an agent type
   * @param agentType - The agent type
   * @returns The model or undefined if not set
   */
  getModelForAgent(agentType: AgentType): Model | undefined {
    return this.data.agentModels[agentType];
  }

  /**
   * Set the model for an agent type
   * @param agentType - The agent type
   * @param provider - The provider identifier (must exist)
   * @param modelId - The model identifier (must exist)
   * @throws Error if model doesn't exist or provider is not configured
   */
  setModelForAgent(agentType: AgentType, provider: string, modelId: string): void {
    // Validate provider exists (placeholder - will be implemented with providers.json)
    // For now, just validate model exists
    if (!this.hasModel(provider, modelId)) {
      throw new Error(`Model ${provider}/${modelId} not found`);
    }

    this.data.agentModels[agentType] = { provider, modelId };
    this.save();
  }

  /**
   * Get all configured providers
   * @returns Array of providers
   */
  getAllProviders(): Provider[] {
    return [...this.providersData.providers];
  }

  /**
   * Get a provider by name
   * @param name - The provider name
   * @returns The provider or undefined if not found
   */
  getProvider(name: string): Provider | undefined {
    return this.providersData.providers.find(p => p.name === name);
  }

  /**
   * Add a provider
   * @param name - The provider name
   * @param auth - The provider authentication configuration
   * @throws Error if provider already exists
   */
  addProvider(name: string, auth: ProviderAuth): void {
    if (this.hasProvider(name)) {
      throw new Error(`Provider ${name} already exists`);
    }
    this.providersData.providers.push({ name, auth });
    this.saveProviders();
  }

  /**
   * Remove a provider
   * @param name - The provider name
   * @returns true if removed, false if not found
   * @throws Error if provider is in use by any models
   */
  removeProvider(name: string): boolean {
    // Check if any models use this provider
    const modelsUsingProvider = this.data.models.filter(m => m.provider === name);
    if (modelsUsingProvider.length > 0) {
      throw new Error(`Cannot remove provider ${name} - in use by ${modelsUsingProvider.length} model(s)`);
    }

    const index = this.providersData.providers.findIndex(p => p.name === name);
    if (index === -1) {
      return false;
    }

    this.providersData.providers.splice(index, 1);
    this.saveProviders();
    return true;
  }

  /**
   * Check if a model exists
   */
  private hasModel(provider: string, modelId: string): boolean {
    return this.data.models.some(
      m => m.provider === provider && m.modelId === modelId
    );
  }

  /**
   * Generate a unique key for a model
   */
  private getModelKey(provider: string, modelId: string): string {
    return `${provider}/${modelId}`;
  }

  /**
   * Load from models.json
   */
  private load(): void {
    if (!existsSync(this.modelsJsonPath)) {
      // Initialize with empty data
      this.data = { models: [], agentModels: {} };
      return;
    }

    try {
      const content = readFileSync(this.modelsJsonPath, "utf-8");
      const parsed = JSON.parse(content) as Partial<ModelsJson>;
      this.data = {
        models: parsed.models ?? [],
        agentModels: parsed.agentModels ?? {}
      };
    } catch {
      // If file is corrupted, start fresh
      this.data = { models: [], agentModels: {} };
    }
  }

  /**
   * Save to models.json
   */
  private save(): void {
    const dir = dirname(this.modelsJsonPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.modelsJsonPath, JSON.stringify(this.data, null, 2));
  }

  /**
   * Check if a provider exists
   */
  private hasProvider(name: string): boolean {
    return this.providersData.providers.some(p => p.name === name);
  }

  /**
   * Load from providers.json
   */
  private loadProviders(): void {
    if (!existsSync(this.providersJsonPath)) {
      // Initialize with empty data
      this.providersData = { providers: [] };
      return;
    }

    try {
      const content = readFileSync(this.providersJsonPath, "utf-8");
      const parsed = JSON.parse(content) as Partial<ProvidersJson>;
      this.providersData = {
        providers: parsed.providers ?? []
      };
    } catch {
      // If file is corrupted, start fresh
      this.providersData = { providers: [] };
    }
  }

  /**
   * Save to providers.json
   */
  private saveProviders(): void {
    const dir = dirname(this.providersJsonPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.providersJsonPath, JSON.stringify(this.providersData, null, 2));
  }
}

/**
 * Factory function to create a ModelRepository
 */
export function createModelRepository(options?: ModelRepositoryOptions): ModelRepository {
  return new ModelRepository(options);
}
