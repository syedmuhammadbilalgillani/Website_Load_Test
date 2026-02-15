import { isHostBlocked } from "./blocklist";

export type UrlValidationResult =
  | { valid: true; url: string; hostname: string }
  | { valid: false; error: string };

/**
 * Validate URL for load tests: only http/https, no internal/SSRF targets.
 */
export function validateTargetUrl(input: string): UrlValidationResult {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { valid: false, error: "Invalid URL" };
  }

  const protocol = url.protocol.toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") {
    return { valid: false, error: "Only HTTP and HTTPS are allowed" };
  }

  const hostname = url.hostname.toLowerCase();
  if (isHostBlocked(hostname)) {
    return { valid: false, error: "Target host is not allowed (internal/private)" };
  }

  // Optional: resolve hostname to IP and check again (requires dns lookup in API/worker)
  return { valid: true, url: url.toString(), hostname };
}
