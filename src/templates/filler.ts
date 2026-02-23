import { join } from "node:path";
import { readFileSync } from "node:fs";

const AGENT_PROMPT_TEMPLATE = readFileSync(
  join(process.cwd(), "templates", "agent-prompt.md"),
  "utf-8"
);

const REVIEWER_PROMPT_TEMPLATE = readFileSync(
  join(process.cwd(), "templates", "reviewer-prompt.md"),
  "utf-8"
);

export interface AgentPromptData {
  taskTitle: string;
  taskDescription: string;
  worktreePath: string;
}

export interface ReviewerPromptData {
  taskTitle: string;
  taskDescription: string;
  worktreePath: string;
}

export function fillAgentPromptTemplate(data: AgentPromptData): string {
  return AGENT_PROMPT_TEMPLATE
    .replace(/\{\{taskTitle\}\}/g, data.taskTitle || "")
    .replace(/\{\{taskDescription\}\}/g, data.taskDescription || "")
    .replace(/\{\{worktreePath\}\}/g, data.worktreePath);
}

export function fillReviewerPromptTemplate(data: ReviewerPromptData): string {
  return REVIEWER_PROMPT_TEMPLATE
    .replace(/\{\{taskTitle\}\}/g, data.taskTitle || "")
    .replace(/\{\{taskDescription\}\}/g, data.taskDescription || "")
    .replace(/\{\{worktreePath\}\}/g, data.worktreePath);
}
