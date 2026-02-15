import { z } from "zod";

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;

/** Normalize domain to full URL (add https:// if no protocol). */
export function domainToUrl(domain: string): string {
  const s = domain.trim();
  if (!s) return s;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  return `https://${s}`;
}

/** Simple form: only domain and users; rest is auto (GET, 30s). */
export const quickCreateLoadTestSchema = z.object({
  domain: z.string().min(1, "Domain is required"),
  users: z.number().int().min(1, "Min 1 user").max(10000),
});

export type QuickCreateLoadTestInput = z.infer<typeof quickCreateLoadTestSchema>;

export const createLoadTestSchema = z.object({
  url: z.string().url("Invalid URL"),
  method: z.enum(HTTP_METHODS).default("GET"),
  concurrency: z.number().int().min(1).max(10000),
  durationSeconds: z.number().int().min(1).max(1800),
  requestHeaders: z.record(z.string()).optional(),
  requestBody: z.string().optional(),
});

export type CreateLoadTestInput = z.infer<typeof createLoadTestSchema>;
