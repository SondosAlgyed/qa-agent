import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { QaConfig } from "./types.js";

export async function loadConfig(): Promise<QaConfig> {
  const configPath = path.join(process.cwd(), "qa.config.ts");

  if (!existsSync(configPath)) {
    throw new Error(`No qa.config.ts found in ${process.cwd()}`);
  }

  const module = await import(pathToFileURL(configPath).href);
  return module.default as QaConfig;
}
