/**
 * Planner Agent
 *
 * Handles planning mode by analyzing requests and creating Dyson tasks.
 * Creates and manages its own agent instance with the planner system prompt.
 * Reports back when planning is complete.
 * This agent is standalone and not part of the state machine workflow.
 */

import type { AgentInstance, AgentInstanceManager } from "./interface/index.js";
import { type SessionRepository } from "../session-repository.js";
import { AgentType } from "../agent-type.js";
import { 
  fillPlannerPromptTemplate,
  getPlannerSystemPrompt 
} from "../../templates/index.js";
import { log } from "../../core/logging/index.js";
import { Tool } from "../tools/types.js";

export interface PlannerAgentOptions {
  sessionId: string;
  requestDescription: string;
  context: string;
  workingDirectory: string;
  agentInstanceManager: AgentInstanceManager;
  sessionRepository: SessionRepository;
  onComplete: (sessionId: string) => void;
  onError: (sessionId: string, error: Error) => void;
}

export interface PlannerAgent {
  readonly agentId: string;
  readonly sessionId: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
}

export class PlannerAgentImpl implements PlannerAgent {
  readonly agentId: string;
  readonly sessionId: string;
  private requestDescription: string;
  private context: string;
  private workingDirectory: string;
  private agentInstance: AgentInstance | undefined;
  private agentInstanceManager: AgentInstanceManager;
  private sessionRepository: SessionRepository;
  private onComplete: (sessionId: string) => void;
  private onError: (sessionId: string, error: Error) => void;
  private _isRunning = false;

  constructor(options: PlannerAgentOptions) {
    this.sessionId = options.sessionId;
    this.agentId = `${options.sessionId}-planner`;
    this.requestDescription = options.requestDescription;
    this.context = options.context;
    this.workingDirectory = options.workingDirectory;
    this.agentInstanceManager = options.agentInstanceManager;
    this.sessionRepository = options.sessionRepository;
    this.onComplete = options.onComplete;
    this.onError = options.onError;
  }

  async start(): Promise<void> {
    if (this._isRunning) {
      log.log(`[planner] Agent ${this.agentId} already running`);
      return;
    }

    this._isRunning = true;
    log.log(`[planner] Starting agent ${this.agentId} for session ${this.sessionId}`);

    try {
      const session = this.sessionRepository.getOrCreateSession(this.sessionId, AgentType.PLANNER);
      log.log(`[planner] Using session ${session.filename} for session ${this.sessionId}`);

      this.agentInstance = await this.agentInstanceManager.createAgentInstance({
        taskId: this.sessionId,
        workingDirectory: this.workingDirectory,
        systemPrompt: getPlannerSystemPrompt(),
        sessionFilePath: session.filePath,
        model: { provider: "synthetic", modelId: "kimi-2.5" },
        tools: [
          Tool.READ,
          Tool.GREP,
          Tool.FIND,
          Tool.LS,
        ],
      });
      log.log(`[planner] Created agent instance ${this.agentInstance.instanceId} for session ${this.sessionId}`);

      await this.sendInitialPrompt();

      log.log(`[planner] Agent ${this.agentId} started successfully`);
    } catch (error) {
      log.error(`[planner] Failed to start agent ${this.agentId}:`, error);
      this._isRunning = false;
      this.onError(this.sessionId, error instanceof Error ? error : new Error(String(error)));
    }
  }

  async stop(): Promise<void> {
    if (!this._isRunning) {
      return;
    }

    log.log(`[planner] Stopping agent ${this.agentId}`);
    this._isRunning = false;
    
    if (this.agentInstance) {
      try {
        await this.agentInstanceManager.removeAgentInstance(this.sessionId);
        log.log(`[planner] Removed agent instance for session ${this.sessionId}`);
      } catch (error) {
        log.error(`[planner] Failed to remove agent instance for session ${this.sessionId}:`, error);
      }
      this.agentInstance = undefined;
    }
    
    log.log(`[planner] Agent ${this.agentId} stopped`);
  }

  isRunning(): boolean {
    return this._isRunning;
  }

  getAgentInstance(): AgentInstance | undefined {
    return this.agentInstance;
  }

  async handleAgentInstanceIdle(): Promise<void> {
    if (!this.agentInstance) {
      log.error(`[planner] No agent instance available for session ${this.sessionId}`);
      return;
    }
    
    log.log(`[planner] Agent instance ${this.agentInstance.instanceId} became idle for session ${this.sessionId}`);

    this._isRunning = false;

    try {
      await this.agentInstanceManager.removeAgentInstance(this.sessionId);
      log.log(`[planner] Removed agent instance for session ${this.sessionId}`);
    } catch (error) {
      log.error(`[planner] Failed to remove agent instance for session ${this.sessionId}:`, error);
    }
    this.agentInstance = undefined;

    this.onComplete(this.sessionId);
  }

  private async sendInitialPrompt(): Promise<void> {
    if (!this.agentInstance) {
      throw new Error("Agent instance not available");
    }
    
    try {
      const promptMessage = fillPlannerPromptTemplate({
        requestDescription: this.requestDescription,
        context: this.context,
        workingDirectory: this.workingDirectory,
      });

      await this.agentInstanceManager.sendMessage(
        this.agentInstance.instanceId,
        promptMessage,
        this.workingDirectory
      );
      log.log(`[planner] Sent initial prompt`);
    } catch (error) {
      throw new Error(
        `Failed to send initial prompt: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

export function createPlannerAgent(options: PlannerAgentOptions): PlannerAgent {
  return new PlannerAgentImpl(options);
}
