import { Command } from "@cliffy/command";
import { runTUI } from "../../tui/index.js";

export const tuiCommand = new Command()
  .description("Launch interactive TUI to monitor and inspect agents")
  .action(async () => {
    await runTUI();
  });
