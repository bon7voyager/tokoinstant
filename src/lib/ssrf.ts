import "server-only";
import { lookup } from "dns/promises";
import { isIP } from "net";

function ipv4Private(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b, c] = p;
  if (a === 0 || a === 10 || a === 127) return true; // this-net, RFC1918, loopback
  if (a === 169 && b === 254) return true; // link-local + cloud metadata (169.254.169.254)
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 192 && b === 0 && c === 0) return true; // IETF protocol assignments
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a >= 224) return true; // multicast + reserved (224.0.0.0/4, 240.0.0.0/4)
  return false;
}

function ipv6Private(ip: string): boolean {
  const x = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (x === "::1" || x === "::") return true; // loopback / unspecified
  const mapped = x.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) return ipv4Private(mapped[1]); // IPv4-mapped
  // fc00::/7 (ULA, incl. fd00:ec2::254 AWS metadata) + fe80::/10 (link-local)
  return x.startsWith("fc") || x.startsWith("fd") || x.startsWith("fe8") ||
    x.startsWith("fe9") || x.startsWith("fea") || x.startsWith("feb");
}

/** True if an IP literal is loopback/private/link-local/reserved (unsafe to fetch). */
export function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return ipv4Private(ip);
  if (v === 6) return ipv6Private(ip);
  return true; // not a parseable IP -> treat as unsafe
}

/**
 * Validate a reseller-supplied webhook URL against SSRF. Requires https, and that
 * the host (literal IP, or every DNS-resolved address) is publicly routable.
 * Returns an error message, or null when safe. Resolving here (and again right
 * before the fetch) shrinks the DNS-rebinding window.
 */
export async function callbackUrlError(url: string): Promise<string | null> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return "URL webhook tidak valid.";
  }
  if (u.protocol !== "https:") return "URL webhook harus memakai https://.";

  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) {
    return isPrivateIp(host) ? "Alamat IP internal/privat tidak diizinkan." : null;
  }

  let addrs: { address: string }[];
  try {
    addrs = await lookup(host, { all: true });
  } catch {
    return "Host webhook tidak bisa di-resolve.";
  }
  if (addrs.length === 0) return "Host webhook tidak bisa di-resolve.";
  for (const a of addrs) {
    if (isPrivateIp(a.address)) return "Host webhook mengarah ke alamat internal/privat.";
  }
  return null;
}
