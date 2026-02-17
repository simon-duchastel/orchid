import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AgentOrchestrator } from "./agent-orchestrator";

const mocks = vi.hoisted(() => {
  const mockListTaskStream = vi.fn();
  const mockAssignTask = vi.fn();
  const mockUnassignTask = vi.fn();
  const mockWorktreeCreate = vi.fn();
  const mockWorktreeRemove = vi.fn();
  const mockWorktreeList = vi.fn();
  
  class MockTaskManager {
    listTaskStream = mockListTaskStream;
    assignTask = mockAssignTask;
    unassignTask = mockUnassignTask;
  }
  
  return {
    mockListTaskStream,
    mockAssignTask,
    mockUnassignTask,
    mockWorktreeCreate,
    mockWorktreeRemove,
    mockWorktreeList,
    MockTaskManager,
  };
});

vi.mock("dyson-swarm", () => ({
  TaskManager: mocks.MockTaskManager,
}));

vi.mock("./worktrees/index.js", () => ({
  WorktreeManager: class MockWorktreeManager {
    create = vi.fn();
    remove = vi.fn();
    list = vi.fn();
    prune = vi.fn();
    getWorktreePath = vi.fn();
    isWorktree = vi.fn();
  },
}));

vi.mock("./paths.js", () => ({
  getWorktreesDir: (cwdProvider?: () => string) => "/test/worktrees",
}));

describe("AgentOrchestrator", () => {
  let orchestrator: AgentOrchestrator;
  let mockWorktreeManager: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockWorktreeManager = {
      create: mocks.mockWorktreeCreate,
      remove: mocks.mockWorktreeRemove,
      list: mocks.mockWorktreeList,
      prune: vi.fn(),
      getWorktreePath: vi.fn(),
      isWorktree: vi.fn(),
    };
    orchestrator = new AgentOrchestrator({ worktreeManager: mockWorktreeManager });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("start", () => {
    it("should start monitoring tasks", async () => {
      const streamIterator = (async function* () {
        yield [];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      const startPromise = orchestrator.start();

      await vi.runAllTimersAsync();
      await startPromise;

      expect(mocks.mockListTaskStream).toHaveBeenCalledWith({ status: "open" });
    });

    it("should not start if already running", async () => {
      const streamIterator = (async function* () {
        yield [];
        yield [];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      orchestrator.start();

      await vi.runAllTimersAsync();

      orchestrator.start();

      expect(mocks.mockListTaskStream).toHaveBeenCalledTimes(1);
    });
  });

  describe("stop", () => {
    it("should stop the orchestrator", async () => {
      const streamIterator = (async function* () {
        yield [];
        yield [];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      orchestrator.start();
      await vi.runAllTimersAsync();

      await orchestrator.stop();

      expect(orchestrator.isRunning()).toBe(false);
    });

    it("should stop all running agents", async () => {
      mocks.mockAssignTask.mockResolvedValue(undefined);
      mocks.mockUnassignTask.mockResolvedValue(undefined);
      mocks.mockWorktreeCreate.mockResolvedValue(true);
      mocks.mockWorktreeRemove.mockResolvedValue(true);

      const streamIterator = (async function* () {
        yield [{ id: "task-1", frontmatter: { title: "Test" }, description: "", status: "open" }];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      orchestrator.start();
      await vi.runAllTimersAsync();

      expect(orchestrator.getRunningAgents()).toHaveLength(1);

      await orchestrator.stop();

      expect(orchestrator.getRunningAgents()).toHaveLength(0);
      expect(mocks.mockUnassignTask).toHaveBeenCalledWith("task-1");
    });
  });

  describe("agent lifecycle", () => {
    it("should start an agent for a new open task", async () => {
      mocks.mockAssignTask.mockResolvedValue(undefined);
      mocks.mockWorktreeCreate.mockResolvedValue(true);

      const streamIterator = (async function* () {
        yield [{ id: "task-1", frontmatter: { title: "Test" }, description: "", status: "open" }];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      orchestrator.start();
      await vi.runAllTimersAsync();

      expect(mocks.mockAssignTask).toHaveBeenCalledWith("task-1", "task-1-implementor");
      expect(orchestrator.getRunningAgents()).toHaveLength(1);
      expect(orchestrator.getRunningAgents()[0]).toMatchObject({
        taskId: "task-1",
        agentId: "task-1-implementor",
        status: "running",
      });
    });

    it("should not start duplicate agents for the same task", async () => {
      mocks.mockAssignTask.mockResolvedValue(undefined);
      mocks.mockWorktreeCreate.mockResolvedValue(true);

      const task = { id: "task-1", frontmatter: { title: "Test" }, description: "", status: "open" };
      const streamIterator = (async function* () {
        yield [task];
        yield [task];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      orchestrator.start();
      await vi.runAllTimersAsync();

      expect(mocks.mockAssignTask).toHaveBeenCalledTimes(1);
      expect(mocks.mockWorktreeCreate).toHaveBeenCalledTimes(1);
      expect(orchestrator.getRunningAgents()).toHaveLength(1);
    });

    it("should stop an agent when task is no longer open", async () => {
      mocks.mockAssignTask.mockResolvedValue(undefined);
      mocks.mockUnassignTask.mockResolvedValue(undefined);
      mocks.mockWorktreeCreate.mockResolvedValue(true);
      mocks.mockWorktreeRemove.mockResolvedValue(true);

      const streamIterator = (async function* () {
        yield [{ id: "task-1", frontmatter: { title: "Test" }, description: "", status: "open" }];
        yield [];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      orchestrator.start();
      await vi.runAllTimersAsync();

      expect(mocks.mockUnassignTask).toHaveBeenCalledWith("task-1");
      expect(orchestrator.getRunningAgents()).toHaveLength(0);
    });

    it("should handle multiple tasks", async () => {
      mocks.mockAssignTask.mockResolvedValue(undefined);
      mocks.mockUnassignTask.mockResolvedValue(undefined);
      mocks.mockWorktreeCreate.mockResolvedValue(true);
      mocks.mockWorktreeRemove.mockResolvedValue(true);

      const streamIterator = (async function* () {
        yield [
          { id: "task-1", frontmatter: { title: "Test 1" }, description: "", status: "open" },
          { id: "task-2", frontmatter: { title: "Test 2" }, description: "", status: "open" },
        ];
        yield [{ id: "task-1", frontmatter: { title: "Test 1" }, description: "", status: "open" }];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      orchestrator.start();
      await vi.runAllTimersAsync();

      expect(mocks.mockAssignTask).toHaveBeenCalledWith("task-1", "task-1-implementor");
      expect(mocks.mockAssignTask).toHaveBeenCalledWith("task-2", "task-2-implementor");
      expect(mocks.mockUnassignTask).toHaveBeenCalledWith("task-2");
      expect(orchestrator.getRunningAgents()).toHaveLength(1);
    });
  });

  describe("worktree management", () => {
    it("should create a worktree when starting an agent", async () => {
      mocks.mockAssignTask.mockResolvedValue(undefined);
      mocks.mockWorktreeCreate.mockResolvedValue(true);

      const streamIterator = (async function* () {
        yield [{ id: "task-123", frontmatter: { title: "Test" }, description: "", status: "open" }];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      orchestrator.start();
      await vi.runAllTimersAsync();

      expect(mocks.mockWorktreeCreate).toHaveBeenCalledWith(
        "/test/worktrees/task-123",
        "HEAD",
        { detach: true }
      );
      expect(orchestrator.getRunningAgents()[0].worktreePath).toBe(
        "/test/worktrees/task-123"
      );
    });

    it("should remove the worktree when stopping an agent", async () => {
      mocks.mockAssignTask.mockResolvedValue(undefined);
      mocks.mockUnassignTask.mockResolvedValue(undefined);
      mocks.mockWorktreeCreate.mockResolvedValue(true);
      mocks.mockWorktreeRemove.mockResolvedValue(true);

      const streamIterator = (async function* () {
        yield [{ id: "task-123", frontmatter: { title: "Test" }, description: "", status: "open" }];
        yield [];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      orchestrator.start();
      await vi.runAllTimersAsync();

      expect(mocks.mockWorktreeRemove).toHaveBeenCalledWith(
        "/test/worktrees/task-123",
        { force: true }
      );
    });

    it("should force remove worktree even if dirty", async () => {
      mocks.mockAssignTask.mockResolvedValue(undefined);
      mocks.mockUnassignTask.mockResolvedValue(undefined);
      mocks.mockWorktreeCreate.mockResolvedValue(true);
      mocks.mockWorktreeRemove.mockResolvedValue(true);

      const streamIterator = (async function* () {
        yield [{ id: "task-456", frontmatter: { title: "Test" }, description: "", status: "open" }];
        yield [];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      orchestrator.start();
      await vi.runAllTimersAsync();

      expect(mocks.mockWorktreeRemove).toHaveBeenCalledWith(
        expect.any(String),
        { force: true }
      );
    });

    it("should continue unassigning task even if worktree removal fails", async () => {
      mocks.mockAssignTask.mockResolvedValue(undefined);
      mocks.mockUnassignTask.mockResolvedValue(undefined);
      mocks.mockWorktreeCreate.mockResolvedValue(true);
      mocks.mockWorktreeRemove.mockRejectedValue(new Error("Failed to remove worktree"));

      const streamIterator = (async function* () {
        yield [{ id: "task-789", frontmatter: { title: "Test" }, description: "", status: "open" }];
        yield [];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      orchestrator.start();
      await vi.runAllTimersAsync();

      expect(mocks.mockUnassignTask).toHaveBeenCalledWith("task-789");
      expect(orchestrator.getRunningAgents()).toHaveLength(0);
    });

    it("should not start agent if worktree creation fails", async () => {
      mocks.mockAssignTask.mockResolvedValue(undefined);
      mocks.mockWorktreeCreate.mockRejectedValue(new Error("Failed to create worktree"));

      const streamIterator = (async function* () {
        yield [{ id: "task-fail", frontmatter: { title: "Test" }, description: "", status: "open" }];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      orchestrator.start();
      await vi.runAllTimersAsync();

      expect(mocks.mockAssignTask).not.toHaveBeenCalled();
      expect(orchestrator.getRunningAgents()).toHaveLength(0);
    });

    it("should create unique worktree paths for different tasks", async () => {
      mocks.mockAssignTask.mockResolvedValue(undefined);
      mocks.mockWorktreeCreate.mockResolvedValue(true);

      const streamIterator = (async function* () {
        yield [
          { id: "task-alpha", frontmatter: { title: "Alpha" }, description: "", status: "open" },
          { id: "task-beta", frontmatter: { title: "Beta" }, description: "", status: "open" },
        ];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      orchestrator.start();
      await vi.runAllTimersAsync();

      const agents = orchestrator.getRunningAgents();
      const worktreePaths = agents.map((a) => a.worktreePath);
      expect(new Set(worktreePaths).size).toBe(2);
      expect(worktreePaths).toContain("/test/worktrees/task-alpha");
      expect(worktreePaths).toContain("/test/worktrees/task-beta");
    });
  });

  describe("getRunningAgents", () => {
    it("should return empty array when no agents running", () => {
      expect(orchestrator.getRunningAgents()).toEqual([]);
    });
  });

  describe("isRunning", () => {
    it("should return false when not started", () => {
      expect(orchestrator.isRunning()).toBe(false);
    });

    it("should return true when started", async () => {
      const streamIterator = (async function* () {
        yield [];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      orchestrator.start();
      await vi.runAllTimersAsync();

      expect(orchestrator.isRunning()).toBe(true);
    });
  });
});
