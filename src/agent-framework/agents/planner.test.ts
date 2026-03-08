import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createPlannerAgent } from "./planner.js";
import { AgentType } from "../agent-type.js";

const mocks = vi.hoisted(() => {
  const mockSessionCreate = vi.fn();
  const mockSessionRemove = vi.fn();
  const mockSendMessage = vi.fn();
  const mockGetOrCreateSession = vi.fn();

  class MockAgentInstanceManager {
    createAgentInstance = mockSessionCreate;
    removeAgentInstance = mockSessionRemove;
    sendMessage = mockSendMessage;
  }

  class MockSessionRepository {
    getOrCreateSession = mockGetOrCreateSession;
  }

  return {
    mockSessionCreate,
    mockSessionRemove,
    mockSendMessage,
    mockGetOrCreateSession,
    MockAgentInstanceManager,
    MockSessionRepository,
  };
});

vi.mock("../../templates/index.js", () => ({
  fillPlannerPromptTemplate: vi.fn(() => "test prompt"),
  getPlannerSystemPrompt: vi.fn(() => "planner system prompt"),
}));

describe("PlannerAgent", () => {
  let mockSessionManager: any;
  let mockSessionRepository: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionManager = new mocks.MockAgentInstanceManager();
    mockSessionRepository = new mocks.MockSessionRepository();
    mocks.mockGetOrCreateSession.mockReturnValue({
      filename: "planner-1",
      filePath: "/test/.orchid/sessions/session-1/planner-1.json",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("start", () => {
    it("should create session with planner system prompt", async () => {
      const mockSession = {
        instanceId: "session-1",
        taskId: "session-1",
        workingDirectory: "/test",
        createdAt: new Date(),
        status: "running" as const,
      };
      mocks.mockSessionCreate.mockResolvedValue(mockSession);
      mocks.mockSendMessage.mockResolvedValue(undefined);

      const agent = createPlannerAgent({
        sessionId: "session-1",
        requestDescription: "Test planning request",
        context: "Test context",
        workingDirectory: "/test",
        agentInstanceManager: mockSessionManager,
        sessionRepository: mockSessionRepository,
        onComplete: vi.fn(),
        onError: vi.fn(),
      });

      await agent.start();

      expect(mocks.mockGetOrCreateSession).toHaveBeenCalledWith("session-1", AgentType.PLANNER);
      expect(mocks.mockSessionCreate).toHaveBeenCalledWith({
        taskId: "session-1",
        workingDirectory: "/test",
        systemPrompt: "planner system prompt",
        sessionFilePath: "/test/.orchid/sessions/session-1/planner-1.json",
        model: { provider: "synthetic", modelId: "kimi-2.5" },
        tools: expect.arrayContaining([
          expect.any(String),
        ]),
      });
    });

    it("should send initial prompt after creating session", async () => {
      const mockSession = {
        instanceId: "session-1",
        taskId: "session-1",
        workingDirectory: "/test",
        createdAt: new Date(),
        status: "running" as const,
      };
      mocks.mockSessionCreate.mockResolvedValue(mockSession);
      mocks.mockSendMessage.mockResolvedValue(undefined);

      const agent = createPlannerAgent({
        sessionId: "session-1",
        requestDescription: "Test planning request",
        context: "Test context",
        workingDirectory: "/test",
        agentInstanceManager: mockSessionManager,
        sessionRepository: mockSessionRepository,
        onComplete: vi.fn(),
        onError: vi.fn(),
      });

      await agent.start();

      expect(mocks.mockSendMessage).toHaveBeenCalledWith(
        "session-1",
        "test prompt",
        "/test"
      );
    });

    it("should call onError if session creation fails", async () => {
      mocks.mockSessionCreate.mockRejectedValue(new Error("Session creation failed"));
      const onErrorMock = vi.fn();

      const agent = createPlannerAgent({
        sessionId: "session-1",
        requestDescription: "Test planning request",
        context: "Test context",
        workingDirectory: "/test",
        agentInstanceManager: mockSessionManager,
        sessionRepository: mockSessionRepository,
        onComplete: vi.fn(),
        onError: onErrorMock,
      });

      await agent.start();

      expect(onErrorMock).toHaveBeenCalledWith("session-1", expect.any(Error));
      expect(agent.isRunning()).toBe(false);
    });
  });

  describe("stop", () => {
    it("should remove session when stopped", async () => {
      const mockSession = {
        instanceId: "session-1",
        taskId: "session-1",
        workingDirectory: "/test",
        createdAt: new Date(),
        status: "running" as const,
      };
      mocks.mockSessionCreate.mockResolvedValue(mockSession);
      mocks.mockSendMessage.mockResolvedValue(undefined);
      mocks.mockSessionRemove.mockResolvedValue(undefined);

      const agent = createPlannerAgent({
        sessionId: "session-1",
        requestDescription: "Test planning request",
        context: "Test context",
        workingDirectory: "/test",
        agentInstanceManager: mockSessionManager,
        sessionRepository: mockSessionRepository,
        onComplete: vi.fn(),
        onError: vi.fn(),
      });

      await agent.start();
      expect(agent.isRunning()).toBe(true);

      await agent.stop();

      expect(mocks.mockSessionRemove).toHaveBeenCalledWith("session-1");
      expect(agent.isRunning()).toBe(false);
    });

    it("should not fail if stopped when not running", async () => {
      const agent = createPlannerAgent({
        sessionId: "session-1",
        requestDescription: "Test planning request",
        context: "Test context",
        workingDirectory: "/test",
        agentInstanceManager: mockSessionManager,
        sessionRepository: mockSessionRepository,
        onComplete: vi.fn(),
        onError: vi.fn(),
      });

      await expect(agent.stop()).resolves.not.toThrow();
    });
  });

  describe("handleAgentInstanceIdle", () => {
    it("should remove session and call onComplete", async () => {
      const mockSession = {
        instanceId: "session-1",
        taskId: "session-1",
        workingDirectory: "/test",
        createdAt: new Date(),
        status: "running" as const,
      };
      mocks.mockSessionCreate.mockResolvedValue(mockSession);
      mocks.mockSendMessage.mockResolvedValue(undefined);
      mocks.mockSessionRemove.mockResolvedValue(undefined);
      const onCompleteMock = vi.fn();

      const agent = createPlannerAgent({
        sessionId: "session-1",
        requestDescription: "Test planning request",
        context: "Test context",
        workingDirectory: "/test",
        agentInstanceManager: mockSessionManager,
        sessionRepository: mockSessionRepository,
        onComplete: onCompleteMock,
        onError: vi.fn(),
      });

      await agent.start();

      await (agent as any).handleAgentInstanceIdle();

      expect(mocks.mockSessionRemove).toHaveBeenCalledWith("session-1");
      expect(onCompleteMock).toHaveBeenCalledWith("session-1");
      expect(agent.isRunning()).toBe(false);
    });
  });

  describe("isRunning", () => {
    it("should return false before start", () => {
      const agent = createPlannerAgent({
        sessionId: "session-1",
        requestDescription: "Test planning request",
        context: "Test context",
        workingDirectory: "/test",
        agentInstanceManager: mockSessionManager,
        sessionRepository: mockSessionRepository,
        onComplete: vi.fn(),
        onError: vi.fn(),
      });

      expect(agent.isRunning()).toBe(false);
    });

    it("should return true after start", async () => {
      const mockSession = {
        instanceId: "session-1",
        taskId: "session-1",
        workingDirectory: "/test",
        createdAt: new Date(),
        status: "running" as const,
      };
      mocks.mockSessionCreate.mockResolvedValue(mockSession);
      mocks.mockSendMessage.mockResolvedValue(undefined);

      const agent = createPlannerAgent({
        sessionId: "session-1",
        requestDescription: "Test planning request",
        context: "Test context",
        workingDirectory: "/test",
        agentInstanceManager: mockSessionManager,
        sessionRepository: mockSessionRepository,
        onComplete: vi.fn(),
        onError: vi.fn(),
      });

      await agent.start();

      expect(agent.isRunning()).toBe(true);
    });
  });

  describe("agent identification", () => {
    it("should have correct agentId and sessionId", () => {
      const agent = createPlannerAgent({
        sessionId: "session-1",
        requestDescription: "Test planning request",
        context: "Test context",
        workingDirectory: "/test",
        agentInstanceManager: mockSessionManager,
        sessionRepository: mockSessionRepository,
        onComplete: vi.fn(),
        onError: vi.fn(),
      });

      expect(agent.sessionId).toBe("session-1");
      expect(agent.agentId).toBe("session-1-planner");
    });
  });
});
