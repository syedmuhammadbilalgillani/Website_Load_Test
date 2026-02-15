import { request, type Dispatcher } from "undici";

const MAX_CONNECTIONS_PER_ORIGIN = 200;
const KEEP_ALIVE_TIMEOUT = 60000;

/**
 * Single request with timing and size. Uses undici for connection pooling.
 */
export async function fetchWithMetrics(
  url: string,
  method: string,
  options: { headers?: Record<string, string>; body?: string }
): Promise<{ latencyMs: number; success: boolean; statusCode?: number; bytes?: number }> {
  const start = Date.now();
  try {
    const res = await request(url, {
      method: method as Dispatcher.HttpMethod,
      headers: options.headers ?? {},
      body: options.body,
      bodyTimeout: 30000,
      headersTimeout: 10000,
    });
    const body = await res.body.arrayBuffer();
    const latencyMs = Date.now() - start;
    const success = res.statusCode >= 200 && res.statusCode < 400;
    return {
      latencyMs,
      success,
      statusCode: res.statusCode,
      bytes: body.byteLength,
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    return { latencyMs, success: false };
  }
}

export { request };
