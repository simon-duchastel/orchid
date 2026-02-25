/**
 * Pi Session Adapter
 *
 * Implements SessionManagerInterface using the @mariozechner/pi-coding-agent SDK.
 * Uses createAgentSession with SessionManager.inMemory() for session management.
 */

import { join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import {
  type SessionManagerInterface,
  type AgentSession,
  type SessionIdleCallback,
  type CreateSessionOptions,
} from "../types.js";

export interface PiSessionAdapterOptions {
  /** Base directory for all sessions */
  sessionsDir: string;
  /** Pi API key (optional, can use env var) */
  apiKey?: string;
}

/**
 * Pi session info stored in adapter
 */
interface PiSessionInfo {
  sessionId: string;
  taskId: string;
  workingDirectory: string;
  createdAt: Date;
  status: "running" | "stopping" | "stopped";
  // Pi SDK session instance (type will be any since SDK types not available)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  piSession: any;
}

/**
 * Adapter that implements SessionManagerInterface using Pi SDK.
 * Note: Pi has no event stream, so session idle is handled via polling
 * or completion detection after sendMessage.
 */
export class PiSessionAdapter implements SessionManagerInterface {
  private sessionsDir: string;
  private apiKey: string;
  private sessions: Map<string, PiSessionInfo> = new Map();
  private idleCallbacks: SessionIdleCallback[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sessionManager: any;

  constructor(options: PiSessionAdapterOptions) {
    this.sessionsDir = options.sessionsDir;
    this.apiKey = options.apiKey || process.env.PI_API_KEY || "";

    // Ensure the sessions directory exists
    if (!existsSync(this.sessionsDir)) {
      mkdirSync(this.sessionsDir, { recursive: true });
    }

    // Initialize Pi SessionManager.inMemory()
    // This will be imported from @mariozechner/pi-coding-agent
    this.initializeSessionManager();
  }

  /**
   * Initialize the Pi SessionManager.
   * Lazy import to avoid loading SDK if not used.
   */
  private async initializeSessionManager(): Promise<void> {
    try {
      // Dynamic import to avoid requiring the SDK at build time
      const pi = await import("@mariozechner/pi-coding-agent");
      this.sessionManager = pi.SessionManager.inMemory();
    } catch (error) {
      throw new Error(
        `Failed to initialize Pi SDK: ${error instanceof Error ? error.message : "Unknown error"}. ` +
        "Make sure @mariozechner/pi-coding-agent is installed."
      );
    }
  }

  /**
   * Create a new session for an agent.
   */
  async createSession(options: CreateSessionOptions): Promise<AgentSession> {
    // Check if session already exists
    if (this.sessions.has(options.taskId)) {
      throw new Error(`Session for task ${options.taskId} already exists`);
    }

    const workingDirectory = options.workingDirectory;

    // Ensure the working directory exists
    if (!existsSync(workingDirectory)) {
      mkdirSync(workingDirectory, { recursive: true });
    }

    try {
      // Wait for session manager to be initialized
      if (!this.sessionManager) {
        await this.initializeSessionManager();
      }

      // Create Pi session using SDK
      // Note: Actual API may differ, this is based on task description
      const pi = await import("@mariozechner/pi-coding-agent");
      const piSession = await pi.createAgentSession({
        workingDirectory,
        // Additional Pi-specific options
      });

      const sessionId = `pi-${options.taskId}-${Date.now()}`;

      const sessionInfo: PiSessionInfo = {
        sessionId,
        taskId: options.taskId,
        workingDirectory,
        createdAt: new Date(),
        status: "running",
        piSession,
      };

      this.sessions.set(options.taskId, sessionInfo);

      return {
        sessionId,
        taskId: options.taskId,
        workingDirectory,
        createdAt: sessionInfo.createdAt,
        status: "running",
      };
    } catch (error) {
      throw new Error(
        `Failed to create Pi session for task ${options.taskId}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Get a session by task ID.
   */
  async getSession(taskId: string): Promise<AgentSession | undefined> {
    const sessionInfo = this.sessions.get(taskId);
    if (!sessionInfo) {
      return undefined;
    }

    return {
      sessionId: sessionInfo.sessionId,
      taskId: sessionInfo.taskId,
      workingDirectory: sessionInfo.workingDirectory,
      createdAt: sessionInfo.createdAt,
      status: sessionInfo.status,
    };
  }

  /**
   * Send a message to a session.
   * For Pi, this uses session.prompt() and handles completion detection.
   */
  async sendMessage(
    sessionId: string,
    message: string,
    workingDirectory: string
  ): Promise<void> {
    // Find session by sessionId
    let sessionInfo: PiSessionInfo | undefined;
    for (const [, info] of this.sessions) {
      if (info.sessionId === sessionId) {
        sessionInfo = info;
        break;
      }
    }

    if (!sessionInfo) {
      throw new Error(`Session ${sessionId} not found`);
    }

    try {
      // Send message via Pi SDK session.prompt()
      // Note: Actual API may differ, this is based on task description
      // Pi has no event stream, so we wait for completion
      const response = await sessionInfo.piSession.prompt(message, {
        workingDirectory,
      });

      // Handle the response - Pi returns completion directly
      // Trigger idle callback since Pi has completed the work
      if (response && response.completed) {
        this.triggerSessionIdle(sessionInfo.taskId, {
          sessionId: sessionInfo.sessionId,
          taskId: sessionInfo.taskId,
          workingDirectory: sessionInfo.workingDirectory,
          createdAt: sessionInfo.createdAt,
          status: "running",
        });
      }
    } catch (error) {
      throw new Error(
        `Failed to send message to Pi session ${sessionId}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Register a callback for session idle events.
   * For Pi, this is triggered when a prompt completes.
   */
  onSessionIdle(callback: SessionIdleCallback): void {
    this.idleCallbacks.push(callback);
  }

  /**
   * Trigger idle callbacks - called when a session becomes idle.
   */
  private triggerSessionIdle(taskId: string, session: AgentSession): void {
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
 * Factory function to create a PiSessionAdapter
 */
export function createPiSessionAdapter(
  options: PiSessionAdapterOptions
): PiSessionAdapter {
  return new PiSessionAdapter(options);
}
