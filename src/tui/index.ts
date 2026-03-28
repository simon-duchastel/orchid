/**
 * Orchid TUI
 * 
 * Interactive terminal UI for monitoring and inspecting agents.
 * Uses pi-tui from the @mariozechner/pi-coding-agent package.
 * Now uses TaskStreamService for real-time updates instead of polling.
 */

import { TUI, Container, ProcessTerminal } from "@mariozechner/pi-tui";
import { AgentListComponent } from "./components/agent-list.js";
import { AgentDetailComponent } from "./components/agent-detail.js";
import type { AgentDisplayInfo, AgentSessionInfo } from "./types/index.js";
import { getAllAgents, getAgentSessionInfo } from "./services/agent-service.js";
import { TaskStreamService, type TaskChangeEvent } from "../agent-framework/services/task-stream-service.js";
import { log } from "../core/logging/index.js";

export async function runTUI(): Promise<void> {
  const terminal = new ProcessTerminal();
  const tui = new TUI(terminal);

  // State
  let agents: AgentDisplayInfo[] = [];
  let selectedAgent: AgentDisplayInfo | null = null;
  let agentSessionInfo: AgentSessionInfo | null = null;
  let isQuitting = false;
  let unsubscribeFromTaskChanges: (() => void) | null = null;

  // Create task stream service for real-time updates
  const taskStreamService = new TaskStreamService({
    cwdProvider: () => process.cwd(),
  });

  // Create agent list component
  const agentList = new AgentListComponent({
    onSelect: async (agent: AgentDisplayInfo) => {
      selectedAgent = agent;
      agentSessionInfo = await getAgentSessionInfo(agent);
      agentDetail.setAgentInfo(agent, agentSessionInfo);
      tui.requestRender();
    },
  });

  // Create agent detail component
  const agentDetail = new AgentDetailComponent();

  // Create layout container that splits screen
  const mainContainer = new Container();
  mainContainer.addChild(agentList);
  mainContainer.addChild(agentDetail);

  tui.addChild(mainContainer);

  // Function to refresh agents display
  async function refreshAgents(): Promise<void> {
    if (isQuitting) return;
    
    try {
      agents = await getAllAgents();
      agentList.setAgents(agents);
      
      // Refresh selected agent info if any
      if (selectedAgent) {
        const updatedAgent = agents.find(a => a.agentId === selectedAgent!.agentId);
        if (updatedAgent) {
          selectedAgent = updatedAgent;
          agentSessionInfo = await getAgentSessionInfo(selectedAgent);
          agentDetail.setAgentInfo(selectedAgent, agentSessionInfo);
        }
      }
      
      tui.requestRender();
    } catch (error) {
      // Ignore errors during refresh
    }
  }

  // Handle task changes from the stream
  function handleTaskChange(event: TaskChangeEvent): void {
    log.log(`[tui] Task ${event.type}: ${event.task.id}`);
    // Refresh the agents display when tasks change
    refreshAgents();
  }

  // Add quit handler
  tui.addInputListener((data: string) => {
    if (data === "q" || data === "\x03") {
      // 'q' or Ctrl+C
      isQuitting = true;
      if (unsubscribeFromTaskChanges) {
        unsubscribeFromTaskChanges();
      }
      taskStreamService.stop();
      tui.stop();
      return { consume: true };
    }
    return undefined;
  });

  // Initial load of agents
  await refreshAgents();

  // Start TUI
  tui.start();

  // Subscribe to task changes for real-time updates
  unsubscribeFromTaskChanges = taskStreamService.onTaskChange(handleTaskChange);
  
  // Start the task stream service (runs in background)
  taskStreamService.start().catch((error) => {
    log.error("[tui] Task stream service error:", error);
  });

  // Handle cleanup on exit
  process.on("SIGINT", () => {
    isQuitting = true;
    if (unsubscribeFromTaskChanges) {
      unsubscribeFromTaskChanges();
    }
    taskStreamService.stop();
    tui.stop();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    isQuitting = true;
    if (unsubscribeFromTaskChanges) {
      unsubscribeFromTaskChanges();
    }
    taskStreamService.stop();
    tui.stop();
    process.exit(0);
  });
}
