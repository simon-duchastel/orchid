/**
 * Reviewer Agent
 *
 * Handles the review phase of a task.
 * TODO: Implement review functionality
 */

export interface ReviewerAgent {
  readonly agentId: string;
  readonly taskId: string;
}

/**
 * Placeholder for reviewer agent implementation.
 * Will be implemented when review functionality is needed.
 */
export class ReviewerAgentImpl implements ReviewerAgent {
  readonly agentId: string;
  readonly taskId: string;

  constructor(taskId: string) {
    this.taskId = taskId;
    this.agentId = `${taskId}-reviewer`;
  }
}
