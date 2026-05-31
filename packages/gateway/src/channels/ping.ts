export interface PingUrlHeadResult {
  ok: boolean;
  status: number;
}

export async function pingUrlHead(url: string, timeoutMs: number): Promise<PingUrlHeadResult> {
  const response = await fetch(url, {
    method: "HEAD",
    signal: AbortSignal.timeout(timeoutMs),
  });
  return {
    ok: response.ok,
    status: response.status,
  };
}
