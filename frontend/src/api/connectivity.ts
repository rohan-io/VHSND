// Tiny pub/sub, no react-native imports. Lets client.ts (a plain module —
// every apiRequest call is a live reachability signal) and
// OfflineSyncContext (a React context — periodic health-check poll) share
// one reachability signal without client.ts needing to import React.
type Listener = (reachable: boolean) => void;
const listeners = new Set<Listener>();

export function reportReachability(reachable: boolean) {
  listeners.forEach((l) => l(reachable));
}

export function subscribeReachability(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
