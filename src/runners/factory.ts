import type { QaConfig } from "../config/types.js";
import type { TestRunner } from "./types.js";
import { PlaywrightRunner } from "./playwright.js";

export function createTestRunner(config: QaConfig): TestRunner {
  return config.runner ?? new PlaywrightRunner(config.repo ?? ".");
}
