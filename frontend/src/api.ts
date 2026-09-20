import { storage } from "@/src/utils/storage";

const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;
export const TOKEN_KEY = "riyanmee_token";

export type HuntMode = "ultimate" | "full" | "city" | "isp";

export type UserT = {
  id: string;
  username: string;
  tier: string;
  server_host: string;
  server_port: number;
  proxy_password: string;
  whitelist_ips: string[];
  traffic_bytes: number;
  total_pool: string;
  expires_at: string | null;
  created_at: string | null;
};

export type AuthResp = { access_token: string; token_type: string; user: UserT };

export type GeoT = {
  ip: string;
  success: boolean;
  country: string;
  country_code: string;
  region: string;
  city: string;
  isp: string;
  asn: string;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
};

export type ProxyResultT = {
  ip: string;
  port: number;
  country: string;
  country_code: string;
  city: string;
  isp: string;
  asn: string;
  latency_ms: number;
  type: string;
  match?: string;
};

export type HuntResp = {
  target: GeoT;
  mode: HuntMode;
  mode_label: string;
  count: number;
  results: ProxyResultT[];
};

export type HistoryT = {
  id: string;
  ts: string;
  kind: "hunt" | "ipinfo" | "connect";
  title: string;
  subtitle: string;
  ip: string;
  mode: string;
};

export class ApiError extends Error {}

export async function api<T>(
  path: string,
  init?: Omit<RequestInit, "body"> & { json?: unknown },
): Promise<T> {
  const { json, ...rest } = init ?? {};
  const token = await storage.secureGet<string>(TOKEN_KEY, "");
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(rest.headers ?? {}),
      },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError("Tidak dapat menghubungi server RIYANMEE. Periksa koneksi internet Anda.");
  }
  if (res.status === 401) {
    await storage.secureRemove(TOKEN_KEY);
    throw new ApiError("Sesi berakhir, silakan login kembali");
  }
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      // keep default
    }
    throw new ApiError(detail);
  }
  return res.json() as Promise<T>;
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}
