/**
 * Model Repository
 *
 * Simple model configuration management for agents.
 * Stores configuration in .orchid/config.json with providers, models, and agent type assignments.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { AgentType } from "../agent-framework/session-repository.js";
import { getOrchidDir } from "../core/files/paths.js";
import type { Model, Provider, OrchidConfig } from "./types.js";

/**
 * Options for creating a ModelRepository
 */
export interface ModelRepositoryOptions {
  /** Path to config.json file */
  configPath?: string;
}

/**
 * Simple repository for managing model configurations.
 * Reads/writes to .orchid/config.json
 */
export class ModelRepository {
  private configPath: string;
  private data: OrchidConfig = { providers: [], models: [], agentModels: {} };

  constructor(options: ModelRepositoryOptions = {}) {
    this.configPath = options.configPath ?? join(getOrchidDir(), "config.json");
    this.load();
  }

  /**
   * Get all configured models
   */
  getAllModels(): Model[] {
    return [...this.data.models];
  }

  /**
   * Get all configured providers
   * @returns Array of providers
   */
  getAllProviders(): Provider[] {
    return [...this.data.providers];
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
   * Add a provider
   * @param provider - The provider to add
   * @throws Error if provider already exists
   */
  addProvider(provider: Provider): void {
    if (this.hasProvider(provider.name)) {
      throw new Error(`Provider ${provider.name} already exists`);
    }
    this.data.providers.push(provider);
    this.save();
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

    const index = this.data.providers.findIndex(p => p.name === name);
    if (index === -1) {
      return false;
    }

    this.data.providers.splice(index, 1);
    this.save();
    return true;
  }

  /**
   * Check if a model exists
   */
  private hasModel(provider: string, modelId: string): boolean {
    return this.data.models.some(
      (m: Model) => m.provider === provider && m.modelId === modelId
    );
  }

  /**
   * Generate a unique key for a model
   */
  private getModelKey(provider: string, modelId: string): string {
    return `${provider}/${modelId}`;
  }

  /**
   * Check if a provider exists
   */
  private hasProvider(name: string): boolean {
    return this.data.providers.some((p: Provider) => p.name === name);
  }

  /**
   * Load from config.json
   */
  private load(): void {
    if (!existsSync(this.configPath)) {
      // Initialize with empty data
      this.data = { providers: [], models: [], agentModels: {} };
      return;
    }

    try {
      const content = readFileSync(this.configPath, "utf-8");
      const parsed = JSON.parse(content) as Partial<OrchidConfig>;
      this.data = {
        providers: parsed.providers ?? [],
        models: parsed.models ?? [],
        agentModels: parsed.agentModels ?? {}
      };
    } catch {
      // If file is corrupted, start fresh
      this.data = { providers: [], models: [], agentModels: {} };
    }
  }

  /**
   * Save to config.json
   */
  private save(): void {
    const dir = dirname(this.configPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.configPath, JSON.stringify(this.data, null, 2));
  }
}

/**
 * Factory function to create a ModelRepository
 */
export function createModelRepository(options?: ModelRepositoryOptions): ModelRepository {
  return new ModelRepository(options);
}
