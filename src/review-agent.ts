/**
 * Review Agent
 *
 * Handles invocation of review agents when implementor agents complete their work.
 * The orchestrator is responsible for detecting when agents become idle.
 */

import type { AgentSession } from "./opencode-session.js";
import { log } from "./utils/logger.js";

export interface ReviewAgentOptions {
  /** Optional callback when review is invoked */
  onReviewInvoked?: (taskId: string, sessionId: string) => void;
}

/**
 * Manages review agents that are triggered when implementor agents complete.
 * This class is intentionally simple - the orchestrator handles idle detection.
 */
export class ReviewAgent {
  private onReviewInvoked?: (taskId: string, sessionId: string) => void;

  constructor(options: ReviewAgentOptions = {}) {
    this.onReviewInvoked = options.onReviewInvoked;
  }

  /**
   * Invoke the review agent for a completed task.
   * This is called by the orchestrator when an implementor agent becomes idle.
   *
   * TODO: Implement actual review agent invocation
   * This should:
   * 1. Create a new review session or use an existing review agent
   * 2. Pass the completed task information
   * 3. Trigger the review process
   *
   * @param session - The agent session that has completed
   */
  async invokeReview(session: AgentSession): Promise<void> {
    const { sessionId, taskId, workingDirectory } = session;

    log.log(`[review-agent] Invoking review for task ${taskId} (session ${sessionId})`);
    log.log(`[review-agent] Working directory: ${workingDirectory}`);

    // TODO: Implement actual review agent invocation
    // For now, just log and call the callback if provided
    if (this.onReviewInvoked) {
      this.onReviewInvoked(taskId, sessionId);
    }

    // Placeholder for future implementation:
    // - Create review session
    // - Pass task context and changes
    // - Start review process
  }

  /**
   * Check if a session should be reviewed.
   * Override this method to add custom filtering logic.
   *
   * @param session - The session to check
   * @returns true if the session should be reviewed
   */
  shouldReview(session: AgentSession): boolean {
    // By default, review all completed sessions
    return true;
  }
}
