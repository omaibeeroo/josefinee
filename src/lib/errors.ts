export class AppError extends Error {
  readonly code: string;
  readonly userMessage: string;
  readonly status: number;
  readonly meta?: Record<string, unknown>;

  constructor(
    code: string,
    userMessage: string,
    status = 400,
    meta?: Record<string, unknown>,
  ) {
    super(userMessage);
    this.name = "AppError";
    this.code = code;
    this.userMessage = userMessage;
    this.status = status;
    this.meta = meta;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/** Never leak stack traces or database errors to customers. */
export function toUserMessage(error: unknown): string {
  if (isAppError(error)) return error.userMessage;
  return "Something went wrong. Please try again.";
}
