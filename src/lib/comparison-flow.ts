export interface ComparisonPair {
  left: string;
  right: string;
}

export function acceptComparison(
  acceptedPair: ComparisonPair | null,
  left: string,
  right: string,
): { pair: ComparisonPair | null; shouldStart: boolean } {
  if (!left || !right || left === right) {
    return { pair: acceptedPair, shouldStart: false };
  }
  if (acceptedPair?.left === left && acceptedPair.right === right) {
    return { pair: acceptedPair, shouldStart: false };
  }
  return { pair: { left, right }, shouldStart: true };
}

export function shouldApplyComparisonResult(
  resultAttempt: number,
  currentAttempt: number,
): boolean {
  return resultAttempt === currentAttempt;
}
