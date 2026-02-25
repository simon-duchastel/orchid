/**
 * OpenCode Session Adapter
 *
 * Implements SessionManagerInterface using the @opencode-ai/sdk.
 * Wraps OpencodeSessionManager to provide a unified interface.
 */

import { OpencodeSessionManager } from "../../opencode/session/index.js";
import {
  type SessionManagerInterface,
  type AgentSession,
  type SessionIdleCallback,
} from "../types.js";

export interface OpencodeSessionAdapterOptions {
  /** Base directory for all sessions */
  sessionsDir: string;
  /** Base URL for the OpenCode server */
  baseUrl: string;
}

/**
 * Adapter that wraps OpencodeSessionManager to implement SessionManagerInterface.
 * Maintains all existing error handling from the original implementation.
 */
export class OpencodeSessionAdapter implements SessionManagerInterface {
  private manager: OpencodeSessionManager;
  private idleCallbacks: SessionIdleCallback[] = [];

  constructor(options: OpencodeSessionAdapterOptions) {
    this.manager = new OpencodeSessionManager({
      sessionsDir: options.sessionsDir,
      baseUrl: options.baseUrl,
    });
  }

  /**
   * Create a new session for an agent.
   */
  async createSession(taskId: string): Promise<AgentSession> {
    return this.manager.createSession(taskId);
  }

  /**
   * Get a session by task ID.
   */
  async getSession(taskId: string): Promise<AgentSession | undefined> {
    return this.manager.getSession(taskId);
  }

  /**
   * Send a message to a session.
   */
  async sendMessage(
    sessionId: string,
    message: string,
    workingDirectory: string
  ): Promise<void> {
    return this.manager.sendMessage(sessionId, message, workingDirectory);
  }

  /**
   * Remove a session.
   */
  async removeSession(taskId: string): Promise<void> {
    return this.manager.removeSession(taskId);
  }

  /**
   * Stop all active sessions.
   */
  async stopAllSessions(): Promise<void> {
    return this.manager.stopAllSessions();
  }

  /**
   * Register a callback for session idle events.
   * For opencode, this is triggered via the event stream.
   */
  onSessionIdle(callback: SessionIdleCallback): void {
    this.idleCallbacks.push(callback);
  }

  /**
   * Get the underlying OpencodeSessionManager instance.
   * Useful for accessing opencode-specific functionality if needed.
   */
  getManager(): OpencodeSessionManager {
    return this.manager;
  }

  /**
   * Get the OpenCode client for event streaming.
   * This is opencode-specific and not part of the generic interface.
   */
  getClient() {
    return this.manager.getClient();
  }

  /**
   * Trigger idle callbacks - called when a session becomes idle.
   * This should be called by the event handler when opencode reports session idle.
   */
  triggerSessionIdle(taskId: string, session: AgentSession): void {
    for (const callback of this.idleCallbacks) {
      try {
        callback(taskId, session);
      } catch (error) {
        // Log but don't let one callback failure stop others
        console.error("Error in session idle callback:", error);
      }
    }
  }
}

/**
 * Factory function to create an OpencodeSessionAdapter
 */
export function createOpencodeSessionAdapter(
  options: OpencodeSessionAdapterOptions
): OpencodeSessionAdapter {
  return new OpencodeSessionAdapter(options);
}
