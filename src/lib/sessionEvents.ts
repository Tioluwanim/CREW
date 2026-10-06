// Tiny change feed so React can follow sign-in, sign-out and demo-session changes
// (all of which live in browser storage, which has no change event within one tab).

const listeners = new Set<() => void>();

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifySession(): void {
  listeners.forEach((listener) => listener());
}
