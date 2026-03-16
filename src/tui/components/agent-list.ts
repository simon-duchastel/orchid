/**
 * Agent List Component
 * 
 * Displays a list of agents with their status, allowing selection.
 */

import type { Component } from "@mariozechner/pi-tui";
import type { AgentDisplayInfo } from "../types/index.js";
import { AgentType } from "../../agent-framework/agent-type.js";
import { TaskState } from "../../core/tasks/index.js";

interface AgentListOptions {
  onSelect: (agent: AgentDisplayInfo) => void;
}

export class AgentListComponent implements Component {
  private agents: AgentDisplayInfo[] = [];
  private selectedIndex = 0;
  private onSelect: (agent: AgentDisplayInfo) => void;

  constructor(options: AgentListOptions) {
    this.onSelect = options.onSelect;
  }

  setAgents(agents: AgentDisplayInfo[]): void {
    this.agents = agents;
  }

  invalidate(): void {
    // No-op - render is stateless
  }

  handleInput?(data: string): void {
    if (data === "\x1b[A" || data === "k") {
      // Up arrow or 'k'
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
    } else if (data === "\x1b[B" || data === "j") {
      // Down arrow or 'j'
      this.selectedIndex = Math.min(this.agents.length - 1, this.selectedIndex + 1);
    } else if (data === "\r" || data === "\n") {
      // Enter
      if (this.agents[this.selectedIndex]) {
        this.onSelect(this.agents[this.selectedIndex]);
      }
    }
  }

  render(width: number): string[] {
    const lines: string[] = [];
    
    // Header
    const headerText = " Agents ";
    const padding = Math.max(0, Math.floor((width - headerText.length) / 2));
    const header = headerText.padStart(padding + headerText.length).padEnd(width);
    lines.push("\x1b[1;36m" + header + "\x1b[0m");
    lines.push("─".repeat(width));

    if (this.agents.length === 0) {
      lines.push("");
      lines.push("No agents running".padStart(Math.floor(width / 2) + 8).substring(0, width));
    } else {
      for (let i = 0; i < this.agents.length; i++) {
        const agent = this.agents[i];
        const isSelected = i === this.selectedIndex;
        
        const agentTypeIcon = this.getAgentTypeIcon(agent.agentType);
        const statusColor = this.getStatusColor(agent.state);
        const statusIcon = this.getStatusIcon(agent.state);
        
        // Format: [ICON] TaskID - AgentType (Status)
        const line = `${isSelected ? "\x1b[7m" : ""}${agentTypeIcon} ${agent.taskId.substring(0, 20).padEnd(22)} ${statusColor}${statusIcon}\x1b[0m ${agent.state}${isSelected ? "\x1b[0m" : ""}`;
        
        lines.push(line.substring(0, width));
      }
    }

    // Add help text at bottom
    lines.push("");
    lines.push("\x1b[2m↑/↓ or j/k: Navigate | Enter: Select | q: Quit\x1b[0m".substring(0, width));

    return lines;
  }

  private getAgentTypeIcon(type: AgentType): string {
    switch (type) {
      case AgentType.IMPLEMENTOR:
        return "🔧";
      case AgentType.REVIEWER:
        return "👁";
      case AgentType.MERGER:
        return "🔀";
      default:
        return "🤖";
    }
  }

  private getStatusColor(state: TaskState): string {
    switch (state) {
      case TaskState.COMPLETED:
        return "\x1b[32m"; // Green
      case TaskState.FAILED:
        return "\x1b[31m"; // Red
      case TaskState.IMPLEMENTING:
      case TaskState.REVIEWING:
      case TaskState.MERGING:
        return "\x1b[33m"; // Yellow
      case TaskState.AWAITING_REVIEW:
      case TaskState.AWAITING_MERGE:
        return "\x1b[34m"; // Blue
      default:
        return "\x1b[37m"; // White
    }
  }

  private getStatusIcon(state: TaskState): string {
    switch (state) {
      case TaskState.COMPLETED:
        return "✓";
      case TaskState.FAILED:
        return "✗";
      case TaskState.IMPLEMENTING:
      case TaskState.REVIEWING:
      case TaskState.MERGING:
        return "⟳";
      case TaskState.AWAITING_REVIEW:
      case TaskState.AWAITING_MERGE:
        return "⏸";
      default:
        return "○";
    }
  }
}
