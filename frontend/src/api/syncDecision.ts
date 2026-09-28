// Pure decision logic, no react-native/expo imports — see the
// mobile-dashboard sync audit, Findings 3 & 4. A network failure in "local"
// API mode used to always fall back to bundled demo data, including for
// writes — silently discarding a registration instead of queuing it. Reads
// may still show that cached/demo data (clearly labelled in the UI); writes
// must not.
export function shouldFallbackToDemoData(method?: string): boolean {
  return (method || "GET").toUpperCase() === "GET";
}
