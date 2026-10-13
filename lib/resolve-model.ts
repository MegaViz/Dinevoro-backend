/** Unwrap tsx/CJS default-export interop so mongoose models expose findOne/etc. */
export function resolveModel<T>(imported: T): T {
  const mod = imported as T & { default?: T; findOne?: unknown };
  if (typeof (mod as { findOne?: unknown }).findOne === "function") {
    return mod;
  }
  const nested = (mod as { default?: T }).default;
  if (nested && typeof (nested as { findOne?: unknown }).findOne === "function") {
    return nested;
  }
  return mod;
}
