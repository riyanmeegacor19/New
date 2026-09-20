const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;

export type Protocol = "ssh" | "socks5" | "http";

export type ServerT = {
  id: string;
  name: string;
  host: string;
  port: number;
  protocol: Protocol;
  location: string;
  username: string;
  password: string;
  is_builtin: boolean;
  last_ping_ms: number | null;
  last_ping_at: string | null;
  last_status: "online" | "offline" | "unknown";
  created_at: string;
};

export type SessionT = {
  id: string;
  state: "disconnected" | "connecting" | "connected";
  server_id: string | null;
  server_name: string;
  connected_at: string | null;
  banner: string;
  ping_ms: number | null;
  error: string;
};

export type SessionResp = { session: SessionT; server: ServerT | null };

export type LogT = {
  id: string;
  ts: string;
  level: "info" | "success" | "warn" | "error";
  tag: string;
  message: string;
};

export type ConfigT = {
  id: string;
  name: string;
  protocol: Protocol;
  host: string;
  port: number;
  username: string;
  password: string;
  payload: string;
  created_at: string;
  updated_at: string;
};

export type IpCheckT = {
  direct_ip: string;
  direct_country: string;
  direct_isp: string;
  proxy_server?: string;
  proxy_ip?: string;
  proxy_country?: string;
  proxy_isp?: string;
  spoofed?: boolean;
  proxy_error?: string;
  note?: string;
};

export type SpeedT = {
  mbps: number;
  bytes: number;
  seconds: number;
  via_proxy: boolean;
  server_name: string | null;
};

export type ToolHistoryT = {
  id: string;
  kind: "ip" | "speed";
  ts: string;
  data: IpCheckT | SpeedT;
};

export class ApiError extends Error {}

export async function api<T>(
  path: string,
  init?: Omit<RequestInit, "body"> & { json?: unknown },
): Promise<T> {
  const { json, ...rest } = init ?? {};
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...rest,
      headers: { "Content-Type": "application/json", ...(rest.headers ?? {}) },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError("Tidak dapat menghubungi server RIYANMEE. Periksa koneksi internet Anda.");
  }
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      // keep default detail
    }
    throw new ApiError(detail);
  }
  return res.json() as Promise<T>;
}

export const fetchSession = () => api<SessionResp>("/session");

export function pingColor(ms: number | null | undefined, status: string, colors: { brandPrimary: string; warning: string; error: string; muted: string }) {
  if (status === "offline" || ms == null) return colors.error;
  if (ms < 150) return colors.brandPrimary;
  if (ms < 400) return colors.warning;
  return colors.error;
}
