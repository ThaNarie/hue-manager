function padNumber(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

export function formatRunId(issueNumber: number, attempt: number): string {
  return `issue-${padNumber(issueNumber, 6)}-run-${padNumber(attempt, 4)}`;
}
