export function hasTauriIpc(): boolean {
  return typeof getTauriInvoke() === "function";
}

export async function tauriInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const directInvoke = getTauriInvoke();
  if (typeof directInvoke === "function") {
    return directInvoke(command, args) as Promise<T>;
  }

  if (!hasTauriBridge()) {
    throw new Error("tauri_invoke_unavailable");
  }

  const mod = await import("@tauri-apps/api/core");
  const lazyInvoke = (mod as any)?.invoke;
  if (typeof lazyInvoke !== "function") {
    throw new Error("tauri_invoke_unavailable");
  }
  return lazyInvoke(command, args) as Promise<T>;
}

function getTauriInvoke(): unknown {
  const tauri = (globalThis as any)?.__TAURI__;
  const coreInvoke = tauri?.core?.invoke;
  if (typeof coreInvoke === "function") return coreInvoke;

  const internalsInvoke = (globalThis as any)?.__TAURI_INTERNALS__?.invoke;
  if (typeof internalsInvoke === "function") return internalsInvoke;

  return undefined;
}

function hasTauriBridge(): boolean {
  return typeof (globalThis as any)?.__TAURI__ === "object"
    || typeof (globalThis as any)?.__TAURI_INTERNALS__ === "object";
}
