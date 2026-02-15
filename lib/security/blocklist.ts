/**
 * SSRF / abuse prevention: block internal and dangerous targets.
 */

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "ip6-localhost",
  "metadata.google.internal",
  "metadata",
  "169.254.169.254",
]);

const BLOCKED_PREFIXES = [
  "10.",       // 10.0.0.0/8
  "172.16.", "172.17.", "172.18.", "172.19.", "172.20.", "172.21.", "172.22.",
  "172.23.", "172.24.", "172.25.", "172.26.", "172.27.", "172.28.", "172.29.",
  "172.30.", "172.31.", // 172.16.0.0/12
  "192.168.",  // 192.168.0.0/16
  "169.254.",  // link-local
  "127.",      // 127.0.0.0/8
];

const BLOCKED_DOMAIN_SUFFIXES = [".local", ".localhost", ".internal", ".lan"];

function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(lower)) return true;
  for (const suffix of BLOCKED_DOMAIN_SUFFIXES) {
    if (lower.endsWith(suffix)) return true;
  }
  return false;
}

function isBlockedIP(ip: string): boolean {
  if (BLOCKED_HOSTS.has(ip)) return true;
  for (const prefix of BLOCKED_PREFIXES) {
    if (ip.startsWith(prefix)) return true;
  }
  return false;
}

export function isHostBlocked(hostnameOrIp: string): boolean {
  if (isBlockedHostname(hostnameOrIp)) return true;
  if (isBlockedIP(hostnameOrIp)) return true;
  return false;
}
