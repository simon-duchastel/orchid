import { Command } from "@cliffy/command";
import { startDaemonProcess } from "../../cliMain.js";

export const daemonCommand = new Command()
  .description("Internal command to run the daemon process")
  .hidden()
  .action(async () => {
    await startDaemonProcess();
  });
