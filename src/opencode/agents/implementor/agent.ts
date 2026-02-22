/**
 * Implementor Agent
 *
 * Handles the implementation phase of a task.
 * Creates worktree, session, and sends initial prompt.
 * Reports back to orchestrator when complete.
 */

import { join } from "node:path";
import { TaskManager, type Task as DysonTask } from "dyson-swarm";
import { WorktreeManager } from "../../../git/worktrees/index.js";
import { OpencodeSessionManager, type AgentSession } from "../../session/index.js";
import { fillAgentPromptTemplate } from "../../../templates/index.js";
import { log } from "../../../core/logging/index.js";
import type { Task } from "../../../tasks/index.js";

export interface ImplementorAgentOptions {
  taskId: string;
  dysonTask: DysonTask;
  worktreeManager: WorktreeManager;
  sessionManager: OpencodeSessionManager;
  taskManager: TaskManager;
  worktreesDir: string;
  onComplete: (taskId: string, session: AgentSession) => void;
  onError: (taskId: string, error: Error) => void;
}

export interface ImplementorAgent {
  readonly agentId: string;
  readonly taskId: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
}

/**
 * ImplementorAgent handles the implementation phase of a task.
 * Created per-task and destroyed when implementation is complete.
 */
export class ImplementorAgentImpl implements ImplementorAgent {
  readonly agentId: string;
  readonly taskId: string;
  private dysonTask: DysonTask;
  private worktreeManager: WorktreeManager;
  private sessionManager: OpencodeSessionManager;
  private taskManager: TaskManager;
  private worktreesDir: string;
  private onComplete: (taskId: string, session: AgentSession) => void;
  private onError: (taskId: string, error: Error) => void;
  private session?: AgentSession;
  private worktreePath: string;
  private _isRunning = false;

  constructor(options: ImplementorAgentOptions) {
    this.taskId = options.taskId;
    this.agentId = `${options.taskId}-implementor`;
    this.dysonTask = options.dysonTask;
    this.worktreeManager = options.worktreeManager;
    this.sessionManager = options.sessionManager;
    this.taskManager = options.taskManager;
    this.worktreesDir = options.worktreesDir;
    this.onComplete = options.onComplete;
    this.onError = options.onError;
    this.worktreePath = join(this.worktreesDir, this.taskId);
  }

  /**
   * Start the implementor agent.
   * Creates worktree, session, and sends initial prompt.
   */
  async start(): Promise<void> {
    if (this._isRunning) {
      log.log(`[implementor] Agent ${this.agentId} already running`);
      return;
    }

    this._isRunning = true;
    log.log(`[implementor] Starting agent ${this.agentId} for task ${this.taskId}`);

    try {
      // Create worktree
      await this.createWorktree();
      
      // Create session
      await this.createSession();
      
      // Send initial prompt
      await this.sendInitialPrompt();
      
      // Assign task in dyson-swarm
      await this.assignTask();
      
      log.log(`[implementor] Agent ${this.agentId} started successfully`);
    } catch (error) {
      log.error(`[implementor] Failed to start agent ${this.agentId}:`, error);
      await this.cleanup();
      this._isRunning = false;
      this.onError(this.taskId, error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Stop the implementor agent.
   * Cleans up session and worktree.
   */
  async stop(): Promise<void> {
    if (!this._isRunning) {
      return;
    }

    log.log(`[implementor] Stopping agent ${this.agentId}`);
    await this.cleanup();
    this._isRunning = false;
    log.log(`[implementor] Agent ${this.agentId} stopped`);
  }

  /**
   * Check if agent is running
   */
  isRunning(): boolean {
    return this._isRunning;
  }

  /**
   * Get the session
   */
  getSession(): AgentSession | undefined {
    return this.session;
  }

  /**
   * Handle session idle event - called by orchestrator when session becomes idle
   */
  async handleSessionIdle(): Promise<void> {
    log.log(`[implementor] Session ${this.session?.sessionId} became idle for task ${this.taskId}`);
    
    // Clean up
    await this.cleanup();
    this._isRunning = false;
    
    // Notify completion
    if (this.session) {
      this.onComplete(this.taskId, this.session);
    } else {
      this.onError(this.taskId, new Error("Session idle but no session available"));
    }
  }

  private async createWorktree(): Promise<void> {
    try {
      await this.worktreeManager.create(this.worktreePath, "HEAD", { detach: true });
      log.log(`[implementor] Created worktree at ${this.worktreePath}`);
    } catch (error) {
      throw new Error(
        `Failed to create worktree: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async createSession(): Promise<void> {
    try {
      this.session = await this.sessionManager.createSession(this.taskId);
      log.log(`[implementor] Created session ${this.session.sessionId}`);
    } catch (error) {
      // Clean up worktree
      await this.worktreeManager.remove(this.worktreePath, { force: true });
      throw new Error(
        `Failed to create session: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async sendInitialPrompt(): Promise<void> {
    if (!this.session) {
      throw new Error("Cannot send prompt: no session");
    }

    try {
      const promptMessage = fillAgentPromptTemplate({
        taskTitle: this.dysonTask.frontmatter.title || "",
        taskDescription: this.dysonTask.description || "",
        worktreePath: this.worktreePath,
      });

      await this.sessionManager.sendMessage(
        this.session.sessionId,
        promptMessage,
        this.worktreePath
      );
      log.log(`[implementor] Sent initial prompt`);
    } catch (error) {
      // Clean up session and worktree
      await this.sessionManager.removeSession(this.taskId);
      await this.worktreeManager.remove(this.worktreePath, { force: true });
      throw new Error(
        `Failed to send initial prompt: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async assignTask(): Promise<void> {
    try {
      await this.taskManager.assignTask(this.taskId, this.agentId);
      log.log(`[implementor] Assigned task ${this.taskId} to agent ${this.agentId}`);
    } catch (error) {
      // Don't fail if assignment fails - it's optional
      log.warn(`[implementor] Failed to assign task: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async cleanup(): Promise<void> {
    // Remove session
    if (this.session) {
      try {
        await this.sessionManager.removeSession(this.taskId);
        log.log(`[implementor] Removed session ${this.session.sessionId}`);
      } catch (error) {
        log.error(`[implementor] Failed to remove session:`, error);
      }
    }

    // Unassign task
    try {
      await this.taskManager.unassignTask(this.taskId);
    } catch (error) {
      log.error(`[implementor] Failed to unassign task:`, error);
    }

    // Remove worktree
    try {
      await this.worktreeManager.remove(this.worktreePath, { force: true });
      log.log(`[implementor] Removed worktree ${this.worktreePath}`);
    } catch (error) {
      log.error(`[implementor] Failed to remove worktree:`, error);
    }
  }
}

/**
 * Factory function to create an ImplementorAgent
 */
export function createImplementorAgent(options: ImplementorAgentOptions): ImplementorAgent {
  return new ImplementorAgentImpl(options);
}
