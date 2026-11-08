export function normalizeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "An unexpected capture error occurred.";
}
