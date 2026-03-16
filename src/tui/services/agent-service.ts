/**
 * Agent Service
 * 
 * Service for fetching agent information and session data.
 */

import { readdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentDisplayInfo, AgentSessionInfo, SessionMessage, SessionEvent } from "../types/index.js";
import { AgentType } from "../../agent-framework/agent-type.js";
import { TaskState } from "../../core/tasks/index.js";
import { getOrchidDir } from "../../core/files/paths.js";

interface SessionFileEntry {
  type: string;
  id: string;
  parentId: string | null;
  timestamp: string;
  [key: string]: unknown;
}

interface SessionMessageEntry extends SessionFileEntry {
  type: "message";
  message: {
    role: string;
    content: string | Array<{ type: string; text?: string }>;
    tool_calls?: Array<{
      id: string;
      type: string;
      function: {
        name: string;
        arguments: string;
      };
    }>;
  };
}

interface SessionCustomEntry extends SessionFileEntry {
  type: "custom";
  customType: string;
  data?: unknown;
}

export async function getAllAgents(): Promise<AgentDisplayInfo[]> {
  const agents: AgentDisplayInfo[] = [];
  const cwd = process.cwd();
  
  // Get sessions directory
  const orchidDir = getOrchidDir(() => cwd);
  const sessionsDir = join(orchidDir, "sessions");
  
  if (!existsSync(sessionsDir)) {
    return agents;
  }

  // Read all task directories
  const taskDirs = readdirSync(sessionsDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  for (const taskId of taskDirs) {
    const taskSessionsDir = join(sessionsDir, taskId);
    
    // Read all session files in this task directory
    const sessionFiles = readdirSync(taskSessionsDir)
      .filter(file => file.endsWith(".json"));

    for (const sessionFile of sessionFiles) {
      // Parse agent type from filename (e.g., "implementor-1.json")
      const match = sessionFile.match(/^(implementor|reviewer|merger)-(\d+)\.json$/);
      if (match) {
        const agentTypeStr = match[1];
        const agentType = agentTypeStr === "reviewer" 
          ? AgentType.REVIEWER 
          : agentTypeStr === "merger" 
            ? AgentType.MERGER 
            : AgentType.IMPLEMENTOR;
        
        const sessionFilePath = join(taskSessionsDir, sessionFile);
        const stats = readFileSync(sessionFilePath);
        const entries: SessionFileEntry[] = stats.toString()
          .split("\n")
          .filter(line => line.trim())
          .map(line => JSON.parse(line) as SessionFileEntry);

        // Find header to get worktree path
        const header = entries.find(e => e.type === "session") as { cwd?: string } | undefined;
        const worktreePath = header?.cwd || "";

        // Determine state based on session content
        let state = TaskState.PENDING_IMPLEMENTATION;
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          if (lastEntry.type === "message") {
            const msgEntry = lastEntry as SessionMessageEntry;
            if (msgEntry.message?.role === "assistant") {
              state = TaskState.COMPLETED;
            } else if (msgEntry.message?.role === "user") {
              state = TaskState.IMPLEMENTING;
            }
          }
        }

        agents.push({
          taskId,
          agentId: `${taskId}-${agentTypeStr}`,
          agentType,
          state,
          startedAt: new Date(entries[0]?.timestamp || Date.now()),
          worktreePath,
          sessionFilePath,
        });
      }
    }
  }

  return agents.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
}

export async function getAgentSessionInfo(
  agent: AgentDisplayInfo
): Promise<AgentSessionInfo | null> {
  if (!agent.sessionFilePath || !existsSync(agent.sessionFilePath)) {
    return null;
  }

  try {
    const content = readFileSync(agent.sessionFilePath, "utf-8");
    const entries: SessionFileEntry[] = content
      .split("\n")
      .filter(line => line.trim())
      .map(line => JSON.parse(line) as SessionFileEntry);

    const messages: SessionMessage[] = [];
    const events: SessionEvent[] = [];
    let userMessages = 0;
    let assistantMessages = 0;
    let toolCalls = 0;

    for (const entry of entries) {
      // Track events
      events.push({
        id: entry.id,
        type: entry.type,
        timestamp: new Date(entry.timestamp),
        data: entry,
      });

      // Parse messages
      if (entry.type === "message") {
        const msgEntry = entry as SessionMessageEntry;
        const role = msgEntry.message?.role;
        
        let content = "";
        if (typeof msgEntry.message?.content === "string") {
          content = msgEntry.message.content;
        } else if (Array.isArray(msgEntry.message?.content)) {
          content = msgEntry.message.content
            .map(c => c.type === "text" ? c.text : `[${c.type}]`)
            .filter(Boolean)
            .join("\n");
        }

        if (role === "user") {
          userMessages++;
          messages.push({
            id: entry.id,
            type: "user",
            content,
            timestamp: new Date(entry.timestamp),
          });
        } else if (role === "assistant") {
          assistantMessages++;
          messages.push({
            id: entry.id,
            type: "assistant",
            content,
            timestamp: new Date(entry.timestamp),
          });

          // Check for tool calls
          if (msgEntry.message?.tool_calls) {
            toolCalls += msgEntry.message.tool_calls.length;
            for (const toolCall of msgEntry.message.tool_calls) {
              messages.push({
                id: `${entry.id}-tool-${toolCall.id}`,
                type: "tool_call",
                content: `${toolCall.function.name}(${toolCall.function.arguments})`,
                timestamp: new Date(entry.timestamp),
                toolName: toolCall.function.name,
                toolInput: JSON.parse(toolCall.function.arguments),
              });
            }
          }
        }
      } else if (entry.type === "custom") {
        const customEntry = entry as SessionCustomEntry;
        if (customEntry.customType === "thinking") {
          messages.push({
            id: entry.id,
            type: "thinking",
            content: String(customEntry.data || ""),
            timestamp: new Date(entry.timestamp),
          });
        }
      }
    }

    return {
      agentId: agent.agentId,
      taskId: agent.taskId,
      agentType: agent.agentType,
      messages,
      events,
      stats: {
        totalMessages: messages.length,
        userMessages,
        assistantMessages,
        toolCalls,
      },
    };
  } catch (error) {
    console.error(`Error reading session file ${agent.sessionFilePath}:`, error);
    return null;
  }
}
