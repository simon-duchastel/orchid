/**
 * Task Stream Service
 *
 * Manages the dyson-swarm task stream and provides callbacks for task changes.
 * Follows SRP by separating stream management from agent orchestration.
 */

import { TaskManager, type Task as DysonTask, type TaskFilter as DysonTaskFilter } from "dyson-swarm";

export type TaskChangeType = "added" | "removed" | "updated";

export interface TaskChangeEvent {
  type: TaskChangeType;
  task: DysonTask;
  previousTask?: DysonTask;
}

export type TaskChangeCallback = (event: TaskChangeEvent) => void;

export interface TaskStreamServiceOptions {
  /** Function that returns the working directory path */
  cwdProvider: () => string;
  /** Optional initial filter for the task stream */
  filter?: DysonTaskFilter;
}

/**
 * Service for managing the dyson-swarm task stream.
 * Provides a subscription-based interface for task changes.
 */
export class TaskStreamService {
  private taskManager: TaskManager;
  private abortController: AbortController | null = null;
  private callbacks: TaskChangeCallback[] = [];
  private currentTasks: Map<string, DysonTask> = new Map();
  private filter: DysonTaskFilter | undefined;
  private isRunning = false;

  constructor(options: TaskStreamServiceOptions) {
    this.taskManager = new TaskManager({ cwdProvider: options.cwdProvider });
    this.filter = options.filter;
  }

  /**
   * Start the task stream service.
   * Begins listening for task changes from dyson-swarm.
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.abortController = new AbortController();

    try {
      const stream = this.taskManager.listTaskStream(this.filter);

      for await (const dysonTasks of stream) {
        if (this.abortController?.signal.aborted) {
          break;
        }
        await this.processTasks(dysonTasks);
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        // Expected when stopping
      } else {
        throw error;
      }
    }
  }

  /**
   * Stop the task stream service.
   * Aborts the stream and clears all state.
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.abortController?.abort();
    this.abortController = null;
    this.isRunning = false;
    this.currentTasks.clear();
  }

  /**
   * Subscribe to task changes.
   * Returns a function to unsubscribe.
   */
  onTaskChange(callback: TaskChangeCallback): () => void {
    this.callbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index !== -1) {
        this.callbacks.splice(index, 1);
      }
    };
  }

  /**
   * Get all currently tracked tasks.
   */
  getCurrentTasks(): DysonTask[] {
    return Array.from(this.currentTasks.values());
  }

  /**
   * Check if the service is running.
   */
  isServiceRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Process a batch of tasks from the stream.
   * Detects added, removed, and updated tasks.
   */
  private async processTasks(tasks: DysonTask[]): Promise<void> {
    const newTaskIds = new Set(tasks.map((t) => t.id));
    const currentTaskIds = new Set(this.currentTasks.keys());

    // Find added tasks
    for (const task of tasks) {
      if (!currentTaskIds.has(task.id)) {
        // New task added
        this.currentTasks.set(task.id, task);
        this.notifyCallbacks({
          type: "added",
          task,
        });
      } else {
        // Check if task was updated
        const existingTask = this.currentTasks.get(task.id);
        if (existingTask && !this.areTasksEqual(existingTask, task)) {
          this.currentTasks.set(task.id, task);
          this.notifyCallbacks({
            type: "updated",
            task,
            previousTask: existingTask,
          });
        }
      }
    }

    // Find removed tasks
    for (const taskId of currentTaskIds) {
      if (!newTaskIds.has(taskId)) {
        const removedTask = this.currentTasks.get(taskId);
        if (removedTask) {
          this.currentTasks.delete(taskId);
          this.notifyCallbacks({
            type: "removed",
            task: removedTask,
          });
        }
      }
    }
  }

  /**
   * Notify all registered callbacks of a task change.
   */
  private notifyCallbacks(event: TaskChangeEvent): void {
    for (const callback of this.callbacks) {
      try {
        callback(event);
      } catch (error) {
        // Log error but don't break other callbacks
        console.error("Error in task change callback:", error);
      }
    }
  }

  /**
   * Compare two tasks for equality.
   * Checks relevant fields that might change.
   */
  private areTasksEqual(a: DysonTask, b: DysonTask): boolean {
    return (
      a.id === b.id &&
      a.status === b.status &&
      a.frontmatter.title === b.frontmatter.title &&
      a.frontmatter.assignee === b.frontmatter.assignee &&
      JSON.stringify(a.frontmatter.dependsOn) === JSON.stringify(b.frontmatter.dependsOn) &&
      a.description === b.description
    );
  }
}

/**
 * Factory function to create a TaskStreamService.
 */
export function createTaskStreamService(
  options: TaskStreamServiceOptions
): TaskStreamService {
  return new TaskStreamService(options);
}
