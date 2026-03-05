import { Command } from "@cliffy/command";
import { stopDaemon } from "../../core/files/process.js";

export async function downAction() {
  const result = await stopDaemon();
  console.log(result.message);
  if (!result.success) {
    process.exit(1);
  }
}

export const downCommand: any = new Command()
  .description("Stop the orchid daemon")
  .action(downAction);
