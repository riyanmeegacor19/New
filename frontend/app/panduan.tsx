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

        <View style={styles.phoneCard}>
          <View style={styles.phoneHead}>
            <Icon name="cellphone-check" size={20} color={colors.brandPrimary} />
            <Text style={styles.phoneTitle}>Tanpa komputer? Pakai HP</Text>
          </View>
          <Text style={styles.p}>
            Anda bisa setup VPS langsung dari HP. Install aplikasi SSH gratis dari Play Store / App Store:
          </Text>
          <View style={styles.kv}><Text style={styles.k}>Android</Text><Text style={styles.v}>Termius / JuiceSSH / Termux</Text></View>
          <View style={styles.kv}><Text style={styles.k}>iPhone</Text><Text style={styles.v}>Termius / Blink Shell</Text></View>
          <Text style={styles.p}>Cara pakai Termius (paling mudah):</Text>
          <Text style={styles.li}>1. Buka Termius → New Host</Text>
          <Text style={styles.li}>2. Address: isi IP VPS Anda</Text>
          <Text style={styles.li}>3. Username: root · Password: dari penyedia VPS</Text>
          <Text style={styles.li}>4. Tap host itu untuk connect</Text>
          <Text style={styles.li}>5. Lanjutkan perintah di Langkah 3-5 di bawah (tap ikon salin, lalu tempel di Termius)</Text>
        </View>

        <Step n={1} title="Beli VPS Ubuntu">
          <Text style={styles.p}>
            Beli VPS di Vultr / DigitalOcean / Hetzner / RackNerd (atau lokal: IDCloudHost, Biznet Gio). Pilih paket kecil (1 vCPU, 1 GB RAM) dengan OS Ubuntu 22.04. Anda akan menerima IP publik, user root, dan password.
          </Text>
        </Step>

        <Step n={2} title="Masuk ke VPS (Termius) & jadi root">
          <Text style={styles.p}>Di Termius, tambah host: Address = IP VPS, Username & Password dari dashboard penyedia (Vultr kadang pakai user linuxuser, bukan root). Setelah masuk, jadikan root:</Text>
          <CodeBlock code={"sudo -i"} />
          <Text style={styles.hint}>Jika diminta password, ketik password login VPS Anda. Tanda berubah jadi root@... berarti berhasil.</Text>
        </Step>

        <Step n={3} title="Install 3proxy">
          <Text style={styles.p}>Salin & jalankan tiap blok satu per satu, tunggu selesai:</Text>
          <CodeBlock code={"apt update && apt install -y build-essential wget"} />
          <CodeBlock code={"cd /root && wget https://github.com/3proxy/3proxy/archive/refs/tags/0.9.4.tar.gz && tar -xzf 0.9.4.tar.gz && cd 3proxy-0.9.4"} />
          <CodeBlock code={"make -f Makefile.Linux && make -f Makefile.Linux install"} />
        </Step>

        <Step n={4} title="Buat konfigurasi + akun proxy">
          <Text style={styles.p}>Salin blok ini utuh (ganti riyan & Riyan12345 sesuka Anda). Ini otomatis membuat file konfigurasi tanpa perlu nano:</Text>
          <CodeBlock
            code={
              "cat >/etc/3proxy.cfg <<'EOF'\n" +
              "nserver 8.8.8.8\n" +
              "nscache 65536\n" +
              "timeouts 1 5 30 60 180 1800 15 60\n" +
              "users riyan:CL:Riyan12345\n" +
              "auth strong\n" +
              "allow riyan\n" +
              "socks -p1080\n" +
              "proxy -p8080\n" +
              "flush\n" +
              "EOF"
            }
          />
        </Step>

        <Step n={5} title="Buat service & jalankan">
          <Text style={styles.p}>Cari lokasi program lalu buat service otomatis:</Text>
          <CodeBlock code={"BIN=$(command -v 3proxy || echo /usr/local/bin/3proxy); echo $BIN"} />
          <CodeBlock
            code={
              "cat >/etc/systemd/system/3proxy.service <<EOF\n" +
              "[Unit]\n" +
              "Description=3proxy\n" +
              "After=network.target\n" +
              "[Service]\n" +
              "ExecStart=$BIN /etc/3proxy.cfg\n" +
              "Restart=always\n" +
              "[Install]\n" +
              "WantedBy=multi-user.target\n" +
              "EOF"
            }
          />
          <CodeBlock code={"systemctl daemon-reload && systemctl enable --now 3proxy && systemctl status 3proxy --no-pager"} />
          <Text style={styles.hint}>Jika muncul active (running) hijau, proxy sudah berjalan. (Vultr default tanpa firewall; jika pakai ufw: ufw allow 1080/tcp && ufw allow 8080/tcp)</Text>
        </Step>

        <Step n={6} title="Sambungkan ke RIYANMEE PROXY">
          <Text style={styles.p}>Buka menu Sambung Gateway di aplikasi, lalu isi:</Text>
          <View style={styles.kv}><Text style={styles.k}>Host</Text><Text style={styles.v}>IP VPS Anda</Text></View>
          <View style={styles.kv}><Text style={styles.k}>Port</Text><Text style={styles.v}>1080 (SOCKS5) / 8080 (HTTP)</Text></View>
          <View style={styles.kv}><Text style={styles.k}>Protokol</Text><Text style={styles.v}>SOCKS5</Text></View>
          <View style={styles.kv}><Text style={styles.k}>Username</Text><Text style={styles.v}>riyan</Text></View>
          <View style={styles.kv}><Text style={styles.k}>Password</Text><Text style={styles.v}>Riyan12345</Text></View>
          <Text style={styles.hint}>Tekan SIMPAN & TES KONEKSI. Bila muncul ONLINE, gateway siap dipakai di tombol HUBUNGKAN.</Text>
        </Step>

        <Step n={7} title="Selesai — lalu ke mana?">
          <Text style={styles.p}>Setelah langkah 5 menunjukkan active (running), pekerjaan di VPS SELESAI. Anda boleh:</Text>
          <Text style={styles.li}>• Tutup / keluar dari Termius (ketik exit lalu Enter, atau tap X). Proxy tetap jalan 24 jam di VPS meski Termius ditutup.</Text>
          <Text style={styles.li}>• Kembali ke aplikasi RIYANMEE PROXY.</Text>
          <Text style={styles.li}>• Buka Sambung Gateway (tombol di bawah), isi data langkah 6, tap SIMPAN & TES KONEKSI.</Text>
          <Text style={styles.li}>• Buka tab Hunting → cari IP → tap HUBUNGKAN → kredensial gateway Anda muncul & bisa disalin.</Text>
          <Text style={styles.hint}>Tips keamanan: setelah selesai, ganti password login VPS Anda di dashboard penyedia.</Text>
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
  li: { color: colors.onSurfaceSecondary, fontSize: font.sm, lineHeight: 20, paddingLeft: spacing.xs },
  phoneCard: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  phoneHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs },
  phoneTitle: { color: colors.onSurface, fontSize: font.lg, fontWeight: "800" },
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
