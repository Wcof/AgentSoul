/**
 * @fileoverview IPC communication stub for desktop pet integration.
 */

/** Notify the desktop pet of a state change */
export function notifyState(state: unknown): void {
  void state;
}

/** Request permission via the desktop pet's approval surface */
export function requestPermission(
  action: string,
  riskClass: string,
  context: unknown = {},
): Promise<{ approved: boolean; decision: string }> {
  void action;
  void riskClass;
  void context;
  return Promise.resolve({ approved: false, decision: 'unavailable-denied' });
}
