import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getAllAgents, getAgentSessionInfo } from "./agent-service.js";
import type { AgentDisplayInfo } from "../types/index.js";
import { AgentType } from "../../agent-framework/agent-type.js";
import { TaskState } from "../../core/tasks/index.js";

// Mock the paths module
vi.mock("../../core/files/paths.js", () => ({
  getOrchidDir: () => mockOrchidDir,
}));

let mockOrchidDir: string;

describe("agent-service", () => {
  beforeEach(() => {
    mockOrchidDir = mkdtempSync(join(tmpdir(), "orchid-test-"));
    mkdirSync(join(mockOrchidDir, "sessions"), { recursive: true });
  });

  afterEach(() => {
    rmSync(mockOrchidDir, { recursive: true, force: true });
  });

  describe("getAllAgents", () => {
    it("should return empty array when no sessions exist", async () => {
      const agents = await getAllAgents();
      expect(agents).toEqual([]);
    });

    it("should parse implementor sessions correctly", async () => {
      const taskId = "test-task-123";
      const taskSessionsDir = join(mockOrchidDir, "sessions", taskId);
      mkdirSync(taskSessionsDir, { recursive: true });

      const sessionFile = join(taskSessionsDir, "implementor-1.json");
      const sessionContent = JSON.stringify({
        type: "session",
        version: 3,
        id: "session-123",
        timestamp: new Date().toISOString(),
        cwd: "/tmp/worktree",
      }) + "\n" + JSON.stringify({
        type: "message",
        id: "msg-1",
        parentId: null,
        timestamp: new Date().toISOString(),
        message: {
          role: "user",
          content: "Hello",
        },
      });

      writeFileSync(sessionFile, sessionContent);

      const agents = await getAllAgents();

      expect(agents).toHaveLength(1);
      expect(agents[0].taskId).toBe(taskId);
      expect(agents[0].agentType).toBe(AgentType.IMPLEMENTOR);
      expect(agents[0].state).toBe(TaskState.IMPLEMENTING);
      expect(agents[0].worktreePath).toBe("/tmp/worktree");
    });

    it("should parse reviewer sessions correctly", async () => {
      const taskId = "test-task-456";
      const taskSessionsDir = join(mockOrchidDir, "sessions", taskId);
      mkdirSync(taskSessionsDir, { recursive: true });

      const sessionFile = join(taskSessionsDir, "reviewer-1.json");
      const sessionContent = JSON.stringify({
        type: "session",
        version: 3,
        id: "session-456",
        timestamp: new Date().toISOString(),
        cwd: "/tmp/worktree2",
      }) + "\n" + JSON.stringify({
        type: "message",
        id: "msg-1",
        parentId: null,
        timestamp: new Date().toISOString(),
        message: {
          role: "assistant",
          content: "Done",
        },
      });

      writeFileSync(sessionFile, sessionContent);

      const agents = await getAllAgents();

      expect(agents).toHaveLength(1);
      expect(agents[0].agentType).toBe(AgentType.REVIEWER);
      expect(agents[0].state).toBe(TaskState.COMPLETED);
    });
  });

  describe("getAgentSessionInfo", () => {
    it("should return null when session file does not exist", async () => {
      const agent: AgentDisplayInfo = {
        taskId: "test",
        agentId: "test-implementor",
        agentType: AgentType.IMPLEMENTOR,
        state: TaskState.IMPLEMENTING,
        startedAt: new Date(),
        worktreePath: "/tmp",
        sessionFilePath: "/nonexistent/path.json",
      };

      const info = await getAgentSessionInfo(agent);
      expect(info).toBeNull();
    });

    it("should parse session messages correctly", async () => {
      const taskId = "test-task";
      const taskSessionsDir = join(mockOrchidDir, "sessions", taskId);
      mkdirSync(taskSessionsDir, { recursive: true });

      const sessionFile = join(taskSessionsDir, "implementor-1.json");
      const sessionContent = JSON.stringify({
        type: "session",
        version: 3,
        id: "session-123",
        timestamp: new Date().toISOString(),
        cwd: "/tmp/worktree",
      }) + "\n" + JSON.stringify({
        type: "message",
        id: "msg-1",
        parentId: null,
        timestamp: new Date().toISOString(),
        message: {
          role: "user",
          content: "Hello",
        },
      }) + "\n" + JSON.stringify({
        type: "message",
        id: "msg-2",
        parentId: "msg-1",
        timestamp: new Date().toISOString(),
        message: {
          role: "assistant",
          content: "Hi there!",
        },
      });

      writeFileSync(sessionFile, sessionContent);

      const agent: AgentDisplayInfo = {
        taskId,
        agentId: `${taskId}-implementor`,
        agentType: AgentType.IMPLEMENTOR,
        state: TaskState.IMPLEMENTING,
        startedAt: new Date(),
        worktreePath: "/tmp/worktree",
        sessionFilePath: sessionFile,
      };

      const info = await getAgentSessionInfo(agent);

      expect(info).not.toBeNull();
      expect(info!.messages).toHaveLength(2);
      expect(info!.messages[0].type).toBe("user");
      expect(info!.messages[1].type).toBe("assistant");
      expect(info!.stats!.userMessages).toBe(1);
      expect(info!.stats!.assistantMessages).toBe(1);
    });

    it("should handle tool calls in messages", async () => {
      const taskId = "test-task";
      const taskSessionsDir = join(mockOrchidDir, "sessions", taskId);
      mkdirSync(taskSessionsDir, { recursive: true });

      const sessionFile = join(taskSessionsDir, "implementor-1.json");
      const sessionContent = JSON.stringify({
        type: "session",
        version: 3,
        id: "session-123",
        timestamp: new Date().toISOString(),
        cwd: "/tmp/worktree",
      }) + "\n" + JSON.stringify({
        type: "message",
        id: "msg-1",
        parentId: null,
        timestamp: new Date().toISOString(),
        message: {
          role: "assistant",
          content: "I'll help you",
          tool_calls: [{
            id: "tool-1",
            type: "function",
            function: {
              name: "read_file",
              arguments: JSON.stringify({ path: "/tmp/file.txt" }),
            },
          }],
        },
      });

      writeFileSync(sessionFile, sessionContent);

      const agent: AgentDisplayInfo = {
        taskId,
        agentId: `${taskId}-implementor`,
        agentType: AgentType.IMPLEMENTOR,
        state: TaskState.IMPLEMENTING,
        startedAt: new Date(),
        worktreePath: "/tmp/worktree",
        sessionFilePath: sessionFile,
      };

      const info = await getAgentSessionInfo(agent);

      expect(info).not.toBeNull();
      expect(info!.messages.length).toBeGreaterThan(1);
      expect(info!.stats!.toolCalls).toBe(1);
    });
  });
});
