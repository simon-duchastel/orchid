import { describe, it, expect } from "vitest";
import { fillPlannerPromptTemplate } from "../../templates/index.js";

describe("fillPlannerPromptTemplate", () => {
  it("should correctly fill the planner prompt template", () => {
    const data = {
      requestDescription: "Add a new feature to handle user authentication",
      context: "The app currently has no authentication system",
      workingDirectory: "/path/to/project",
    };

    const result = fillPlannerPromptTemplate(data);

    expect(result).toBe(`# Planning Session

You are a planner agent tasked with creating a comprehensive plan for the following request:

## Request

Add a new feature to handle user authentication

## Context

The app currently has no authentication system

## Instructions

1. Carefully analyze the request to understand the full scope and requirements
2. Explore the codebase if needed to understand the current state and patterns
3. Break down the work into logical, actionable Dyson tasks
4. Each task should be:
   - Clear and specific with a well-defined objective
   - Small enough to be completed by an implementor agent
   - Large enough to be meaningful on its own
   - Include acceptance criteria and context
5. Consider dependencies between tasks and suggest an appropriate order
6. Identify any risks, blockers, or areas that need clarification

## Task Creation

When creating tasks, use the Dyson task tools to:
- Create individual tasks with titles and descriptions
- Set appropriate metadata (priority, labels, etc.)
- Define relationships between tasks if applicable

## Working Environment

You are working in: /path/to/project

Use this context to understand the project structure and create relevant tasks.

## Output

Provide a summary of the plan including:
- Overview of what needs to be done
- List of created tasks with their purposes
- Suggested order of execution
- Any notes, risks, or clarifications needed
`);
  });
});
