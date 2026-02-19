/**
 * File system utilities
 *
 * Provides utilities for file system operations.
 */

import { readdirSync, existsSync } from "node:fs";
import { createInterface } from "node:readline";

/**
 * Check if a directory is empty
 *
 * @param dirPath - The path to the directory to check
 * @returns true if the directory is empty or doesn't exist, false otherwise
 */
export function isDirectoryEmpty(dirPath: string): boolean {
  if (!existsSync(dirPath)) {
    return true;
  }

  try {
    const files = readdirSync(dirPath);
    return files.length === 0;
  } catch {
    return true;
  }
}

/**
 * Prompt the user for confirmation with y/n input
 *
 * @param message - The message to display to the user
 * @param defaultValue - The default value if user just presses enter (default: false)
 * @returns Promise that resolves to true if user confirms (y), false otherwise
 */
export async function promptForConfirmation(
  message: string,
  defaultValue: boolean = false
): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const defaultPrompt = defaultValue ? "Y/n" : "y/N";

  return new Promise((resolve) => {
    rl.question(`${message} (${defaultPrompt}) `, (answer) => {
      rl.close();

      const trimmed = answer.trim().toLowerCase();

      if (trimmed === "") {
        resolve(defaultValue);
        return;
      }

      if (trimmed === "y" || trimmed === "yes") {
        resolve(true);
        return;
      }

      resolve(false);
    });
  });
}
