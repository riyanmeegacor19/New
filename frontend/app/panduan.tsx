import Icon from "@react-native-vector-icons/material-design-icons";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { ReactNode, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Segmented } from "@/src/components/segmented";
import { useToast } from "@/src/components/toast";
import { font, makeStyles, mono, radius, spacing, useTheme } from "@/src/theme";

function CodeBlock({ code }: { code: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const toast = useToast();
  return (
    <View style={styles.codeWrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.codeScroll}>
        <Text style={styles.code}>{code}</Text>
      </ScrollView>
      <Pressable
        onPress={async () => {
          await Clipboard.setStringAsync(code);
          toast.show("Perintah disalin", "success");
        }}
        style={styles.copyBtn}
        hitSlop={8}
      >
        <Icon name="content-copy" size={16} color={colors.onBrandTertiary} />
      </Pressable>
    </View>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.stepCard}>
      <View style={styles.stepHead}>
        <View style={styles.stepNum}>
          <Text style={styles.stepNumText}>{n}</Text>
        </View>
        <Text style={styles.stepTitle}>{title}</Text>
      </View>
      <View style={styles.stepBody}>{children}</View>
    </View>
  );
}

export default function PanduanScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [tab, setTab] = useState("vps");

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="panduan-back-button" onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Icon name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={styles.flex1}>
          <Text style={styles.title}>Panduan Setup VPS</Text>
          <Text style={styles.subtitle}>Bangun proxy SOCKS5/HTTP di VPS Anda</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
        <Segmented
          testIdPrefix="panduan-tab"
          options={[{ value: "vps", label: "GATEWAY VPS" }, { value: "pool", label: "IP POOL" }]}
          value={tab}
          onChange={setTab}
        />

        {tab === "vps" ? (
          <>
        <View style={styles.intro}>
          <Icon name="information-outline" size={18} color={colors.brandPrimary} />
          <Text style={styles.introText}>
            Panduan ini membuat proxy SOCKS5/HTTP ber-password di VPS Ubuntu memakai 3proxy. Cocok untuk gateway pribadi. Untuk IP rotating residential, Anda tetap perlu berlangganan penyedia IP pool.
          </Text>
        </View>

        <Step n={1} title="Beli VPS Ubuntu">
          <Text style={styles.p}>
            Beli VPS di Vultr / DigitalOcean / Hetzner / RackNerd (atau lokal: IDCloudHost, Biznet Gio). Pilih paket kecil (1 vCPU, 1 GB RAM) dengan OS Ubuntu 22.04. Anda akan menerima IP publik, user root, dan password.
          </Text>
        </Step>

        <Step n={2} title="Masuk ke VPS via SSH">
          <Text style={styles.p}>Dari komputer, buka Terminal/PowerShell lalu ganti IP_VPS dengan IP Anda:</Text>
          <CodeBlock code={"ssh root@IP_VPS"} />
          <Text style={styles.hint}>Masukkan password saat diminta. Untuk Windows bisa pakai aplikasi Termius/PuTTY.</Text>
        </Step>

        <Step n={3} title="Install 3proxy">
          <Text style={styles.p}>Salin dan jalankan perintah ini satu per satu:</Text>
          <CodeBlock code={"apt update && apt install -y build-essential wget"} />
          <CodeBlock code={"wget https://github.com/3proxy/3proxy/archive/refs/tags/0.9.4.tar.gz"} />
          <CodeBlock code={"tar -xzf 0.9.4.tar.gz && cd 3proxy-0.9.4"} />
          <CodeBlock code={"make -f Makefile.Linux && make -f Makefile.Linux install"} />
        </Step>

        <Step n={4} title="Buat konfigurasi + akun">
          <Text style={styles.p}>Buat file konfigurasi (ganti riyan & passwordkuat dengan milik Anda):</Text>
          <CodeBlock code={"nano /etc/3proxy/3proxy.cfg"} />
          <Text style={styles.p}>Isi dengan:</Text>
          <CodeBlock
            code={
              "nserver 8.8.8.8\n" +
              "nscache 65536\n" +
              "timeouts 1 5 30 60 180 1800 15 60\n" +
              "users riyan:CL:passwordkuat\n" +
              "auth strong\n" +
              "allow riyan\n" +
              "socks -p1080\n" +
              "proxy -p8080\n" +
              "flush"
            }
          />
          <Text style={styles.hint}>Simpan di nano: tekan Ctrl+O lalu Enter, keluar Ctrl+X.</Text>
        </Step>

        <Step n={5} title="Jalankan & buka firewall">
          <CodeBlock code={"ufw allow 1080/tcp && ufw allow 8080/tcp"} />
          <CodeBlock code={"systemctl enable 3proxy && systemctl restart 3proxy"} />
          <Text style={styles.hint}>Cek status: systemctl status 3proxy (harus active/running).</Text>
        </Step>

        <Step n={6} title="Sambungkan ke RIYANMEE PROXY">
          <Text style={styles.p}>Buka menu Sambung Gateway di aplikasi, lalu isi:</Text>
          <View style={styles.kv}><Text style={styles.k}>Host</Text><Text style={styles.v}>IP_VPS Anda</Text></View>
          <View style={styles.kv}><Text style={styles.k}>Port</Text><Text style={styles.v}>1080 (SOCKS5) / 8080 (HTTP)</Text></View>
          <View style={styles.kv}><Text style={styles.k}>Protokol</Text><Text style={styles.v}>SOCKS5</Text></View>
          <View style={styles.kv}><Text style={styles.k}>Username</Text><Text style={styles.v}>riyan</Text></View>
          <View style={styles.kv}><Text style={styles.k}>Password</Text><Text style={styles.v}>passwordkuat</Text></View>
          <Text style={styles.hint}>Tekan SIMPAN & TES KONEKSI. Bila muncul ONLINE, gateway siap dipakai di tombol HUBUNGKAN.</Text>
        </Step>

        <Pressable testID="panduan-goto-gateway" onPress={() => router.replace("/gateway")} style={styles.cta}>
          <Icon name="transit-connection-variant" size={20} color={colors.onBrandPrimary} />
          <Text style={styles.ctaText}>BUKA SAMBUNG GATEWAY</Text>
        </Pressable>
          </>
        ) : (
          <>
            <View style={styles.intro}>
              <Icon name="earth" size={18} color={colors.brandPrimary} />
              <Text style={styles.introText}>
                IP Pool residential/mobile membuat trafik keluar dari IP rumahan asli (bukan datacenter), sehingga sulit terdeteksi. Ini layanan berbayar dari penyedia khusus — bayar per GB atau per jumlah IP.
              </Text>
            </View>

            <Step n={1} title="Pilih penyedia IP Pool">
              <Text style={styles.p}>Penyedia populer & tepercaya:</Text>
              <View style={styles.kv}><Text style={styles.k}>IPRoyal</Text><Text style={styles.v}>murah, per GB</Text></View>
              <View style={styles.kv}><Text style={styles.k}>Smartproxy</Text><Text style={styles.v}>mudah dipakai</Text></View>
              <View style={styles.kv}><Text style={styles.k}>Bright Data</Text><Text style={styles.v}>pool terbesar</Text></View>
              <View style={styles.kv}><Text style={styles.k}>Oxylabs</Text><Text style={styles.v}>enterprise</Text></View>
              <Text style={styles.hint}>Untuk mulai murah, IPRoyal Royal Residential adalah pilihan aman.</Text>
            </Step>

            <Step n={2} title="Daftar & isi saldo">
              <Text style={styles.p}>
                Buat akun di situs penyedia, isi saldo (kartu/PayPal/crypto), lalu pilih produk Residential/Mobile. Anda akan membuat sebuah proxy user (kadang disebut zone/channel).
              </Text>
            </Step>

            <Step n={3} title="Ambil endpoint & kredensial">
              <Text style={styles.p}>Di dashboard penyedia, salin detail koneksi. Contoh format umum:</Text>
              <View style={styles.kv}><Text style={styles.k}>Host</Text><Text style={styles.v}>proxy.provider.com</Text></View>
              <View style={styles.kv}><Text style={styles.k}>Port</Text><Text style={styles.v}>12321</Text></View>
              <View style={styles.kv}><Text style={styles.k}>Username</Text><Text style={styles.v}>user-abcdef</Text></View>
              <View style={styles.kv}><Text style={styles.k}>Password</Text><Text style={styles.v}>passwordkamu</Text></View>
              <Text style={styles.hint}>Sebagian penyedia menaruh opsi lokasi di username, mis: user-country-id atau user-city-jakarta.</Text>
            </Step>

            <Step n={4} title="Pilih rotating / sticky">
              <Text style={styles.p}>
                Rotating: IP berganti tiap request (bagus untuk scraping). Sticky: IP tetap beberapa menit (bagus untuk login). Biasanya diatur lewat port berbeda atau akhiran username, contoh:
              </Text>
              <CodeBlock code={"user-country-id-session-abc123"} />
              <Text style={styles.hint}>Cek dokumentasi penyedia untuk pola sticky session mereka.</Text>
            </Step>

            <Step n={5} title="Sambungkan ke RIYANMEE PROXY">
              <Text style={styles.p}>Buka menu Sambung Gateway, lalu isi endpoint dari penyedia:</Text>
              <View style={styles.kv}><Text style={styles.k}>Host</Text><Text style={styles.v}>proxy.provider.com</Text></View>
              <View style={styles.kv}><Text style={styles.k}>Port</Text><Text style={styles.v}>12321</Text></View>
              <View style={styles.kv}><Text style={styles.k}>Protokol</Text><Text style={styles.v}>HTTP / SOCKS5</Text></View>
              <View style={styles.kv}><Text style={styles.k}>Username</Text><Text style={styles.v}>user-abcdef</Text></View>
              <View style={styles.kv}><Text style={styles.k}>Password</Text><Text style={styles.v}>passwordkamu</Text></View>
              <Text style={styles.hint}>Tekan SIMPAN & TES KONEKSI. Bila ONLINE, hasil HUBUNGKAN akan memakai IP pool asli Anda.</Text>
            </Step>

            <Pressable testID="panduan-goto-gateway-pool" onPress={() => router.replace("/gateway")} style={styles.cta}>
              <Icon name="transit-connection-variant" size={20} color={colors.onBrandPrimary} />
              <Text style={styles.ctaText}>BUKA SAMBUNG GATEWAY</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  back: { width: 36, height: 44, alignItems: "flex-start", justifyContent: "center" },
  flex1: { flex: 1 },
  title: { color: colors.onSurface, fontSize: font.xl, fontWeight: "800", letterSpacing: 1 },
  subtitle: { color: colors.muted, fontSize: font.sm, marginTop: 2 },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.md },
  intro: { flexDirection: "row", gap: spacing.sm, backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  introText: { flex: 1, color: colors.onSurfaceSecondary, fontSize: font.sm, lineHeight: 19 },
  stepCard: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.divider, borderRadius: radius.lg, padding: spacing.lg },
  stepHead: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.md },
  stepNum: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  stepNumText: { color: colors.onBrandPrimary, fontSize: font.base, fontWeight: "800" },
  stepTitle: { flex: 1, color: colors.onSurface, fontSize: font.lg, fontWeight: "700" },
  stepBody: { gap: spacing.sm },
  p: { color: colors.onSurfaceSecondary, fontSize: font.sm, lineHeight: 19 },
  hint: { color: colors.muted, fontSize: font.sm, lineHeight: 18, fontStyle: "italic" },
  codeWrap: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.divider, borderRadius: radius.md },
  codeScroll: { padding: spacing.md, paddingRight: 44 },
  code: { color: colors.onSurface, fontSize: font.sm, fontFamily: mono, lineHeight: 20 },
  copyBtn: { position: "absolute", right: 6, top: 6, width: 32, height: 32, borderRadius: radius.sm, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  kv: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md, paddingVertical: 4 },
  k: { color: colors.muted, fontSize: font.sm, fontWeight: "700" },
  v: { color: colors.onSurface, fontSize: font.sm, fontFamily: mono, flexShrink: 1, textAlign: "right" },
  cta: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, height: 54, borderRadius: radius.md, backgroundColor: colors.brandPrimary, marginTop: spacing.sm },
  ctaText: { color: colors.onBrandPrimary, fontSize: font.base, fontWeight: "800", letterSpacing: 1 },
}));
