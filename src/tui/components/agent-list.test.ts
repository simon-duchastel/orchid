import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgentListComponent } from "./agent-list.js";
import type { AgentDisplayInfo } from "../types/index.js";
import { AgentType } from "../../agent-framework/agent-type.js";
import { TaskState } from "../../core/tasks/index.js";

describe("AgentListComponent", () => {
  let component: AgentListComponent;
  let mockOnSelect: (agent: AgentDisplayInfo) => void;

  beforeEach(() => {
    mockOnSelect = vi.fn() as unknown as (agent: AgentDisplayInfo) => void;
    component = new AgentListComponent({ onSelect: mockOnSelect });
  });

  describe("setAgents", () => {
    it("should store agents", () => {
      const agents: AgentDisplayInfo[] = [
        {
          taskId: "task-1",
          agentId: "task-1-implementor",
          agentType: AgentType.IMPLEMENTOR,
          state: TaskState.IMPLEMENTING,
          startedAt: new Date(),
          worktreePath: "/tmp/worktree-1",
        },
      ];

      component.setAgents(agents);
      // Verify by rendering
      const lines = component.render(80);
      expect(lines.some(line => line.includes("task-1"))).toBe(true);
    });

    it("should show empty message when no agents", () => {
      component.setAgents([]);
      const lines = component.render(80);
      expect(lines.some(line => line.includes("No agents running"))).toBe(true);
    });
  });

  describe("render", () => {
    it("should render header", () => {
      const lines = component.render(80);
      expect(lines[0]).toContain("Agents");
    });

    it("should render agent list with correct formatting", () => {
      const agents: AgentDisplayInfo[] = [
        {
          taskId: "abc123",
          agentId: "abc123-implementor",
          agentType: AgentType.IMPLEMENTOR,
          state: TaskState.IMPLEMENTING,
          startedAt: new Date(),
          worktreePath: "/tmp/worktree",
        },
        {
          taskId: "def456",
          agentId: "def456-reviewer",
          agentType: AgentType.REVIEWER,
          state: TaskState.REVIEWING,
          startedAt: new Date(),
          worktreePath: "/tmp/worktree2",
        },
      ];

      component.setAgents(agents);
      const lines = component.render(80);

      // Should contain both task IDs
      expect(lines.some(line => line.includes("abc123"))).toBe(true);
      expect(lines.some(line => line.includes("def456"))).toBe(true);

      // Should contain agent types
      expect(lines.some(line => line.includes("🔧"))).toBe(true);
      expect(lines.some(line => line.includes("👁"))).toBe(true);
    });
  });

  describe("handleInput", () => {
    it("should select agent on enter", () => {
      const agents: AgentDisplayInfo[] = [
        {
          taskId: "task-1",
          agentId: "task-1-implementor",
          agentType: AgentType.IMPLEMENTOR,
          state: TaskState.IMPLEMENTING,
          startedAt: new Date(),
          worktreePath: "/tmp/worktree",
        },
      ];

      component.setAgents(agents);
      component.handleInput!("\r"); // Enter key

      expect(mockOnSelect).toHaveBeenCalledWith(agents[0]);
    });

    it("should navigate with arrow keys", () => {
      const agents: AgentDisplayInfo[] = [
        {
          taskId: "task-1",
          agentId: "task-1-implementor",
          agentType: AgentType.IMPLEMENTOR,
          state: TaskState.IMPLEMENTING,
          startedAt: new Date(),
          worktreePath: "/tmp/worktree-1",
        },
        {
          taskId: "task-2",
          agentId: "task-2-reviewer",
          agentType: AgentType.REVIEWER,
          state: TaskState.REVIEWING,
          startedAt: new Date(),
          worktreePath: "/tmp/worktree-2",
        },
      ];

      component.setAgents(agents);
      
      // Select second agent
      component.handleInput!("\x1b[B"); // Down arrow
      component.handleInput!("\r"); // Enter

      expect(mockOnSelect).toHaveBeenCalledWith(agents[1]);
    });
  });
});
