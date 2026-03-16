/**
 * Orchid TUI
 * 
 * Interactive terminal UI for monitoring and inspecting agents.
 * Uses pi-tui from the @mariozechner/pi-coding-agent package.
 */

import { TUI, Container, ProcessTerminal, Text } from "@mariozechner/pi-tui";
import { AgentListComponent } from "./components/agent-list.js";
import { AgentDetailComponent } from "./components/agent-detail.js";
import type { AgentDisplayInfo, AgentSessionInfo } from "./types/index.js";
import { getAllAgents, getAgentSessionInfo } from "./services/agent-service.js";

export async function runTUI(): Promise<void> {
  const terminal = new ProcessTerminal();
  const tui = new TUI(terminal);

  // State
  let agents: AgentDisplayInfo[] = [];
  let selectedAgent: AgentDisplayInfo | null = null;
  let agentSessionInfo: AgentSessionInfo | null = null;
  let refreshInterval: ReturnType<typeof setInterval> | null = null;
  let isQuitting = false;

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

  // Add quit handler
  tui.addInputListener((data: string) => {
    if (data === "q" || data === "\x03") {
      // 'q' or Ctrl+C
      isQuitting = true;
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
      tui.stop();
      return { consume: true };
    }
    return undefined;
  });

  // Initial load of agents
  agents = await getAllAgents();
  agentList.setAgents(agents);

  // Start TUI
  tui.start();

  // Refresh agents periodically
  refreshInterval = setInterval(async () => {
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
  }, 2000);

  // Handle cleanup on exit
  process.on("SIGINT", () => {
    isQuitting = true;
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
    tui.stop();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    isQuitting = true;
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
    tui.stop();
    process.exit(0);
  });
}
