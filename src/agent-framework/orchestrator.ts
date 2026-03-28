/**
 * Agent Orchestrator
 *
 * Monitors tasks and orchestrates agent lifecycles.
 * Uses Task state machine and separate agent implementations.
 * Responsibilities:
 * - Detect when new implementors/reviewers are needed
 * - Create and attach agents
 * - Handle agent lifecycle events
 * - Move tasks through the state machine
 */

import { TaskManager, type Task as DysonTask } from "dyson-swarm";
import { WorktreeManager } from "../core/git/worktrees/index.js";
import { getWorktreesDir, getOrchidDir } from "../core/files/paths.js";
import type { AgentInstanceManager } from "./agents/interface/index.js";
import { SessionRepository, createSessionRepository } from "./session-repository.js";
import { TaskRepository } from "./tools/task-repository.js";
import { createDysonSwarmTaskRepository } from "./tools/dyson-swarm-task-repository.js";
import { Task, TaskState, createTaskFromDyson } from "../core/tasks/index.js";
import { join } from "node:path";
import { createImplementorAgent, type ImplementorAgent } from "./agents/implementor.js";
import { createReviewerAgent, type ReviewerAgent } from "./agents/reviewer.js";
import { createMergerAgent, type MergerAgent } from "./agents/merger.js";
import { log } from "../core/logging/index.js";
import { TaskStreamService, type TaskChangeEvent } from "./services/task-stream-service.js";

export interface AgentInfo {
  taskId: string;
  agentId: string;
  startedAt: Date;
  state: TaskState;
  worktreePath: string;
}

export interface AgentOrchestratorOptions {
  cwdProvider?: () => string;
  worktreeManager?: WorktreeManager;
  agentInstanceManager?: AgentInstanceManager;
  taskStreamService?: TaskStreamService;
}

export class AgentOrchestrator {
  private taskStreamService: TaskStreamService;
  private taskManager: TaskManager;
  private tasks: Map<string, Task> = new Map();
  private implementors: Map<string, ImplementorAgent> = new Map();
  private reviewers: Map<string, ReviewerAgent> = new Map();
  private mergers: Map<string, MergerAgent> = new Map();
  private abortController: AbortController | null = null;
  private worktreeManager: WorktreeManager;
  private agentInstanceManager: AgentInstanceManager;
  private sessionRepository: SessionRepository;
  private taskRepository: TaskRepository;
  private cwdProvider: () => string;
  private worktreesDir: string;
  private unsubscribeFromTaskChanges: (() => void) | null = null;

  constructor(options: AgentOrchestratorOptions) {
    this.cwdProvider = options.cwdProvider ?? (() => process.cwd());
    this.worktreeManager = options.worktreeManager ?? new WorktreeManager(this.cwdProvider());
    
    // Initialize task manager (still needed for agent task operations)
    this.taskManager = new TaskManager({ cwdProvider: this.cwdProvider });
    
    // Initialize task stream service
    this.taskStreamService = options.taskStreamService ?? new TaskStreamService({
      cwdProvider: this.cwdProvider,
      filter: { status: "open" },
    });
    
    // Initialize agent instance manager
    this.worktreesDir = getWorktreesDir(this.cwdProvider);
    if (!options.agentInstanceManager) {
      throw new Error("Agent instance manager is required");
    }
    this.agentInstanceManager = options.agentInstanceManager;
    
    // Initialize session repository
    const orchidDir = getOrchidDir(this.cwdProvider);
    const sessionsDir = join(orchidDir, "sessions");
    this.sessionRepository = createSessionRepository({ sessionsDir });
    
    // Initialize task repository for agent task tools
    this.taskRepository = createDysonSwarmTaskRepository({ cwdProvider: this.cwdProvider });
  }

  async start(): Promise<void> {
    if (this.abortController) {
      log.log("[orchestrator] Already running");
      return;
    }

    this.abortController = new AbortController();
    log.log("[orchestrator] Starting task monitor...");

    // Subscribe to task changes from the stream service
    this.unsubscribeFromTaskChanges = this.taskStreamService.onTaskChange(
      (event) => this.handleTaskChange(event)
    );

    // Start the task stream service
    // This will begin listening to the dyson-swarm stream
    // We don't await this - it runs in the background
    this.taskStreamService.start().catch((error) => {
      log.error("[orchestrator] Task stream service error:", error);
    });

    log.log("[orchestrator] Task monitor started");
  }

  async stop(): Promise<void> {
    if (!this.abortController) {
      return;
    }

    log.log("[orchestrator] Stopping...");
    this.abortController.abort();
    this.abortController = null;

    // Unsubscribe from task changes
    if (this.unsubscribeFromTaskChanges) {
      this.unsubscribeFromTaskChanges();
      this.unsubscribeFromTaskChanges = null;
    }

    // Stop task stream service
    await this.taskStreamService.stop();

    // Stop all implementor agents
    log.log("[orchestrator] Stopping all implementor agents...");
    for (const [taskId, implementor] of this.implementors) {
      try {
        await implementor.stop();
        log.log(`[orchestrator] Stopped implementor for task ${taskId}`);
      } catch (error) {
        log.error(`[orchestrator] Error stopping implementor for task ${taskId}:`, error);
      }
    }
    this.implementors.clear();

    // Stop all reviewer agents
    log.log("[orchestrator] Stopping all reviewer agents...");
    for (const [taskId, reviewer] of this.reviewers) {
      try {
        await reviewer.stop();
        log.log(`[orchestrator] Stopped reviewer for task ${taskId}`);
      } catch (error) {
        log.error(`[orchestrator] Error stopping reviewer for task ${taskId}:`, error);
      }
    }
    this.reviewers.clear();

    // Stop all merger agents
    log.log("[orchestrator] Stopping all merger agents...");
    for (const [taskId, merger] of this.mergers) {
      try {
        await merger.stop();
        log.log(`[orchestrator] Stopped merger for task ${taskId}`);
      } catch (error) {
        log.error(`[orchestrator] Error stopping merger for task ${taskId}:`, error);
      }
    }
    this.mergers.clear();

    // Clear tasks
    this.tasks.clear();
    
    log.log("[orchestrator] Stopped");
  }

  /**
   * Handle task change events from the task stream service.
   * Routes to appropriate handler based on change type.
   */
  private async handleTaskChange(event: TaskChangeEvent): Promise<void> {
    switch (event.type) {
      case "added":
        await this.handleTaskAdded(event.task);
        break;
      case "removed":
        await this.handleTaskRemoved(event.task);
        break;
      case "updated":
        await this.handleTaskUpdated(event.task, event.previousTask!);
        break;
    }
  }

  /**
   * Handle a new task being added.
   */
  private async handleTaskAdded(dysonTask: DysonTask): Promise<void> {
    if (!this.tasks.has(dysonTask.id)) {
      const task = createTaskFromDyson(dysonTask, this.worktreesDir);
      this.tasks.set(task.taskId, task);
      log.log(`[orchestrator] Created task ${task.taskId}`);
      
      // Process the task immediately
      await this.processTasks();
    }
  }

  /**
   * Handle a task being removed.
   */
  private async handleTaskRemoved(dysonTask: DysonTask): Promise<void> {
    const taskId = dysonTask.id;
    log.log(`[orchestrator] Task ${taskId} no longer open, cleaning up`);
    
    // Stop implementor if running
    const implementor = this.implementors.get(taskId);
    if (implementor) {
      await implementor.stop();
      this.implementors.delete(taskId);
    }
    
    // Stop reviewer if running
    const reviewer = this.reviewers.get(taskId);
    if (reviewer) {
      await reviewer.stop();
      this.reviewers.delete(taskId);
    }
    
    // Stop merger if running
    const merger = this.mergers.get(taskId);
    if (merger) {
      await merger.stop();
      this.mergers.delete(taskId);
    }
    
    this.tasks.delete(taskId);
  }

  /**
   * Handle a task being updated.
   * For now, we just log the update. In the future, this could trigger
   * re-processing if task properties affect agent assignment.
   */
  private async handleTaskUpdated(dysonTask: DysonTask, previousTask: DysonTask): Promise<void> {
    log.log(`[orchestrator] Task ${dysonTask.id} updated`);
    
    // If the task is already being tracked, update it
    const existingTask = this.tasks.get(dysonTask.id);
    if (existingTask) {
      // Re-create the task with new properties
      const updatedTask = createTaskFromDyson(dysonTask, this.worktreesDir);
      // Preserve the state and agent assignments from the existing task
      this.tasks.set(dysonTask.id, updatedTask);
    }
  }

  /**
    * Sync tasks with dyson-swarm.
    * Creates tasks for new open tasks, removes tasks that are no longer open.
    * @deprecated Use handleTaskChange instead
    */
  private async syncTasks(dysonTasks: DysonTask[]): Promise<void> {
    const openTaskIds = new Set(dysonTasks.map((t) => t.id));

    // Create tasks for new open tasks
    for (const dysonTask of dysonTasks) {
      if (!this.tasks.has(dysonTask.id)) {
        const task = createTaskFromDyson(dysonTask, this.worktreesDir);
        this.tasks.set(task.taskId, task);
        log.log(`[orchestrator] Created task ${task.taskId}`);
      }
    }

    // Remove tasks that are no longer open
    for (const [taskId, task] of this.tasks) {
      if (!openTaskIds.has(taskId)) {
        // Task is no longer open
        log.log(`[orchestrator] Task ${taskId} no longer open, cleaning up`);
        
        // Stop implementor if running
        const implementor = this.implementors.get(taskId);
        if (implementor) {
          await implementor.stop();
          this.implementors.delete(taskId);
        }
        
        // Stop reviewer if running
        const reviewer = this.reviewers.get(taskId);
        if (reviewer) {
          await reviewer.stop();
          this.reviewers.delete(taskId);
        }
        
        // Stop merger if running
        const merger = this.mergers.get(taskId);
        if (merger) {
          await merger.stop();
          this.mergers.delete(taskId);
        }
        
        this.tasks.delete(taskId);
      }
    }

    // Process tasks - assign implementors where needed
    await this.processTasks();
  }

  /**
   * Process tasks in the state machine.
   * Assigns agents based on task state.
   */
  private async processTasks(): Promise<void> {
    for (const task of this.tasks.values()) {
      // Check if task needs an implementor
      if (task.canAssignImplementor() && !this.implementors.has(task.taskId)) {
        await this.createImplementor(task);
      }

      // Check if task needs a reviewer
      if (task.canAssignReviewer() && !this.reviewers.has(task.taskId)) {
        await this.createReviewer(task);
      }

      // Check if task needs a merger
      if (task.canAssignMerger() && !this.mergers.has(task.taskId)) {
        await this.createMerger(task);
      }
    }
  }

  /**
   * Create an implementor agent for a task.
   * Creates worktree, then creates the implementor agent.
   */
  private async createImplementor(task: Task): Promise<void> {
    const agentId = `${task.taskId}-implementor`;
    log.log(`[orchestrator] Creating implementor ${agentId} for task ${task.taskId}`);

    try {
      // Transition task state first to mark it as taken
      task.assignImplementor(agentId);

      // Create worktree
      const worktreePath = `${this.worktreesDir}/${task.taskId}`;
      await this.worktreeManager.create(worktreePath, "HEAD", { detach: true });
      log.log(`[orchestrator] Created worktree at ${worktreePath} for task ${task.taskId}`);

      const implementor = createImplementorAgent({
        taskId: task.taskId,
        dysonTask: task.dysonTask,
        worktreePath: worktreePath,
        agentInstanceManager: this.agentInstanceManager,
        sessionRepository: this.sessionRepository,
        taskManager: this.taskManager,
        taskRepository: this.taskRepository,
        onComplete: (taskId: string) => {
          this.handleImplementationComplete(taskId);
        },
        onError: (taskId: string, error: Error) => {
          this.handleImplementationError(taskId, error);
        },
      });

      this.implementors.set(task.taskId, implementor);

      // Start the implementor - this creates its session
      await implementor.start();

      log.log(`[orchestrator] Implementor ${agentId} started for task ${task.taskId}`);
    } catch (error) {
      log.error(`[orchestrator] Failed to create implementor for task ${task.taskId}:`, error);
      await this.handleImplementationError(task.taskId, error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Create a reviewer agent for a task.
   * Uses existing worktree, agent creates its own session.
   */
  private async createReviewer(task: Task): Promise<void> {
    const agentId = `${task.taskId}-reviewer`;
    log.log(`[orchestrator] Creating reviewer ${agentId} for task ${task.taskId}`);

    try {
      // Transition task state
      task.assignReviewer(agentId);

      // Get existing worktree from the task
      const worktreePath = task.worktreePath;
      
      if (!worktreePath) {
        throw new Error(`Task ${task.taskId} missing worktree for review`);
      }

      log.log(`[orchestrator] Using existing worktree at ${worktreePath}`);

      // Create reviewer agent - agent manages its own session
      const reviewer = createReviewerAgent({
        taskId: task.taskId,
        dysonTask: task.dysonTask,
        worktreePath: worktreePath,
        agentInstanceManager: this.agentInstanceManager,
        sessionRepository: this.sessionRepository,
        taskRepository: this.taskRepository,
        onComplete: (taskId: string) => {
          this.handleReviewComplete(taskId);
        },
        onError: (taskId: string, error: Error) => {
          this.handleReviewError(taskId, error);
        },
      });

      this.reviewers.set(task.taskId, reviewer);

      // Start the reviewer - this creates its session
      await reviewer.start();

      log.log(`[orchestrator] Reviewer ${agentId} started for task ${task.taskId}`);
    } catch (error) {
      log.error(`[orchestrator] Failed to create reviewer for task ${task.taskId}:`, error);
      await this.handleReviewError(task.taskId, error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Create a merger agent for a task.
   * Uses existing worktree, agent creates its own session.
   */
  private async createMerger(task: Task): Promise<void> {
    const agentId = `${task.taskId}-merger`;
    log.log(`[orchestrator] Creating merger ${agentId} for task ${task.taskId}`);

    try {
      // Transition task state
      task.assignMerger(agentId);

      // Get existing worktree from the task
      const worktreePath = task.worktreePath;
      
      if (!worktreePath) {
        throw new Error(`Task ${task.taskId} missing worktree for merge`);
      }

      log.log(`[orchestrator] Using existing worktree at ${worktreePath}`);

      // Create merger agent - agent manages its own session
      const merger = createMergerAgent({
        taskId: task.taskId,
        worktreePath: worktreePath,
        agentInstanceManager: this.agentInstanceManager,
        sessionRepository: this.sessionRepository,
        taskRepository: this.taskRepository,
        onComplete: (taskId: string) => {
          this.handleMergeComplete(taskId);
        },
        onError: (taskId: string, error: Error) => {
          this.handleMergeError(taskId, error);
        },
      });

      this.mergers.set(task.taskId, merger);

      // Start the merger - this creates its session
      await merger.start();

      log.log(`[orchestrator] Merger ${agentId} started for task ${task.taskId}`);
    } catch (error) {
      log.error(`[orchestrator] Failed to create merger for task ${task.taskId}:`, error);
      await this.handleMergeError(task.taskId, error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Handle implementation completion.
   * Called when an implementor agent finishes.
   * Creates a reviewer agent for the task.
   */
  private async handleImplementationComplete(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      log.error(`[orchestrator] Task ${taskId} not found for completion`);
      return;
    }

    log.log(`[orchestrator] Task ${taskId} implementation complete`);

    // Remove the implementor agent
    const implementor = this.implementors.get(taskId);
    if (implementor) {
      await implementor.stop();
      this.implementors.delete(taskId);
    }

    // Transition task state
    try {
      task.markImplementationComplete();
      log.log(`[orchestrator] Task ${taskId} moved to AWAITING_REVIEW state`);
      
      // Create reviewer agent
      await this.createReviewer(task);
    } catch (error) {
      log.error(`[orchestrator] Failed to transition task ${taskId}:`, error);
    }
  }

  /**
   * Handle review completion.
   * Called when a reviewer agent finishes.
   * Creates a merger agent for the task.
   */
  private async handleReviewComplete(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      log.error(`[orchestrator] Task ${taskId} not found for review completion`);
      return;
    }

    log.log(`[orchestrator] Task ${taskId} review complete`);

    // Remove the reviewer agent
    const reviewer = this.reviewers.get(taskId);
    if (reviewer) {
      await reviewer.stop();
      this.reviewers.delete(taskId);
    }

    // Transition task state
    try {
      task.markReviewComplete();
      log.log(`[orchestrator] Task ${taskId} moved to AWAITING_MERGE state`);
      
      // Create merger agent
      await this.createMerger(task);
    } catch (error) {
      log.error(`[orchestrator] Failed to transition task ${taskId} after review:`, error);
    }
  }

  /**
   * Handle merge completion.
   * Called when a merger agent finishes.
   * Cleans up resources and marks task as complete.
   */
  private async handleMergeComplete(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      log.error(`[orchestrator] Task ${taskId} not found for merge completion`);
      return;
    }

    log.log(`[orchestrator] Task ${taskId} merge complete`);

    // Remove the merger agent
    const merger = this.mergers.get(taskId);
    if (merger) {
      await merger.stop();
      this.mergers.delete(taskId);
    }

    // Transition task state
    try {
      task.markMergeComplete();
      log.log(`[orchestrator] Task ${taskId} moved to COMPLETED state`);
      
      // Remove task from tracking
      this.tasks.delete(taskId);
      log.log(`[orchestrator] Task ${taskId} completed`);
    } catch (error) {
      log.error(`[orchestrator] Failed to transition task ${taskId} after merge:`, error);
    }
  }

  /**
   * Handle implementation error.
   * Called when an implementor agent fails.
   */
  private async handleImplementationError(taskId: string, error: Error): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      log.error(`[orchestrator] Task ${taskId} not found for error handling`);
      return;
    }

    log.error(`[orchestrator] Task ${taskId} implementation failed:`, error);

    // Remove the implementor agent
    const implementor = this.implementors.get(taskId);
    if (implementor) {
      this.implementors.delete(taskId);
    }

    // Mark task as failed
    try {
      task.markFailed();
      log.log(`[orchestrator] Task ${taskId} moved to FAILED state`);
    } catch (err) {
      log.error(`[orchestrator] Failed to mark task ${taskId} as failed:`, err);
    }
  }

  /**
   * Handle review error.
   * Called when a reviewer agent fails.
   */
  private async handleReviewError(taskId: string, error: Error): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      log.error(`[orchestrator] Task ${taskId} not found for review error handling`);
      return;
    }

    log.error(`[orchestrator] Task ${taskId} review failed:`, error);

    // Remove the reviewer agent
    const reviewer = this.reviewers.get(taskId);
    if (reviewer) {
      this.reviewers.delete(taskId);
    }

    // Mark task as failed
    try {
      task.markFailed();
      log.log(`[orchestrator] Task ${taskId} moved to FAILED state`);
    } catch (err) {
      log.error(`[orchestrator] Failed to mark task ${taskId} as failed:`, err);
    }
  }

  /**
   * Handle merge error.
   * Called when a merger agent fails.
   */
  private async handleMergeError(taskId: string, error: Error): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      log.error(`[orchestrator] Task ${taskId} not found for merge error handling`);
      return;
    }

    log.error(`[orchestrator] Task ${taskId} merge failed:`, error);

    // Remove the merger agent
    const merger = this.mergers.get(taskId);
    if (merger) {
      this.mergers.delete(taskId);
    }

    // Mark task as failed
    try {
      task.markFailed();
      log.log(`[orchestrator] Task ${taskId} moved to FAILED state`);
    } catch (err) {
      log.error(`[orchestrator] Failed to mark task ${taskId} as failed:`, err);
    }
  }

  /**
   * Get running agents info.
   */
  getRunningAgents(): AgentInfo[] {
    const agents: AgentInfo[] = [];
    
    for (const task of this.tasks.values()) {
      const worktreePath = task.worktreePath || `${this.worktreesDir}/${task.taskId}`;
      const baseInfo = {
        taskId: task.taskId,
        startedAt: task.createdAt,
        state: task.state,
        worktreePath,
      };
      
      // Add implementor if present
      if (task.implementorAgentId) {
        agents.push({
          ...baseInfo,
          agentId: task.implementorAgentId,
        });
      }
      
      // Add reviewer if present
      if (task.reviewerAgentId) {
        agents.push({
          ...baseInfo,
          agentId: task.reviewerAgentId,
        });
      }
      
      // Add merger if present
      if (task.mergerAgentId) {
        agents.push({
          ...baseInfo,
          agentId: task.mergerAgentId,
        });
      }
    }
    
    return agents;
  }

  /**
   * Check if orchestrator is running.
   */
  isRunning(): boolean {
    return this.abortController !== null;
  }
}
