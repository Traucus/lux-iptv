let aborted = false;

export function isIngestAborted(): boolean {
  return aborted;
}

export function setIngestAborted(value: boolean): void {
  aborted = value;
}
