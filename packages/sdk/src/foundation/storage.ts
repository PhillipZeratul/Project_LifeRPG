/**
 * Evaluates whether an incoming write should be applied under Row-Level Last-Write-Wins (LWW).
 * In ADR-0001, writes with an updated_at timestamp greater than or equal to existing updated_at win.
 */
export function shouldApplyLwwUpdate(existingUpdatedAt: number, incomingUpdatedAt: number): boolean {
    return incomingUpdatedAt >= existingUpdatedAt;
}
