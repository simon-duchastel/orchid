import { describe, it, expect } from "vitest";
import { fillAgentPromptTemplate, fillReviewerPromptTemplate } from "../../templates/index.js";

describe("fillAgentPromptTemplate", () => {
  it("should correctly fill the agent prompt template", () => {
    const data = {
      taskTitle: "Test Task Title",
      taskDescription: "This is a test task description.",
      worktreePath: "/path/to/worktree",
    };

    const result = fillAgentPromptTemplate(data);

    expect(result).toBe(`# Task Implementation

You are an implementor agent assigned to work on a task. Your goal is to implement the changes described in the task.

## Test Task Title

This is a test task description.
## Instructions

1. Review the task description carefully to understand what needs to be implemented
2. Explore the codebase to understand the current structure and patterns
3. Implement the required changes following existing code conventions
4. Write tests for any new functionality
5. Ensure all existing tests pass
6. Follow best practices and maintain code quality

## Working Environment

You are working in a dedicated worktree at: /path/to/worktree

This is an isolated environment where you can safely make changes. The session will track your progress.

## Getting Started

1. First, explore the repository structure to understand the codebase
2. Look for any existing related code or patterns
3. Create a plan for implementation
4. Start implementing the changes incrementally
5. Test your changes as you go

Remember: You have full autonomy to implement this task. Make decisions that result in clean, maintainable code.
`);
  });
});

describe("fillReviewerPromptTemplate", () => {
  it("should correctly fill the reviewer prompt template", () => {
    const data = {
      taskTitle: "Test Task Title",
      taskDescription: "This is a test task description.",
      worktreePath: "/path/to/worktree",
    };

    const result = fillReviewerPromptTemplate(data);

    expect(result).toBe(`# Task Review

You are a reviewer agent assigned to review completed work. The implementor has finished their work on this task.

## Task: Test Task Title

**Task Description:**
This is a test task description.

## Review Guidelines

Your goal is to verify that the task has been completed successfully and meets the requirements. Be constructive and pragmatic in your review.

### What to Look For

1. **Correctness**: Does the implementation correctly address the task requirements?
2. **Completeness**: Are all specified requirements implemented?
3. **Tests**: Are there appropriate tests for the new functionality? Do they pass?
4. **Code Quality**: Is the code readable, maintainable, and following project conventions?
5. **Integration**: Does the new code integrate well with existing code?

### What NOT to Look For

- **Nitpicks**: Don't flag minor stylistic issues unless they significantly impact readability
- **Perfect Solutions**: Accept working solutions that meet requirements, even if not "perfect"
- **Refactoring**: Don't suggest refactoring existing code unless it directly impacts the task
- **Gold Plating**: Don't ask for features beyond what was requested
- **Opinions**: Avoid subjective preferences; focus on objective quality metrics

## Working Environment

You are reviewing work done in: /path/to/worktree

## Review Process

1. First, understand the task requirements
2. Explore the changes made in the worktree
3. Verify the implementation meets requirements
4. Check that tests exist and pass
5. Provide clear, actionable feedback

## Output Format

- If approved: Provide brief confirmation that requirements are met
- If changes needed: Clearly explain what needs to be fixed and why

Remember: Your job is to ensure quality, not perfection. Be helpful, not pedantic.
`);
  });
});
