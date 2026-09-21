import { storage } from "@/src/utils/storage";

const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;
export const TOKEN_KEY = "riyanmee_token";

export type HuntMode = "ultimate" | "full" | "city" | "isp";

export type UserT = {
  id: string;
  username: string;
  role: "admin" | "customer";
  status: string;
  country: string;
  package_id: string;
  package_name: string;
  bandwidth_limit_mb: number;
  bandwidth_used_mb: number;
  tier: string;
  server_host: string;
  server_port: number;
  proxy_password: string;
  gateway_host: string;
  gateway_port: number;
  gateway_user: string;
  gateway_pass: string;
  gateway_protocol: string;
  gateway_online: boolean;
  whitelist_ips: string[];
  traffic_bytes: number;
  total_pool: string;
  expires_at: string | null;
  created_at: string | null;
};

export type GatewayT = {
  host: string;
  port: number;
  username: string;
  password: string;
  protocol: string;
  online: boolean;
  configured: boolean;
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
  octet_match?: number;
  owned?: boolean;
  label?: string;
  session?: string;
  username?: string;
  password?: string;
  gateway_host?: string;
  gateway_port?: number;
  protocol?: string;
};

export type MyProxyT = {
  id: string;
  label: string;
  host: string;
  port: number;
  username: string;
  protocol: string;
  created_at: string;
};

export type PlanT = {
  id: string;
  name: string;
  days: number;
  price: number;
  price_label: string;
  tier: string;
  popular: boolean;
  features: string[];
};

export type PurchaseT = {
  id: string;
  plan_id: string;
  plan_name: string;
  days: number;
  price: number;
  price_label: string;
  ts: string;
  expires_at: string;
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

export type OrderT = {
  id: string;
  user_id: string;
  username: string;
  package_id: string;
  package_name: string;
  days: number;
  price: number;
  price_label: string;
  country: string;
  status: "pending" | "confirmed" | "rejected";
  created_at: string | null;
  confirmed_at: string | null;
};

export type ProxyAccountT = {
  configured: boolean;
  active: boolean;
  status: string;
  host: string;
  port: number;
  protocol: string;
  username: string;
  password: string;
  country: string;
  package_id: string;
  package_name: string;
  bandwidth_limit_mb: number;
  bandwidth_used_mb: number;
  expires_at: string | null;
};

export type CountryT = { code: string; name: string };

export type PaymentInfoT = {
  bank_name: string;
  account_number: string;
  account_holder: string;
  ewallet: string;
  qris_note: string;
};

export type AdminStatsT = {
  total_customers: number;
  active_customers: number;
  pending_orders: number;
  confirmed_orders: number;
  revenue: number;
  revenue_label: string;
};

export type GatewayStatusT = {
  host: string;
  port: number;
  protocol: string;
  configured: boolean;
  online: boolean;
  upstream: { provider: string; host: string; port: number; online: boolean };
};

export type UpstreamT = {
  provider: string;
  host: string;
  port: number;
  zone: string;
  username: string;
  password: string;
};

export type SettingsT = {
  payment_info: PaymentInfoT;
  proxy_host: string;
  proxy_port: number;
  proxy_protocol: string;
  upstream: UpstreamT;
  countries: CountryT[];
};

export function countryName(code: string, list: CountryT[]): string {
  const found = list.find((c) => c.code === code);
  return found ? found.name : code || "-";
}

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
