import { Command } from "@cliffy/command";
import { initializeOrchid } from "../../commands/init/init";
import { isDirectoryEmpty, promptForConfirmation } from "../../utils/fs-utils";
import { cwd } from "node:process";

export async function initAction(repository: string) {
  const currentDir = cwd();

  // Check if directory is empty
  if (!isDirectoryEmpty(currentDir)) {
    const confirmed = await promptForConfirmation(
      "This directory is not empty. Orchid will clone the repository in this directory and create lots of other files. It's best run in an empty directory - are you sure you want to proceed?",
      false
    );

    if (!confirmed) {
      console.log("Initialization cancelled.");
      process.exit(0);
    }
  }

  const result = await initializeOrchid(repository);
  console.log(result.message);
  if (!result.success) {
    process.exit(1);
  }
}

export const initCommand: any = new Command()
  .description("Initialize orchid workspace with a git repository")
  .argument("<repository-url>", "Url of the git repository to clone, ex. git@github.com:simon-duchastel/orchid.git")
  .action(initAction);
