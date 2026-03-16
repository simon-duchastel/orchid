/**
 * TUI Types
 * 
 * Type definitions for the Orchid TUI.
 */

import type { AgentType } from "../../agent-framework/agent-type.js";
import type { TaskState } from "../../core/tasks/index.js";

export interface AgentDisplayInfo {
  taskId: string;
  agentId: string;
  agentType: AgentType;
  state: TaskState;
  startedAt: Date;
  worktreePath: string;
  sessionFilePath?: string;
}

export interface AgentSessionInfo {
  agentId: string;
  taskId: string;
  agentType: AgentType;
  messages: SessionMessage[];
  events: SessionEvent[];
  stats?: {
    totalMessages: number;
    userMessages: number;
    assistantMessages: number;
    toolCalls: number;
    tokens?: {
      input: number;
      output: number;
      total: number;
    };
  };
}

export interface SessionMessage {
  id: string;
  type: "user" | "assistant" | "tool_call" | "tool_result" | "system" | "thinking";
  content: string;
  timestamp: Date;
  toolName?: string;
  toolInput?: unknown;
}

export interface SessionEvent {
  id: string;
  type: string;
  timestamp: Date;
  data: unknown;
}

export type TUITheme = {
  colors: {
    primary: string;
    secondary: string;
    success: string;
    warning: string;
    error: string;
    muted: string;
    background: string;
    foreground: string;
    border: string;
  };
};

export const defaultTheme: TUITheme = {
  colors: {
    primary: "#6366f1",
    secondary: "#8b5cf6",
    success: "#22c55e",
    warning: "#f59e0b",
    error: "#ef4444",
    muted: "#6b7280",
    background: "#1f2937",
    foreground: "#f3f4f6",
    border: "#374151",
  },
};
