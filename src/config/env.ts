import { QaError } from "../core/errors.js";

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new QaError(`Missing environment variable ${name}. Add it to your .env file.`);
  }
  return value;
}
