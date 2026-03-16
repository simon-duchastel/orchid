import { Command } from "@cliffy/command";
import { Input } from "@cliffy/prompt/input";
import { Select } from "@cliffy/prompt/select";
import { Table } from "@cliffy/table";
import { createModelRepository } from "../../agent-framework/models/model-repository.js";
import type { Model } from "../../agent-framework/models/types.js";

/**
 * Get provider interactively if not provided
 */
async function getProviderInteractive(
  repo: ReturnType<typeof createModelRepository>,
  operation: string
): Promise<string> {
  const providers = repo.getAllProviders();

  if (providers.length === 0) {
    console.error("Error: No providers configured. Add a provider first with 'orchid provider add <name>'");
    process.exit(1);
  }

  const selected = await Select.prompt({
    message: `Select a provider to ${operation} the model:`,
    options: providers.map((p) => ({ value: p.name, name: p.name })),
  });

  return selected;
}

/**
 * Get model ID interactively
 */
async function getModelIdInteractive(): Promise<string> {
  const modelId = await Input.prompt({
    message: "Enter the model ID:",
    validate: (value) => {
      if (!value || value.trim() === "") {
        return "Model ID is required";
      }
      return true;
    },
  });

  return modelId.trim();
}

/**
 * Validate that provider exists
 */
function validateProviderExists(
  repo: ReturnType<typeof createModelRepository>,
  providerName: string
): void {
  const providers = repo.getAllProviders();
  if (!providers.some((p) => p.name === providerName)) {
    console.error(`Error: Provider "${providerName}" not found`);
    console.error(`Run 'orchid provider list' to see configured providers`);
    process.exit(1);
  }
}

/**
 * Action for adding a model
 */
export async function modelAddAction(
  options: { provider?: string; model?: string }
): Promise<void> {
  const repo = createModelRepository();

  let providerName: string;
  let modelId: string;

  if (options.provider && options.model) {
    // Both provided: fully non-interactive
    providerName = options.provider;
    modelId = options.model;
  } else if (!options.provider && !options.model) {
    // Neither provided: fully interactive mode
    providerName = await getProviderInteractive(repo, "add");
    modelId = await getModelIdInteractive();
  } else {
    // Only one provided: error
    console.error("Error: Both --provider and --model are required");
    console.error("Usage: orchid model add --model <model-id> --provider <provider>");
    console.error("   or: orchid model add    (for interactive mode)");
    process.exit(1);
  }

  // Validate provider exists
  validateProviderExists(repo, providerName);

  // Check if model already exists
  const existingModels = repo.getAllModels();
  if (existingModels.some((m) => m.provider === providerName && m.modelId === modelId)) {
    console.error(`Error: Model "${providerName}/${modelId}" already exists`);
    process.exit(1);
  }

  // Create the model
  const model: Model = {
    provider: providerName,
    modelId,
  };

  try {
    repo.addModel(model);
    console.log(`Successfully added model "${providerName}/${modelId}"`);
  } catch (error) {
    console.error(
      `Error: ${error instanceof Error ? error.message : "Failed to add model"}`
    );
    process.exit(1);
  }
}

/**
 * Action for removing a model
 */
export async function modelRemoveAction(
  options: { provider?: string; model?: string; force?: boolean }
): Promise<void> {
  const repo = createModelRepository();

  let providerName: string;
  let modelId: string;

  if (options.provider && options.model) {
    // Both provided: fully non-interactive
    providerName = options.provider;
    modelId = options.model;
  } else if (!options.provider && !options.model) {
    // Neither provided: fully interactive mode
    providerName = await getProviderInteractive(repo, "remove");
    modelId = await getModelIdInteractive();
  } else {
    // Only one provided: error
    console.error("Error: Both --provider and --model are required");
    console.error("Usage: orchid model remove --model <model-id> --provider <provider>");
    console.error("   or: orchid model remove    (for interactive mode)");
    process.exit(1);
  }

  try {
    const removed = repo.removeModel(providerName, modelId);
    if (removed) {
      console.log(`Successfully removed model "${providerName}/${modelId}"`);
    } else {
      console.error(`Error: Model "${providerName}/${modelId}" not found`);
      process.exit(1);
    }
  } catch (error) {
    console.error(
      `Error: ${error instanceof Error ? error.message : "Failed to remove model"}`
    );
    process.exit(1);
  }
}

/**
 * Action for listing models
 */
export async function modelListAction(options: {
  provider?: string;
}): Promise<void> {
  const repo = createModelRepository();
  let models = repo.getAllModels();

  // Filter by provider if specified
  if (options.provider) {
    models = models.filter((m) => m.provider === options.provider);
  }

  if (models.length === 0) {
    if (options.provider) {
      console.log(`No models configured for provider "${options.provider}".`);
    } else {
      console.log("No models configured.");
      console.log('Use "orchid model add --model <model-id> --provider <provider>" to add a model.');
    }
    return;
  }

  // Build table rows
  const rows = models.map((model) => [model.provider, model.modelId]);

  // Create and render table
  const table = new Table()
    .header(["Provider", "Model ID"])
    .body(rows)
    .border(true);

  console.log(table.toString());
  console.log(`\nTotal models: ${models.length}`);
}

/**
 * Model add command
 */
export const modelAddCommand: any = new Command()
  .description("Add a new model")
  .option("-m, --model <model:string>", "Model ID")
  .option("-p, --provider <provider:string>", "Provider name")
  .action(modelAddAction);

/**
 * Model remove command
 */
export const modelRemoveCommand: any = new Command()
  .description("Remove a model")
  .option("-m, --model <model:string>", "Model ID")
  .option("-p, --provider <provider:string>", "Provider name")
  .option("-f, --force", "Force removal without confirmation")
  .action(modelRemoveAction);

/**
 * Model list command
 */
export const modelListCommand: any = new Command()
  .description("List all configured models")
  .option("-p, --provider <provider:string>", "Filter by provider name")
  .action(modelListAction);

/**
 * Main model command
 */
export const modelCommand: any = new Command()
  .description("Manage AI models")
  .command("add", modelAddCommand)
  .command("remove", modelRemoveCommand)
  .command("list", modelListCommand);
