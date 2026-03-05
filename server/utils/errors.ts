export function formatErrors(result: any) {
  return result.error.issues.map((issue: any) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));
}
