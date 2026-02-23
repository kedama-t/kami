/** Error codes for CLI JSON output */
export type ErrorCode =
  | "ARTICLE_NOT_FOUND"
  | "AMBIGUOUS_SLUG"
  | "ARTICLE_ALREADY_EXISTS"
  | "TEMPLATE_NOT_FOUND"
  | "SCOPE_NOT_FOUND"
  | "INVALID_FRONTMATTER"
  | "HOOK_BLOCKED"
  | "VALIDATION_ERROR"
  | "IO_ERROR"
  | "VAULT_NOT_FOUND";

/** Successful CLI JSON response */
export interface SuccessResult<T = unknown> {
  ok: true;
  data: T;
  error: null;
}

/** Error CLI JSON response */
export interface ErrorResult {
  ok: false;
  data: null;
  error: {
    code: ErrorCode;
    message: string;
    candidates?: string[];
  };
}

/** Union type for CLI JSON output */
export type CliResult<T = unknown> = SuccessResult<T> | ErrorResult;

/** Exit codes */
export const EXIT_CODES = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  NOT_FOUND: 2,
  AMBIGUOUS: 3,
  HOOK_BLOCKED: 4,
} as const;

/** Application error with exit code and error code */
export class KamiError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly exitCode: number = EXIT_CODES.GENERAL_ERROR,
    public readonly candidates?: string[],
  ) {
    super(message);
    this.name = "KamiError";
  }

  toErrorResult(): ErrorResult {
    return {
      ok: false,
      data: null,
      error: {
        code: this.code,
        message: this.message,
        candidates: this.candidates,
      },
    };
  }
}
