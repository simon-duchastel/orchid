import { Command } from "@cliffy/command";
import { Input } from "@cliffy/prompt/input";
import { Secret } from "@cliffy/prompt/secret";
import { Select } from "@cliffy/prompt/select";
import { Table } from "@cliffy/table";
import { createModelRepository } from "../../agent-framework/models/model-repository.js";
import type { Provider } from "../../agent-framework/models/types.js";

/**
 * Mask an API key for display, showing only the last 4 characters
 */
function maskApiKey(apiKey: string | undefined): string {
  if (!apiKey) {
    return "(not set)";
  }
  if (apiKey.length <= 4) {
    return "****";
  }
  return "****" + apiKey.slice(-4);
}

/**
 * Action for adding a provider
 * Cliffy passes: options first, then arguments
 */
export async function providerAddAction(
  options: { name?: string; url?: string; "api-key"?: string }
): Promise<void> {
  const repo = createModelRepository();

  let providerName: string;
  let url: string;
  let apiKey: string | undefined;

  // Check if all required params are provided or none are provided
  const hasName = !!options.name;
  const hasUrl = !!options.url;

  if (hasName && hasUrl) {
    // All required params provided: non-interactive mode
    providerName = options.name!;
    url = options.url!;
    apiKey = options["api-key"];
  } else if (!hasName && !hasUrl) {
    // No required params provided: interactive mode
    providerName = await Input.prompt({
      message: "Enter the provider name:",
      validate: (value) => {
        if (!value || value.trim() === "") {
          return "Provider name is required";
        }
        return true;
      },
    });

    url = await Input.prompt({
      message: `Enter the API URL for provider "${providerName}":`,
      validate: (value) => {
        if (!value || value.trim() === "") {
          return "URL is required";
        }
        try {
          new URL(value);
          return true;
        } catch {
          return "Please enter a valid URL";
        }
      },
    });

    // Prompt for API key - user can leave it empty
    apiKey = await Secret.prompt({
      message: `Enter the API key for provider "${providerName}" (leave empty if not required):`,
      minLength: 0,
    });

    // If empty string, treat as undefined
    if (apiKey === "") {
      apiKey = undefined;
    }
  } else {
    // Some but not all required params provided: error
    console.error("Error: Both --name and --url are required");
    console.error("Usage: orchid provider add --name <name> --url <url> [--api-key <key>]");
    console.error("   or: orchid provider add    (for interactive mode)");
    process.exit(1);
  }

  // Check if provider already exists
  const existingProviders = repo.getAllProviders();
  if (existingProviders.some((p) => p.name === providerName)) {
    console.error(`Error: Provider "${providerName}" already exists`);
    process.exit(1);
  }

  // Validate URL format
  try {
    new URL(url);
  } catch {
    console.error(`Error: Invalid URL format: "${url}"`);
    process.exit(1);
  }

  // Create the provider
  const provider: Provider = {
    name: providerName,
    auth: {
      url,
      apiKey,
    },
  };

  try {
    repo.addProvider(provider);
    console.log(`Successfully added provider "${providerName}"`);
    console.log(`  URL: ${url}`);
    console.log(`  API Key: ${maskApiKey(apiKey)}`);
  } catch (error) {
    console.error(
      `Error: ${error instanceof Error ? error.message : "Failed to add provider"}`
    );
    process.exit(1);
  }
}

/**
 * Action for removing a provider
 * Cliffy passes: options first, then arguments
 */
export async function providerRemoveAction(
  options: { name?: string; force?: boolean }
): Promise<void> {
  const repo = createModelRepository();

  let name: string;

  if (options.name) {
    // Name provided: non-interactive mode
    name = options.name;
  } else if (!options.name) {
    // No name provided: interactive mode
    const existingProviders = repo.getAllProviders();

    if (existingProviders.length === 0) {
      console.error("Error: No providers configured.");
      console.error('Use "orchid provider add" to add a provider.');
      process.exit(1);
    }

    name = await Select.prompt({
      message: "Select a provider to remove:",
      options: existingProviders.map((p) => ({
        value: p.name,
        name: `${p.name} (${p.auth.url})`,
      })),
    });
  } else {
    // This should not happen due to type checking, but just in case
    console.error("Error: Unexpected state in provider remove");
    process.exit(1);
  }

  // Check if provider exists
  const existingProviders = repo.getAllProviders();
  if (!existingProviders.some((p) => p.name === name)) {
    console.error(`Error: Provider "${name}" not found`);
    process.exit(1);
  }

  try {
    const removed = repo.removeProvider(name);
    if (removed) {
      console.log(`Successfully removed provider "${name}"`);
    } else {
      console.error(`Error: Provider "${name}" not found`);
      process.exit(1);
    }
  } catch (error) {
    console.error(
      `Error: ${error instanceof Error ? error.message : "Failed to remove provider"}`
    );
    process.exit(1);
  }
}

/**
 * Action for listing providers
 */
export async function providerListAction(): Promise<void> {
  const repo = createModelRepository();
  const providers = repo.getAllProviders();

  if (providers.length === 0) {
    console.log("No providers configured.");
    console.log('Use "orchid provider add" to add a provider.');
    return;
  }

  // Build table rows
  const rows = providers.map((provider) => [
    provider.name,
    provider.auth.url,
    maskApiKey(provider.auth.apiKey),
  ]);

  // Create and render table
  const table = new Table()
    .header(["Name", "URL", "API Key"])
    .body(rows)
    .border(true);

  console.log(table.toString());
  console.log(`\nTotal providers: ${providers.length}`);
}

/**
 * Provider add command
 */
export const providerAddCommand: any = new Command()
  .description("Add a new provider")
  .option("-n, --name <name:string>", "Provider name")
  .option("-u, --url <url:string>", "Provider API URL")
  .option("-k, --api-key <key:string>", "Provider API key")
  .action(providerAddAction);

/**
 * Provider remove command
 */
export const providerRemoveCommand: any = new Command()
  .description("Remove a provider")
  .option("-n, --name <name:string>", "Provider name")
  .option("-f, --force", "Force removal without confirmation (not yet implemented)")
  .action(providerRemoveAction);

/**
 * Provider list command
 */
export const providerListCommand: any = new Command()
  .description("List all configured providers")
  .action(providerListAction);

/**
 * Main provider command
 */
export const providerCommand: any = new Command()
  .description("Manage AI model providers")
  .command("add", providerAddCommand)
  .command("remove", providerRemoveCommand)
  .command("list", providerListCommand);
