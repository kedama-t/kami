import type { CliResult, ErrorResult } from "../../types/result.ts";
import { KamiError, EXIT_CODES } from "../../types/result.ts";

/** Output a successful JSON result */
export function jsonSuccess<T>(data: T): string {
  const result: CliResult<T> = { ok: true, data, error: null };
  return JSON.stringify(result, null, 2);
}

/** Output an error JSON result */
export function jsonError(err: KamiError): string {
  return JSON.stringify(err.toErrorResult(), null, 2);
}

/** Handle command errors: print message or JSON, then exit */
export function handleError(err: unknown, json: boolean): never {
  if (err instanceof KamiError) {
    if (json) {
      console.log(jsonError(err));
    } else {
      console.error(`Error: ${err.message}`);
    }
    process.exit(err.exitCode);
  }

  // Unknown error
  const message = err instanceof Error ? err.message : String(err);
  if (json) {
    const kamiErr = new KamiError(message, "IO_ERROR", EXIT_CODES.GENERAL_ERROR);
    console.log(jsonError(kamiErr));
  } else {
    console.error(`Error: ${message}`);
  }
  process.exit(EXIT_CODES.GENERAL_ERROR);
}
