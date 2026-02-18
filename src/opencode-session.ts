/**
 * OpenCode Session Manager
 *
 * Manages individual OpenCode sessions for each agent using the SDK's Session API.
 * Each agent gets its own isolated session associated with its worktree directory.
 */

import { createOpencodeClient, type OpencodeClient } from "@opencode-ai/sdk";
import { join } from "node:path";
import { mkdirSync, existsSync } from "node:fs";

export interface AgentSession {
  /** Unique session identifier (from OpenCode) */
  sessionId: string;
  /** The task/agent this session belongs to */
  taskId: string;
  /** Path to the session's working directory (the worktree) */
  workingDirectory: string;
  /** The OpenCode client instance */
  client: OpencodeClient;
  /** When the session was created */
  createdAt: Date;
  /** Session status */
  status: "running" | "stopping" | "stopped";
}

export interface CreateSessionOptions {
  /** Base URL for the OpenCode server */
  baseUrl: string;
  /** Optional session title */
  title?: string;
}

export interface OpencodeSessionManagerOptions {
  /** Base directory for all sessions (typically the worktrees directory) */
  sessionsDir: string;
}

/**
 * Manages OpenCode sessions for agents.
 *
 * Each session is an isolated OpenCode session created via the SDK's Session API.
 * Sessions are associated with the agent's worktree directory.
 */
export class OpencodeSessionManager {
  private sessions: Map<string, AgentSession> = new Map();
  private sessionsDir: string;

  constructor(options: OpencodeSessionManagerOptions) {
    this.sessionsDir = options.sessionsDir;

    // Ensure the sessions directory exists
    if (!existsSync(this.sessionsDir)) {
      mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  /**
   * Create a new OpenCode session for an agent.
   *
   * @param taskId - The task ID (used as the session identifier base)
   * @param options - Configuration options for the session
   * @returns The created session info
   * @throws Error if session already exists or creation fails
   */
  async createSession(
    taskId: string,
    options: CreateSessionOptions
  ): Promise<AgentSession> {
    if (this.sessions.has(taskId)) {
      throw new Error(`Session for task ${taskId} already exists`);
    }

    const workingDirectory = join(this.sessionsDir, taskId);

    // Ensure the working directory exists (should be created by worktree manager first)
    if (!existsSync(workingDirectory)) {
      mkdirSync(workingDirectory, { recursive: true });
    }

    try {
      // Create an OpenCode client connected to the server
      const client = createOpencodeClient({
        baseUrl: options.baseUrl,
      });

      // Create a new session via the SDK
      // Parameters are passed via query for directory and body for other options
      const createResponse = await client.session.create({
        query: {
          directory: workingDirectory,
        },
        body: {
          title: options.title ?? `Agent Session for ${taskId}`,
        },
      });

      if (createResponse.error) {
        throw new Error(`Failed to create session: ${createResponse.error}`);
      }

      // Extract the session ID from the response
      const sessionId = this.extractSessionId(createResponse.data);

      if (!sessionId) {
        throw new Error("Failed to get session ID from create response");
      }

      const agentSession: AgentSession = {
        sessionId,
        taskId,
        workingDirectory,
        client,
        createdAt: new Date(),
        status: "running",
      };

      this.sessions.set(taskId, agentSession);

      return agentSession;
    } catch (error) {
      throw new Error(
        `Failed to create session for task ${taskId}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Extract session ID from the create response.
   * Handles different response formats based on SDK version.
   */
  private extractSessionId(data: unknown): string | undefined {
    if (!data) return undefined;

    // Try different possible response structures
    if (typeof data === "object") {
      // Direct ID field
      if ("id" in data && typeof (data as Record<string, unknown>).id === "string") {
        return (data as Record<string, unknown>).id as string;
      }
      // Nested in data field
      if ("data" in data && typeof (data as Record<string, unknown>).data === "object") {
        const nestedData = (data as Record<string, unknown>).data as Record<string, unknown>;
        if (nestedData && "id" in nestedData && typeof nestedData.id === "string") {
          return nestedData.id;
        }
      }
      // Session ID field
      if ("sessionId" in data && typeof (data as Record<string, unknown>).sessionId === "string") {
        return (data as Record<string, unknown>).sessionId as string;
      }
    }

    return undefined;
  }

  /**
   * Get a session by task ID.
   *
   * @param taskId - The task identifier
   * @returns The session info or undefined if not found
   */
  getSession(taskId: string): AgentSession | undefined {
    return this.sessions.get(taskId);
  }

  /**
   * Get all active sessions.
   *
   * @returns Array of all session info
   */
  getAllSessions(): AgentSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Check if a session exists for a task.
   *
   * @param taskId - The task identifier
   * @returns true if the session exists
   */
  hasSession(taskId: string): boolean {
    return this.sessions.has(taskId);
  }

  /**
   * Remove a session.
   *
   * @param taskId - The task identifier
   * @throws Error if session doesn't exist
   */
  async removeSession(taskId: string): Promise<void> {
    const session = this.sessions.get(taskId);
    if (!session) {
      throw new Error(`Session for task ${taskId} not found`);
    }

    session.status = "stopping";

    try {
      // Delete the session via the SDK
      await session.client.session.delete({
        path: {
          id: session.sessionId,
        },
        query: {
          directory: session.workingDirectory,
        },
      });
    } catch (error) {
      // Log but don't throw - we still want to clean up our tracking
      console.error(
        `[session-manager] Error deleting session ${session.sessionId} for task ${taskId}:`,
        error
      );
    }

    // Remove from our tracking
    this.sessions.delete(taskId);
  }

  /**
   * Stop all active sessions.
   */
  async stopAllSessions(): Promise<void> {
    const taskIds = Array.from(this.sessions.keys());
    await Promise.all(taskIds.map((id) => this.removeSession(id).catch(() => {})));
  }

  /**
   * Get the number of active sessions.
   */
  getSessionCount(): number {
    return this.sessions.size;
  }
}
