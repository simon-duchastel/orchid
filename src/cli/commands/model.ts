import { Command } from "@cliffy/command";
import { Input } from "@cliffy/prompt/input";
import { Select } from "@cliffy/prompt/select";
import { Table } from "@cliffy/table";
import { createModelRepository } from "../../agent-framework/models/model-repository.js";
import type { Model } from "../../agent-framework/models/types.js";

/**
 * Parse model reference in format "provider/model-id" or just "model-id"
 * Returns { provider, modelId } or null if parsing fails
 */
function parseModelRef(modelRef: string): { provider: string | null; modelId: string } | null {
  const parts = modelRef.split("/");
  if (parts.length === 2) {
    return { provider: parts[0], modelId: parts[1] };
  } else if (parts.length === 1) {
    return { provider: null, modelId: parts[0] };
  }
  return null;
}

/**
 * Get provider interactively if not provided
 */
async function getProviderInteractive(
  repo: ReturnType<typeof createModelRepository>,
  providedProvider: string | null,
  operation: string
): Promise<string> {
  if (providedProvider) {
    return providedProvider;
  }

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
  options: { provider?: string },
  modelRef: string
): Promise<void> {
  const repo = createModelRepository();

  // Parse the model reference
  const parsed = parseModelRef(modelRef);
  if (!parsed) {
    console.error(`Error: Invalid model reference format: "${modelRef}"`);
    console.error('Use format: "provider/model-id" or provide --provider flag');
    process.exit(1);
  }

  // Get provider from reference or flag or prompt
  let providerName: string;
  if (parsed.provider) {
    providerName = parsed.provider;
  } else if (options.provider) {
    providerName = options.provider;
  } else {
    providerName = await getProviderInteractive(repo, null, "add");
  }

  // Validate provider exists
  validateProviderExists(repo, providerName);

  const modelId = parsed.modelId;

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
  options: { provider?: string; force?: boolean },
  modelRef: string
): Promise<void> {
  const repo = createModelRepository();

  // Parse the model reference
  const parsed = parseModelRef(modelRef);
  if (!parsed) {
    console.error(`Error: Invalid model reference format: "${modelRef}"`);
    console.error('Use format: "provider/model-id" or provide --provider flag');
    process.exit(1);
  }

  // Get provider from reference or flag or prompt
  let providerName: string;
  if (parsed.provider) {
    providerName = parsed.provider;
  } else if (options.provider) {
    providerName = options.provider;
  } else {
    // For removal, we need to find which providers have this model
    const existingModels = repo.getAllModels();
    const modelsWithId = existingModels.filter((m) => m.modelId === parsed.modelId);

    if (modelsWithId.length === 0) {
      console.error(`Error: Model "${modelRef}" not found`);
      process.exit(1);
    }

    if (modelsWithId.length === 1) {
      providerName = modelsWithId[0].provider;
    } else {
      // Multiple providers have this model ID - prompt user
      providerName = await Select.prompt({
        message: `Multiple providers have model "${parsed.modelId}". Select one:`,
        options: modelsWithId.map((m) => ({ value: m.provider, name: m.provider })),
      });
    }
  }

  const modelId = parsed.modelId;

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
      console.log('Use "orchid model add <provider>/<model-id>" to add a model.');
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
  .arguments("<model-ref:string>")
  .option("--provider <provider:string>", "Provider name (optional if included in model reference)")
  .action(modelAddAction);

/**
 * Model remove command
 */
export const modelRemoveCommand: any = new Command()
  .description("Remove a model")
  .arguments("<model-ref:string>")
  .option("--provider <provider:string>", "Provider name (optional if included in model reference)")
  .option("-f, --force", "Force removal without confirmation")
  .action(modelRemoveAction);

/**
 * Model list command
 */
export const modelListCommand: any = new Command()
  .description("List all configured models")
  .option("--provider <provider:string>", "Filter by provider name")
  .action(modelListAction);

/**
 * Main model command
 */
export const modelCommand: any = new Command()
  .description("Manage AI models")
  .command("add", modelAddCommand)
  .command("remove", modelRemoveCommand)
  .command("list", modelListCommand);
