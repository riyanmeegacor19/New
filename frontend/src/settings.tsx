import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { storage } from "@/src/utils/storage";
import { ColorScheme, setColorScheme } from "@/src/theme";

export type Lang = "id" | "en";

const LANG_KEY = "riyanmee_lang";
const SCHEME_KEY = "riyanmee_scheme";

type Dict = Record<string, string>;

const ID: Dict = {
  // tabs
  tab_home: "Beranda",
  tab_hunting: "Hunting",
  tab_cekip: "Cek IP",
  tab_history: "Riwayat",
  // common
  logout: "LOGOUT",
  save: "SIMPAN",
  cancel: "BATAL",
  copy_all: "SALIN SEMUA",
  loading: "Memuat...",
  // login
  hunter_access: "HUNTER ENGINE ACCESS",
  username: "USERNAME",
  password: "PASSWORD",
  login: "LOGIN",
  no_account: "Belum punya akun? ",
  register_now: "Daftar sekarang",
  encrypted: "SYSTEM SECURELY ENCRYPTED",
  demo_hint: "Akun demo — user: idmee · pass: riyanmee123",
  fill_userpass: "Isi username dan password",
  login_failed: "Login gagal",
  // register
  back: "Kembali",
  register_title: "DAFTAR AKUN",
  register_sub: "Buat akun RIYANMEE PROXY baru",
  choose_username: "Pilih username",
  min6: "Min. 6 karakter",
  confirm_password: "KONFIRMASI PASSWORD",
  repeat_password: "Ulangi password",
  register_submit: "DAFTAR SEKARANG",
  have_account: "Sudah punya akun? ",
  sign_in: "Masuk",
  register_ok: "Pendaftaran berhasil",
  register_failed: "Pendaftaran gagal",
  username_min3: "Username minimal 3 karakter",
  password_min6: "Password minimal 6 karakter",
  confirm_mismatch: "Konfirmasi password tidak cocok",
  // dashboard
  customer_profile: "PROFIL PELANGGAN",
  active: "Aktif:",
  expired: "KEDALUWARSA",
  server: "SERVER",
  port: "PORT",
  change_password: "GANTI PASSWORD",
  clear_all: "CLEAR ALL",
  reset_traffic: "RESET TRAFFIC",
  ip_whitelist: "IP WHITELIST",
  whitelist_myip: "WHITELIST\nMY IP",
  add_to_whitelist: "TAMBAH KE WHITELIST",
  total_pool: "TOTAL IPS POOL",
  ips_pool: "IPS POOL",
  server_copied: "Alamat server disalin",
  ip_added: "IP ditambahkan ke whitelist",
  ip_removed: "IP dihapus dari whitelist",
  fill_ip_first: "Isi alamat IP dulu",
  traffic_reset: "Traffic direset",
  history_cleared: "Riwayat dibersihkan",
  pw_changed: "Password berhasil diganti",
  cur_password: "PASSWORD SAAT INI",
  new_password: "PASSWORD BARU",
  new_pw_min6: "Password baru minimal 6 karakter",
  link_hunting: "IP Hunting",
  link_hunting_sub: "Cari proxy berdasarkan negara, kota & ISP",
  link_cekip: "Cek Informasi IP",
  link_cekip_sub: "Lacak negara, kota, dan ISP dari sebuah IP",
  link_servers: "Server Saya",
  link_servers_sub: "Kelola proxy/VPS milik Anda sendiri",
  link_plans: "Paket Langganan",
  link_plans_sub: "Perpanjang masa aktif membership Anda",
  link_purchases: "Riwayat Pembelian",
  link_purchases_sub: "Daftar paket yang pernah Anda aktifkan",
  link_gateway: "Sambung Gateway",
  link_gateway_sub: "Hubungkan VPS gateway proxy Anda sendiri",
  link_guide: "Panduan Setup VPS",
  link_guide_sub: "Langkah demi langkah membuat proxy di VPS",
  guide_open: "PANDUAN SETUP VPS",
  // gateway
  gateway_title: "Sambung Gateway",
  gateway_sub: "Gateway routing trafik proxy Anda",
  gw_host: "HOST GATEWAY",
  gw_port: "PORT",
  gw_user: "USERNAME (opsional)",
  gw_pass: "PASSWORD (opsional)",
  gw_protocol: "PROTOKOL",
  gw_save: "SIMPAN & TES KONEKSI",
  gw_test: "TES KONEKSI",
  gw_clear: "HAPUS GATEWAY",
  gw_online: "ONLINE",
  gw_offline: "OFFLINE",
  gw_not_set: "Belum ada gateway. Tambahkan VPS gateway Anda agar tombol HUBUNGKAN memberi proxy yang benar-benar berfungsi.",
  gw_saved: "Gateway disimpan",
  gw_cleared: "Gateway dihapus",
  gw_note: "Kredensial ini yang diberikan saat HUBUNGKAN. Trafik dirutekan oleh VPS gateway Anda, bukan oleh aplikasi.",
  // import
  import_servers: "IMPOR",
  import_title: "Impor Server",
  import_hint: "Tempel daftar server (satu per baris), format: host:port atau label | protokol://user@host:port",
  import_btn: "IMPOR SEKARANG",
  imported_n: "server diimpor",
  import_empty: "Tempel data server dulu",
  // success copy
  copy_creds: "SALIN KREDENSIAL",
  creds_copied: "Kredensial disalin",
  // hunting
  hunting_title: "IP Hunting",
  hunting_sub: "Cari proxy sesuai lokasi & ISP target",
  target_ip_label: "ALAMAT IP TARGET (IPV4 / IPV6)",
  country_label: "PILIH NEGARA",
  country_auto: "Otomatis (Global)",
  mode_hunting: "MODE HUNTING",
  start_hunt: "MULAI PENCARIAN",
  hunting_wait: "MENCARI...",
  fill_target: "Masukkan IP target dulu",
  proxies_found: "PROXY DITEMUKAN",
  similarity: "KEMIRIPAN",
  best_match: "MIRIP",
  info_label: "INFORMASI",
  invalid_ip: "Format IP target tidak valid",
  hunt_empty: 'Masukkan IP target lalu ketuk "Mulai Pencarian" untuk berburu proxy residential yang cocok.',
  export_txt: "EKSPOR TXT",
  exported: "File proxy diekspor",
  export_failed: "Ekspor gagal",
  copied: "disalin",
  mode_ultimate: "ULTIMATE AUTO",
  mode_ultimate_desc: "Pemilihan otomatis terbaik",
  mode_full: "FULL SCAN",
  mode_full_desc: "Negara, Kota, ISP/ASN Cocok",
  mode_city: "KOTA SAJA",
  mode_city_desc: "Fokus pada Kota Tertentu",
  mode_isp: "ISP SAJA",
  mode_isp_desc: "Fokus Penyedia yang Sama",
  owned_badge: "MILIK ANDA",
  connect: "HUBUNGKAN",
  success: "Success!",
  ip_proxy: "IP Proxy",
  location_label: "Location",
  asn_label: "ASN",
  server_label: "Server",
  port_label: "Port",
  ok: "OK",
  // cek ip
  cekip_title: "Cek Informasi IP",
  cekip_sub: "Lacak negara, kota & ISP dari sebuah IP",
  ip_address: "ALAMAT IP",
  check_ip: "CEK IP",
  fill_ip: "Masukkan alamat IP dulu",
  ip_found: "Informasi IP ditemukan",
  track_result: "HASIL PELACAKAN",
  cekip_empty: "Masukkan alamat IP untuk melihat detail lokasi dan penyedia layanan.",
  f_ip: "IP",
  f_country: "Negara",
  f_region: "Wilayah",
  f_city: "Kota",
  f_isp: "ISP",
  f_asn: "ASN",
  f_tz: "Zona Waktu",
  f_coord: "Koordinat",
  // history
  history_title: "Riwayat Koneksi",
  activities_logged: "aktivitas tercatat",
  history_empty: "Belum ada riwayat. Lakukan pencarian proxy atau cek IP untuk mulai mencatat aktivitas.",
  // servers
  servers_title: "Server Saya",
  servers_sub: "Proxy/VPS milik Anda ikut muncul di Hunting",
  add_server: "TAMBAH SERVER",
  servers_empty: "Belum ada server. Tambahkan proxy/VPS Anda agar diprioritaskan saat hunting.",
  export_servers: "EKSPOR",
  servers_exported: "Daftar server diekspor",
  no_servers_export: "Belum ada server untuk diekspor",
  // purchases
  purchases_title: "Riwayat Pembelian",
  purchases_sub: "Semua paket yang pernah Anda aktifkan",
  purchases_empty: "Belum ada pembelian paket. Aktifkan paket di halaman Langganan.",
  active_until: "Aktif s/d",
  label: "LABEL",
  host: "HOST",
  protocol: "PROTOKOL",
  server_added: "Server ditambahkan",
  server_removed: "Server dihapus",
  fill_label_host: "Label dan host wajib diisi",
  // plans
  plans_title: "Paket Langganan",
  plans_sub: "Perpanjang masa aktif membership Anda",
  popular: "POPULER",
  activate: "AKTIFKAN",
  activated: "Paket berhasil diaktifkan",
  buy_note: "Pembayaran belum aktif — aktivasi ini bersifat demo untuk menambah masa aktif.",
  // settings quick
  theme_toggle: "Tema",
  lang_toggle: "Bahasa",
};

const EN: Dict = {
  tab_home: "Home",
  tab_hunting: "Hunting",
  tab_cekip: "Check IP",
  tab_history: "History",
  logout: "LOGOUT",
  save: "SAVE",
  cancel: "CANCEL",
  copy_all: "COPY ALL",
  loading: "Loading...",
  hunter_access: "HUNTER ENGINE ACCESS",
  username: "USERNAME",
  password: "PASSWORD",
  login: "LOGIN",
  no_account: "No account yet? ",
  register_now: "Register now",
  encrypted: "SYSTEM SECURELY ENCRYPTED",
  demo_hint: "Demo account — user: idmee · pass: riyanmee123",
  fill_userpass: "Enter username and password",
  login_failed: "Login failed",
  back: "Back",
  register_title: "CREATE ACCOUNT",
  register_sub: "Create a new RIYANMEE PROXY account",
  choose_username: "Choose a username",
  min6: "Min. 6 characters",
  confirm_password: "CONFIRM PASSWORD",
  repeat_password: "Repeat password",
  register_submit: "REGISTER NOW",
  have_account: "Already have an account? ",
  sign_in: "Sign in",
  register_ok: "Registration successful",
  register_failed: "Registration failed",
  username_min3: "Username must be at least 3 characters",
  password_min6: "Password must be at least 6 characters",
  confirm_mismatch: "Password confirmation does not match",
  customer_profile: "CUSTOMER PROFILE",
  active: "Active:",
  expired: "EXPIRED",
  server: "SERVER",
  port: "PORT",
  change_password: "CHANGE PASSWORD",
  clear_all: "CLEAR ALL",
  reset_traffic: "RESET TRAFFIC",
  ip_whitelist: "IP WHITELIST",
  whitelist_myip: "WHITELIST\nMY IP",
  add_to_whitelist: "ADD TO WHITELIST",
  total_pool: "TOTAL IPS POOL",
  ips_pool: "IPS POOL",
  server_copied: "Server address copied",
  ip_added: "IP added to whitelist",
  ip_removed: "IP removed from whitelist",
  fill_ip_first: "Enter an IP first",
  traffic_reset: "Traffic reset",
  history_cleared: "History cleared",
  pw_changed: "Password changed successfully",
  cur_password: "CURRENT PASSWORD",
  new_password: "NEW PASSWORD",
  new_pw_min6: "New password must be at least 6 characters",
  link_hunting: "IP Hunting",
  link_hunting_sub: "Find proxies by country, city & ISP",
  link_cekip: "IP Information",
  link_cekip_sub: "Trace country, city and ISP of an IP",
  link_servers: "My Servers",
  link_servers_sub: "Manage your own proxy/VPS",
  link_plans: "Subscription",
  link_plans_sub: "Extend your membership period",
  link_purchases: "Purchase History",
  link_purchases_sub: "List of plans you have activated",
  link_gateway: "Connect Gateway",
  link_gateway_sub: "Connect your own proxy gateway VPS",
  link_guide: "VPS Setup Guide",
  link_guide_sub: "Step-by-step to build a proxy on a VPS",
  guide_open: "VPS SETUP GUIDE",
  gateway_title: "Connect Gateway",
  gateway_sub: "Your proxy traffic routing gateway",
  gw_host: "GATEWAY HOST",
  gw_port: "PORT",
  gw_user: "USERNAME (optional)",
  gw_pass: "PASSWORD (optional)",
  gw_protocol: "PROTOCOL",
  gw_save: "SAVE & TEST CONNECTION",
  gw_test: "TEST CONNECTION",
  gw_clear: "REMOVE GATEWAY",
  gw_online: "ONLINE",
  gw_offline: "OFFLINE",
  gw_not_set: "No gateway yet. Add your VPS gateway so the CONNECT button gives a truly working proxy.",
  gw_saved: "Gateway saved",
  gw_cleared: "Gateway removed",
  gw_note: "These credentials are returned on CONNECT. Traffic is routed by your gateway VPS, not by the app.",
  import_servers: "IMPORT",
  import_title: "Import Servers",
  import_hint: "Paste server list (one per line), format: host:port or label | protocol://user@host:port",
  import_btn: "IMPORT NOW",
  imported_n: "servers imported",
  import_empty: "Paste server data first",
  copy_creds: "COPY CREDENTIALS",
  creds_copied: "Credentials copied",
  hunting_title: "IP Hunting",
  hunting_sub: "Find proxies matching target location & ISP",
  target_ip_label: "TARGET IP ADDRESS (IPV4 / IPV6)",
  country_label: "SELECT COUNTRY",
  country_auto: "Automatic (Global)",
  mode_hunting: "HUNTING MODE",
  start_hunt: "START SEARCH",
  hunting_wait: "SEARCHING...",
  fill_target: "Enter the target IP first",
  proxies_found: "PROXIES FOUND",
  similarity: "SIMILARITY",
  best_match: "MATCH",
  info_label: "INFO",
  invalid_ip: "Invalid target IP format",
  hunt_empty: 'Enter a target IP then tap "Start Search" to hunt matching residential proxies.',
  export_txt: "EXPORT TXT",
  exported: "Proxy file exported",
  export_failed: "Export failed",
  copied: "copied",
  mode_ultimate: "ULTIMATE AUTO",
  mode_ultimate_desc: "Best automatic selection",
  mode_full: "FULL SCAN",
  mode_full_desc: "Country, City, ISP/ASN Match",
  mode_city: "CITY ONLY",
  mode_city_desc: "Focus on a specific city",
  mode_isp: "ISP ONLY",
  mode_isp_desc: "Focus on the same provider",
  owned_badge: "YOURS",
  connect: "CONNECT",
  success: "Success!",
  ip_proxy: "IP Proxy",
  location_label: "Location",
  asn_label: "ASN",
  server_label: "Server",
  port_label: "Port",
  ok: "OK",
  cekip_title: "IP Information",
  cekip_sub: "Trace country, city & ISP of an IP",
  ip_address: "IP ADDRESS",
  check_ip: "CHECK IP",
  fill_ip: "Enter an IP address first",
  ip_found: "IP information found",
  track_result: "TRACE RESULT",
  cekip_empty: "Enter an IP address to see location and provider details.",
  f_ip: "IP",
  f_country: "Country",
  f_region: "Region",
  f_city: "City",
  f_isp: "ISP",
  f_asn: "ASN",
  f_tz: "Timezone",
  f_coord: "Coordinates",
  history_title: "Connection History",
  activities_logged: "activities logged",
  history_empty: "No history yet. Run a proxy search or IP check to start logging activity.",
  servers_title: "My Servers",
  servers_sub: "Your proxy/VPS appear in Hunting",
  add_server: "ADD SERVER",
  servers_empty: "No servers yet. Add your proxy/VPS to prioritize them in hunting.",
  export_servers: "EXPORT",
  servers_exported: "Server list exported",
  no_servers_export: "No servers to export yet",
  purchases_title: "Purchase History",
  purchases_sub: "All plans you have activated",
  purchases_empty: "No plan purchases yet. Activate a plan on the Subscription page.",
  active_until: "Active until",
  label: "LABEL",
  host: "HOST",
  protocol: "PROTOCOL",
  server_added: "Server added",
  server_removed: "Server removed",
  fill_label_host: "Label and host are required",
  plans_title: "Subscription Plans",
  plans_sub: "Extend your membership period",
  popular: "POPULAR",
  activate: "ACTIVATE",
  activated: "Plan activated successfully",
  buy_note: "Payment is not active yet — this activation is a demo to extend your period.",
  theme_toggle: "Theme",
  lang_toggle: "Language",
};

const DICTS: Record<Lang, Dict> = { id: ID, en: EN };

type SettingsState = {
  lang: Lang;
  scheme: ColorScheme;
  hydrated: boolean;
  t: (key: string) => string;
  toggleLang: () => void;
  toggleScheme: () => void;
};

const SettingsContext = createContext<SettingsState | null>(null);

export function useSettings(): SettingsState {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}

export function useT(): (key: string) => string {
  return useSettings().t;
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>("id");
  const [scheme, setScheme] = useState<ColorScheme>("dark");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      const storedLang = (await storage.getItem<Lang>(LANG_KEY, "id")) ?? "id";
      const storedScheme = (await storage.getItem<ColorScheme>(SCHEME_KEY, "dark")) ?? "dark";
      setLang(storedLang);
      setScheme(storedScheme);
      setColorScheme(storedScheme);
      setHydrated(true);
    })();
  }, []);

  const toggleLang = useCallback(() => {
    setLang((prev) => {
      const next = prev === "id" ? "en" : "id";
      storage.setItem(LANG_KEY, next);
      return next;
    });
  }, []);

  const toggleScheme = useCallback(() => {
    setScheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      storage.setItem(SCHEME_KEY, next);
      setColorScheme(next);
      return next;
    });
  }, []);

  const t = useCallback(
    (key: string) => DICTS[lang][key] ?? DICTS.id[key] ?? key,
    [lang],
  );

  const value = useMemo(
    () => ({ lang, scheme, hydrated, t, toggleLang, toggleScheme }),
    [lang, scheme, hydrated, t, toggleLang, toggleScheme],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
