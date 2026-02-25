import { Command } from "@cliffy/command";
import { getStatus } from "../process/manager.js";

export async function dashboardAction() {
  const status = getStatus();
  if (!status.running) {
    console.error("Orchid is not running. Start it with: orchid up");
    process.exit(1);
  }
  console.log("Dashboard is not available when running without a web server.");
  console.log(`Orchid is running (PID: ${status.pid})`);
}

export const dashboardCommand: any = new Command()
  .description("Show orchid status")
  .action(dashboardAction);
