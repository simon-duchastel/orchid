/**
 * Agent Detail Component
 * 
 * Displays detailed information about a selected agent including
 * its context, events, and messages.
 */

import type { Component } from "@mariozechner/pi-tui";
import type { AgentDisplayInfo, AgentSessionInfo, SessionMessage } from "../types/index.js";
import { AgentType } from "../../agent-framework/agent-type.js";

export class AgentDetailComponent implements Component {
  private agentInfo: AgentDisplayInfo | null = null;
  private sessionInfo: AgentSessionInfo | null = null;
  private messageOffset = 0;

  constructor() {
    // Initialize with empty state
  }

  setAgentInfo(agent: AgentDisplayInfo | null, sessionInfo: AgentSessionInfo | null): void {
    this.agentInfo = agent;
    this.sessionInfo = sessionInfo;
    this.messageOffset = 0;
  }

  invalidate(): void {
    // No-op - render is stateless
  }

  handleInput?(data: string): void {
    if (!this.sessionInfo?.messages.length) return;

    if (data === "\x1b[5~" || data === "\x1b[6~") {
      // Page Up / Page Down
      const pageSize = 10;
      if (data === "\x1b[5~") {
        this.messageOffset = Math.max(0, this.messageOffset - pageSize);
      } else {
        this.messageOffset = Math.min(
          this.sessionInfo.messages.length - 1,
          this.messageOffset + pageSize
        );
      }
    }
  }

  render(width: number): string[] {
    const lines: string[] = [];

    if (!this.agentInfo) {
      lines.push("");
      lines.push(" Select an agent to view details ".padStart(Math.floor(width / 2) + 16));
      return lines;
    }

    // Header with agent info
    const agentTypeName = this.getAgentTypeName(this.agentInfo.agentType);
    const headerText = ` ${agentTypeName} Agent `;
    const padding = Math.max(0, Math.floor((width - headerText.length) / 2));
    const header = headerText.padStart(padding + headerText.length).padEnd(width);
    lines.push("\x1b[1;35m" + header + "\x1b[0m");
    lines.push("─".repeat(width));

    // Agent metadata
    lines.push(`\x1b[1mTask ID:\x1b[0m ${this.agentInfo.taskId}`.substring(0, width));
    lines.push(`\x1b[1mAgent ID:\x1b[0m ${this.agentInfo.agentId}`.substring(0, width));
    lines.push(`\x1b[1mState:\x1b[0m ${this.agentInfo.state}`.substring(0, width));
    lines.push(`\x1b[1mStarted:\x1b[0m ${this.agentInfo.startedAt.toLocaleString()}`.substring(0, width));
    lines.push(`\x1b[1mWorktree:\x1b[0m ${this.agentInfo.worktreePath}`.substring(0, width));

    // Stats section
    if (this.sessionInfo?.stats) {
      lines.push("");
      lines.push("\x1b[1;36m Statistics \x1b[0m".substring(0, width));
      lines.push(`  Messages: ${this.sessionInfo.stats.totalMessages} (User: ${this.sessionInfo.stats.userMessages}, Assistant: ${this.sessionInfo.stats.assistantMessages})`.substring(0, width));
      lines.push(`  Tool Calls: ${this.sessionInfo.stats.toolCalls}`.substring(0, width));
      
      if (this.sessionInfo.stats.tokens) {
        lines.push(`  Tokens: ${this.sessionInfo.stats.tokens.total} (In: ${this.sessionInfo.stats.tokens.input}, Out: ${this.sessionInfo.stats.tokens.output})`.substring(0, width));
      }
    }

    // Messages section
    if (this.sessionInfo?.messages.length) {
      lines.push("");
      lines.push("\x1b[1;36m Recent Messages \x1b[0m".substring(0, width));
      lines.push("─".repeat(width));

      const messagesToShow = this.sessionInfo.messages.slice(
        Math.max(0, this.sessionInfo.messages.length - 10 - this.messageOffset),
        this.sessionInfo.messages.length - this.messageOffset
      );

      for (const message of messagesToShow) {
        const formattedMessage = this.formatMessage(message, width);
        lines.push(...formattedMessage);
        lines.push("");
      }

      if (this.sessionInfo.messages.length > 10) {
        lines.push("\x1b[2m(Page Up/Down to scroll)\x1b[0m".substring(0, width));
      }
    } else {
      lines.push("");
      lines.push("\x1b[2mNo messages yet\x1b[0m".substring(0, width));
    }

    return lines;
  }

  private formatMessage(message: SessionMessage, width: number): string[] {
    const lines: string[] = [];
    const timestamp = message.timestamp.toLocaleTimeString();
    
    // Message header with role
    let roleColor = "\x1b[37m";
    let roleLabel = message.type.toUpperCase();
    
    switch (message.type) {
      case "user":
        roleColor = "\x1b[34m";
        break;
      case "assistant":
        roleColor = "\x1b[32m";
        break;
      case "tool_call":
        roleColor = "\x1b[33m";
        roleLabel = "TOOL";
        break;
      case "thinking":
        roleColor = "\x1b[35m";
        roleLabel = "THINKING";
        break;
    }

    lines.push(`${roleColor}[${roleLabel}]\x1b[0m \x1b[2m${timestamp}\x1b[0m`);

    // Message content
    const content = message.content || "(no content)";
    const maxContentWidth = width - 2;
    
    // Wrap content to width
    const words = content.split(/\s+/);
    let currentLine = "  ";
    
    for (const word of words) {
      if ((currentLine + word).length > maxContentWidth) {
        lines.push(currentLine.substring(0, width));
        currentLine = "  " + word + " ";
      } else {
        currentLine += word + " ";
      }
    }
    
    if (currentLine.trim()) {
      lines.push(currentLine.substring(0, width));
    }

    return lines;
  }

  private getAgentTypeName(type: AgentType): string {
    switch (type) {
      case AgentType.IMPLEMENTOR:
        return "🔧 Implementor";
      case AgentType.REVIEWER:
        return "👁 Reviewer";
      case AgentType.MERGER:
        return "🔀 Merger";
      default:
        return "🤖 Agent";
    }
  }
}
