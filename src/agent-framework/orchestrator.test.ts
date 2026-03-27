import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AgentOrchestrator } from "./orchestrator.js";
import { Task, TaskState } from "../core/tasks/index.js";
import type { TaskChangeEvent } from "./services/task-stream-service.js";
import type { Task as DysonTask } from "dyson-swarm";

interface MockTaskStreamService {
  onTaskChange: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  getCurrentTasks: ReturnType<typeof vi.fn>;
  isServiceRunning: ReturnType<typeof vi.fn>;
}

const mocks = vi.hoisted(() => {
  const mockOnTaskChange = vi.fn();
  const mockStart = vi.fn();
  const mockStop = vi.fn();
  const mockGetCurrentTasks = vi.fn();
  const mockIsServiceRunning = vi.fn();
  const mockWorktreeCreate = vi.fn();
  const mockWorktreeRemove = vi.fn();
  const mockSessionCreate = vi.fn();
  const mockSessionRemove = vi.fn();
  const mockSessionStopAll = vi.fn();
  const mockSendMessage = vi.fn();
  const mockGetSession = vi.fn();
  const mockGlobalEvent = vi.fn();
  
  class MockTaskStreamService {
    onTaskChange = mockOnTaskChange;
    start = mockStart;
    stop = mockStop;
    getCurrentTasks = mockGetCurrentTasks;
    isServiceRunning = mockIsServiceRunning;
  }
  
  class MockAgentInstanceManager {
    createAgentInstance = mockSessionCreate;
    removeAgentInstance = mockSessionRemove;
    stopAllAgentInstances = mockSessionStopAll;
    sendMessage = mockSendMessage;
    getAgentInstance = mockGetSession;
    onAgentInstanceIdle = vi.fn();
  }
  
  return {
    mockOnTaskChange,
    mockStart,
    mockStop,
    mockGetCurrentTasks,
    mockIsServiceRunning,
    mockWorktreeCreate,
    mockWorktreeRemove,
    mockSessionCreate,
    mockSessionRemove,
    mockSessionStopAll,
    mockSendMessage,
    mockGetSession,
    mockGlobalEvent,
    MockTaskStreamService,
    MockAgentInstanceManager,
  };
});

vi.mock("dyson-swarm", () => ({
  TaskManager: vi.fn(),
}));

vi.mock("../core/git/worktrees/index.js", () => ({
  WorktreeManager: class MockWorktreeManager {
    create = vi.fn();
    remove = vi.fn();
    list = vi.fn();
    prune = vi.fn();
    getWorktreePath = vi.fn();
    isWorktree = vi.fn();
  },
}));

vi.mock("../config/paths.js", () => ({
  getWorktreesDir: () => "/test/worktrees",
  getOrchidDir: () => "/test/.orchid",
  getMainRepoDir: () => "/test/main",
}));

vi.mock("./session-repository.js", () => ({
  AgentType: {
    IMPLEMENTOR: "implementor",
    REVIEWER: "reviewer",
    MERGER: "merger",
  },
  createSessionRepository: () => ({
    getOrCreateSession: vi.fn((taskId: string, agentType: string) => ({
      filename: `${agentType}-1`,
      filePath: `/test/.orchid/sessions/${taskId}/${agentType}-1.json`,
    })),
  }),
}));

vi.mock("./services/task-stream-service.js", () => ({
  TaskStreamService: mocks.MockTaskStreamService,
  createTaskStreamService: () => new mocks.MockTaskStreamService(),
}));

describe("AgentOrchestrator", () => {
  let orchestrator: AgentOrchestrator;
  let mockWorktreeManager: any;
  let mockAgentInstanceManager: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    mockWorktreeManager = {
      create: mocks.mockWorktreeCreate,
      remove: mocks.mockWorktreeRemove,
      list: vi.fn(),
      prune: vi.fn(),
      getWorktreePath: vi.fn(),
      isWorktree: vi.fn(),
    };
    
    mockAgentInstanceManager = {
      createAgentInstance: mocks.mockSessionCreate,
      removeAgentInstance: mocks.mockSessionRemove,
      stopAllAgentInstances: mocks.mockSessionStopAll,
      sendMessage: mocks.mockSendMessage,
      getAgentInstance: mocks.mockGetSession,
      onAgentInstanceIdle: vi.fn(),
    };
    
    // Setup default mock implementations
    mocks.mockOnTaskChange.mockImplementation(() => {
      return vi.fn();
    });
    
    // Mock start to resolve immediately and not block
    mocks.mockStart.mockImplementation(() => {
      return Promise.resolve();
    });
    
    mocks.mockStop.mockResolvedValue(undefined);
    mocks.mockGetCurrentTasks.mockReturnValue([]);
    mocks.mockIsServiceRunning.mockReturnValue(false);
    mocks.mockSendMessage.mockResolvedValue(undefined);
    
    orchestrator = new AgentOrchestrator({ 
      worktreeManager: mockWorktreeManager,
      agentInstanceManager: mockAgentInstanceManager,
    });
  });

  afterEach(async () => {
    await orchestrator.stop();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("start", () => {
    it("should start monitoring tasks", async () => {
      await orchestrator.start();

      expect(mocks.mockOnTaskChange).toHaveBeenCalled();
      expect(mocks.mockStart).toHaveBeenCalled();
      expect(orchestrator.isRunning()).toBe(true);
    });

    it("should not start if already running", async () => {
      await orchestrator.start();

      // Reset mocks to check if second start creates new subscriptions
      mocks.mockOnTaskChange.mockClear();
      mocks.mockStart.mockClear();
      
      // Try to start again
      await orchestrator.start();
      
      // Should not have called the mocks again
      expect(mocks.mockOnTaskChange).not.toHaveBeenCalled();
      expect(mocks.mockStart).not.toHaveBeenCalled();
    });
  });

  describe("stop", () => {
    it("should stop the orchestrator", async () => {
      await orchestrator.start();
      await orchestrator.stop();

      expect(orchestrator.isRunning()).toBe(false);
    });
  });

  describe("task lifecycle", () => {
    it("should create a task for a new open task", async () => {
      const mockSession = {
        sessionId: "session-1",
        taskId: "task-1",
        workingDirectory: "/test/worktrees/task-1",
        createdAt: new Date(),
        status: "running" as const,
      };
      mocks.mockSessionCreate.mockResolvedValue(mockSession);
      mocks.mockWorktreeCreate.mockResolvedValue(true);

      // Capture the registered callback using a ref object
      const callbackRef: { current: ((event: TaskChangeEvent) => void) | null } = { current: null };
      mocks.mockOnTaskChange.mockImplementation((callback: (event: TaskChangeEvent) => void) => {
        callbackRef.current = callback;
        return vi.fn();
      });

      await orchestrator.start();
      
      // Simulate task being added
      const task: DysonTask = {
        id: "task-1",
        frontmatter: { title: "Test", assignee: undefined, dependsOn: [] },
        description: "",
        status: "open",
      };
      
      if (callbackRef.current) {
        callbackRef.current({ type: "added", task });
      }
      
      await vi.runAllTimersAsync();

      // Task should have been created - worktree creation should have been attempted
      expect(mocks.mockWorktreeCreate).toHaveBeenCalled();
    });

    it("should not start duplicate implementors for the same task", async () => {
      const mockSession = {
        sessionId: "session-1",
        taskId: "task-1",
        workingDirectory: "/test/worktrees/task-1",
        createdAt: new Date(),
        status: "running" as const,
      };
      mocks.mockSessionCreate.mockResolvedValue(mockSession);
      mocks.mockWorktreeCreate.mockResolvedValue(true);

      const callbackRef: { current: ((event: TaskChangeEvent) => void) | null } = { current: null };
      mocks.mockOnTaskChange.mockImplementation((callback: (event: TaskChangeEvent) => void) => {
        callbackRef.current = callback;
        return vi.fn();
      });

      await orchestrator.start();

      const task: DysonTask = {
        id: "task-1",
        frontmatter: { title: "Test", assignee: undefined, dependsOn: [] },
        description: "",
        status: "open",
      };
      
      // Add same task twice
      if (callbackRef.current) {
        callbackRef.current({ type: "added", task });
        await vi.runAllTimersAsync();
        callbackRef.current({ type: "added", task });
        await vi.runAllTimersAsync();
      }
      
      // Should only create one worktree
      expect(mocks.mockWorktreeCreate).toHaveBeenCalledTimes(1);
    });

    it("should cleanup tasks that are no longer open", async () => {
      mocks.mockWorktreeCreate.mockResolvedValue(true);
      mocks.mockWorktreeRemove.mockResolvedValue(true);
      
      const mockSession = {
        sessionId: "session-1",
        taskId: "task-1",
        workingDirectory: "/test/worktrees/task-1",
        createdAt: new Date(),
        status: "running" as const,
      };
      mocks.mockSessionCreate.mockResolvedValue(mockSession);

      const callbackRef: { current: ((event: TaskChangeEvent) => void) | null } = { current: null };
      mocks.mockOnTaskChange.mockImplementation((callback: (event: TaskChangeEvent) => void) => {
        callbackRef.current = callback;
        return vi.fn();
      });

      await orchestrator.start();

      const task: DysonTask = {
        id: "task-1",
        frontmatter: { title: "Test", assignee: undefined, dependsOn: [] },
        description: "",
        status: "open",
      };
      
      // Add task then remove it
      if (callbackRef.current) {
        callbackRef.current({ type: "added", task });
        await vi.runAllTimersAsync();
        callbackRef.current({ type: "removed", task });
        await vi.runAllTimersAsync();
      }
      
      expect(orchestrator.getRunningAgents()).toHaveLength(0);
    });

    it("should handle task updates", async () => {
      mocks.mockWorktreeCreate.mockResolvedValue(true);
      
      const mockSession = {
        sessionId: "session-1",
        taskId: "task-1",
        workingDirectory: "/test/worktrees/task-1",
        createdAt: new Date(),
        status: "running" as const,
      };
      mocks.mockSessionCreate.mockResolvedValue(mockSession);

      const callbackRef: { current: ((event: TaskChangeEvent) => void) | null } = { current: null };
      mocks.mockOnTaskChange.mockImplementation((callback: (event: TaskChangeEvent) => void) => {
        callbackRef.current = callback;
        return vi.fn();
      });

      await orchestrator.start();

      const task: DysonTask = {
        id: "task-1",
        frontmatter: { title: "Original Title", assignee: undefined, dependsOn: [] },
        description: "",
        status: "open",
      };
      
      const updatedTask: DysonTask = {
        ...task,
        frontmatter: { ...task.frontmatter, title: "Updated Title" },
      };
      
      // Add task then update it - should not throw
      if (callbackRef.current) {
        callbackRef.current({ type: "added", task });
        await vi.runAllTimersAsync();
        // Update should be handled without error
        expect(() => {
          callbackRef.current!({ type: "updated", task: updatedTask, previousTask: task });
        }).not.toThrow();
      }
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
      await orchestrator.start();
      
      expect(orchestrator.isRunning()).toBe(true);
    });
  });

  describe("task state machine", () => {
    it("should transition task from PENDING_IMPLEMENTATION to IMPLEMENTING", async () => {
      const task = new Task({
        taskId: "task-test",
        dysonTask: { id: "task-test", frontmatter: { title: "Test", assignee: undefined, dependsOn: [] }, description: "", status: "open" },
      });

      expect(task.state).toBe(TaskState.PENDING_IMPLEMENTATION);
      task.assignImplementor("implementor-1");
      expect(task.state).toBe(TaskState.IMPLEMENTING);
    });

    it("should transition task from IMPLEMENTING to AWAITING_REVIEW", async () => {
      const task = new Task({
        taskId: "task-test",
        dysonTask: { id: "task-test", frontmatter: { title: "Test", assignee: undefined, dependsOn: [] }, description: "", status: "open" },
      });

      task.assignImplementor("implementor-1");
      task.markImplementationComplete();
      expect(task.state).toBe(TaskState.AWAITING_REVIEW);
    });

    it("should not allow invalid state transitions", async () => {
      const task = new Task({
        taskId: "task-test",
        dysonTask: { id: "task-test", frontmatter: { title: "Test", assignee: undefined, dependsOn: [] }, description: "", status: "open" },
      });

      expect(() => task.markImplementationComplete()).toThrow();
    });
  });
});
