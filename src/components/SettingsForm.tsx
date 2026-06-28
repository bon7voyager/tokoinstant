"use client";

import { useActionState, useState } from "react";
import { updateSettingsAction } from "@/app/actions/settings";
import { Button, Input, Select, Alert, Textarea } from "@/components/ui";

type Props = {
  initial: Record<string, string>;
  secretSet: Record<string, boolean>;
};

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs font-medium text-ink/50">{hint}</span>}
    </label>
  );
}

function SecretField({
  name,
  label,
  isSet,
  hint,
}: {
  name: string;
  label: string;
  isSet: boolean;
  hint?: string;
}) {
  return (
    <Field
      label={label}
      hint={hint ?? (isSet ? "Tersimpan — kosongkan untuk tetap pakai yang sekarang." : "Belum diatur.")}
    >
      <Input
        type="password"
        name={name}
        autoComplete="off"
        placeholder={isSet ? "•••••••••••• (tersimpan)" : "Masukkan kunci…"}
      />
    </Field>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="border-3 border-ink bg-white p-5 shadow-brutal">
      <h2 className="font-display text-xl">{title}</h2>
      {desc && <p className="mt-1 text-sm font-medium text-ink/60">{desc}</p>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

export default function SettingsForm({ initial, secretSet }: Props) {
  const [state, formAction, pending] = useActionState(updateSettingsAction, undefined);
  const [provider, setProvider] = useState(initial.PAYMENT_PROVIDER || "simulation");
  const [bannerPreview, setBannerPreview] = useState<string | null>(initial.BANNER_IMAGE_URL || null);

  function onBannerFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setBannerPreview(URL.createObjectURL(f));
  }

  return (
    <form action={formAction} className="space-y-6">
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      {state?.success && <Alert tone="success">{state.success}</Alert>}

      {/* Payment */}
      <Section
        title="💳 Pembayaran"
        desc="Pilih provider & masukkan API key-nya. Kalau key kosong/kurang, otomatis pakai mode simulasi."
      >
        <Field label="Provider Pembayaran" hint="simulation = instan tanpa bayar nyata (default).">
          <Select
            name="PAYMENT_PROVIDER"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
          >
            <option value="simulation">Simulation (default)</option>
            <option value="midtrans">Midtrans (Snap)</option>
            <option value="tripay">Tripay (QRIS/VA/e-wallet)</option>
            <option value="pakasir">Pakasir (QRIS/VA link)</option>
          </Select>
        </Field>

        <Field label="App Base URL" hint="Dipakai untuk URL webhook & return gateway.">
          <Input name="APP_BASE_URL" defaultValue={initial.APP_BASE_URL} placeholder="https://domainmu.com" />
        </Field>

        {provider === "midtrans" && (
          <>
            <SecretField name="MIDTRANS_SERVER_KEY" label="Midtrans Server Key" isSet={secretSet.MIDTRANS_SERVER_KEY} />
            <Field label="Midtrans Client Key">
              <Input name="MIDTRANS_CLIENT_KEY" defaultValue={initial.MIDTRANS_CLIENT_KEY} placeholder="Mid-client-…" />
            </Field>
            <label className="flex items-center gap-2 sm:col-span-2">
              <input
                type="checkbox"
                name="MIDTRANS_IS_PRODUCTION"
                value="true"
                defaultChecked={initial.MIDTRANS_IS_PRODUCTION === "true"}
                className="h-5 w-5 border-3 border-ink accent-grape"
              />
              <span className="text-sm font-bold">Mode Produksi Midtrans (matikan untuk sandbox)</span>
            </label>
          </>
        )}

        {provider === "tripay" && (
          <>
            <SecretField name="TRIPAY_API_KEY" label="Tripay API Key" isSet={secretSet.TRIPAY_API_KEY} />
            <SecretField name="TRIPAY_PRIVATE_KEY" label="Tripay Private Key" isSet={secretSet.TRIPAY_PRIVATE_KEY} />
            <Field label="Tripay Merchant Code">
              <Input name="TRIPAY_MERCHANT_CODE" defaultValue={initial.TRIPAY_MERCHANT_CODE} placeholder="T1234" />
            </Field>
            <Field label="Metode Pembayaran" hint="Mis. QRIS, BRIVA, DANA…">
              <Input name="TRIPAY_PAYMENT_METHOD" defaultValue={initial.TRIPAY_PAYMENT_METHOD} placeholder="QRIS" />
            </Field>
            <label className="flex items-center gap-2 sm:col-span-2">
              <input
                type="checkbox"
                name="TRIPAY_IS_PRODUCTION"
                value="true"
                defaultChecked={initial.TRIPAY_IS_PRODUCTION === "true"}
                className="h-5 w-5 border-3 border-ink accent-grape"
              />
              <span className="text-sm font-bold">Mode Produksi Tripay (matikan untuk sandbox)</span>
            </label>
          </>
        )}

        {provider === "pakasir" && (
          <>
            <SecretField name="PAKASIR_API_KEY" label="Pakasir API Key" isSet={secretSet.PAKASIR_API_KEY} />
            <Field label="Project Slug" hint="Slug proyek dari dashboard Pakasir.">
              <Input name="PAKASIR_PROJECT" defaultValue={initial.PAKASIR_PROJECT} placeholder="namaproyek" />
            </Field>
            <label className="flex items-center gap-2 sm:col-span-2">
              <input
                type="checkbox"
                name="PAKASIR_QRIS_ONLY"
                value="true"
                defaultChecked={initial.PAKASIR_QRIS_ONLY === "true"}
                className="h-5 w-5 border-3 border-ink accent-grape"
              />
              <span className="text-sm font-bold">Batasi ke QRIS saja (sembunyikan VA & lainnya)</span>
            </label>
            <p className="sm:col-span-2 text-xs font-medium text-ink/60">
              Di dashboard Pakasir, set <b>Webhook URL</b> ke{" "}
              <code className="font-mono">{`<App Base URL>/api/webhook/pakasir`}</code> agar pembayaran
              otomatis terkonfirmasi.
            </p>
          </>
        )}

        {provider === "simulation" && (
          <p className="sm:col-span-2 text-sm font-medium text-ink/60">
            Mode simulasi aktif — pembayaran langsung dianggap lunas. Pilih Midtrans/Tripay/Pakasir
            untuk menerima pembayaran sungguhan.
          </p>
        )}
      </Section>

      {/* Membership moved to its own hub */}
      <Section title="💎 Membership Reseller" desc="Pindah ke menu khusus.">
        <p className="text-sm font-medium text-ink/60 sm:col-span-2">
          Biaya upgrade, durasi, diskon default, diskon per produk & daftar reseller
          kini diatur di menu{" "}
          <a href="/admin/membership" className="brutal-link">
            Reseller
          </a>
          .
        </p>
      </Section>

      {/* Wallet & Orders */}
      <Section title="👛 Saldo & Pesanan" desc="Batas top up, penarikan, dan masa berlaku pesanan.">
        <Field label="Top Up Minimal (Rp)">
          <Input type="number" name="TOPUP_MIN" defaultValue={initial.TOPUP_MIN} placeholder="10000" />
        </Field>
        <Field label="Top Up Maksimal (Rp)">
          <Input type="number" name="TOPUP_MAX" defaultValue={initial.TOPUP_MAX} placeholder="5000000" />
        </Field>
        <Field label="Nominal Cepat" hint="Pisahkan dengan koma.">
          <Input name="TOPUP_PRESETS" defaultValue={initial.TOPUP_PRESETS} placeholder="20000,50000,100000,250000" />
        </Field>
        <Field label="Tarik Saldo Minimal (Rp)">
          <Input type="number" name="WITHDRAW_MIN" defaultValue={initial.WITHDRAW_MIN} placeholder="10000" />
        </Field>
        <Field label="Batas Bayar Pesanan (menit)" hint="Pesanan belum dibayar otomatis batal setelah ini.">
          <Input type="number" name="ORDER_EXPIRY_MINUTES" defaultValue={initial.ORDER_EXPIRY_MINUTES} placeholder="60" />
        </Field>
      </Section>

      {/* Referral */}
      <Section
        title="🎁 Referral"
        desc="Bonus saldo (untuk pengajak & teman) saat teman yang diajak menyelesaikan belanja pertama."
      >
        <Field label="Bonus Pengajak (Rp)">
          <Input
            type="number"
            name="REFERRAL_REFERRER_BONUS"
            defaultValue={initial.REFERRAL_REFERRER_BONUS}
            placeholder="5000"
          />
        </Field>
        <Field label="Bonus Teman (Rp)">
          <Input
            type="number"
            name="REFERRAL_REFEREE_BONUS"
            defaultValue={initial.REFERRAL_REFEREE_BONUS}
            placeholder="5000"
          />
        </Field>
        <Field
          label="Min. Belanja agar Bonus Cair (Rp)"
          hint="Bonus baru cair jika belanja pertama ≥ nilai ini. Otomatis tak pernah lebih kecil dari total bonus (anti rugi). 0 = pakai batas otomatis."
        >
          <Input
            type="number"
            name="REFERRAL_MIN_ORDER"
            defaultValue={initial.REFERRAL_MIN_ORDER}
            placeholder="0"
          />
        </Field>
        <Field
          label="Pengajak Harus Sudah Pernah Belanja"
          hint="Jika Ya, bonus pengajak hanya cair bila pengajak sendiri punya ≥1 pesanan berbayar (anti akun palsu)."
        >
          <Select
            name="REFERRAL_REFERRER_REQUIRE_PURCHASE"
            defaultValue={initial.REFERRAL_REFERRER_REQUIRE_PURCHASE || "1"}
          >
            <option value="1">Ya (disarankan)</option>
            <option value="0">Tidak</option>
          </Select>
        </Field>
        <Field
          label="Maks. Referral Berbonus / Periode"
          hint="Batas jumlah referral berbonus per pengajak dalam 1 periode. 0 = tanpa batas."
        >
          <Input
            type="number"
            name="REFERRAL_MAX_PER_PERIOD"
            defaultValue={initial.REFERRAL_MAX_PER_PERIOD}
            placeholder="0"
          />
        </Field>
        <Field label="Panjang Periode (hari)" hint="Jendela waktu untuk batas di atas.">
          <Input
            type="number"
            name="REFERRAL_PERIOD_DAYS"
            defaultValue={initial.REFERRAL_PERIOD_DAYS}
            placeholder="30"
          />
        </Field>
        <Field
          label="Blokir Referral dari IP Sama"
          hint="Jika Ya, referral diabaikan bila pengajak & teman daftar dari IP yang sama (anti akun ganda). Matikan bila banyak user sah berbagi jaringan."
        >
          <Select
            name="REFERRAL_BLOCK_SAME_IP"
            defaultValue={initial.REFERRAL_BLOCK_SAME_IP || "1"}
          >
            <option value="1">Ya (disarankan)</option>
            <option value="0">Tidak</option>
          </Select>
        </Field>
      </Section>

      {/* Banner / Pengumuman */}
      <Section
        title="📣 Banner Beranda"
        desc="Popup promo/pengumuman yang muncul saat pengunjung membuka beranda (homepage). Aktifkan saat mau promosi; pengunjung bisa menutupnya, dan popup muncul lagi otomatis tiap kamu mengubah isinya."
      >
        <Field label="Status">
          <Select name="BANNER_ENABLED" defaultValue={initial.BANNER_ENABLED || "0"}>
            <option value="0">Nonaktif</option>
            <option value="1">Aktif</option>
          </Select>
        </Field>
        <Field label="Judul">
          <Input name="BANNER_TITLE" defaultValue={initial.BANNER_TITLE} maxLength={80} placeholder="Promo Spesial Hari Ini! 🎉" />
        </Field>
        <Field label="Isi Pesan" hint="Teks biasa, maks 500 karakter. Boleh beberapa baris.">
          <Textarea name="BANNER_BODY" defaultValue={initial.BANNER_BODY} rows={3} maxLength={500} placeholder="Diskon 20% semua produk sampai akhir bulan…" />
        </Field>
        <Field
          label="Gambar (opsional)"
          hint="Unggah file (maks 4MB) atau tempel URL. Ukuran ideal 800×400 px (rasio 2:1, lanskap); ditampilkan dipotong-tengah, tinggi maks ±224 px."
        >
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex h-24 w-40 shrink-0 items-center justify-center overflow-hidden border-3 border-ink bg-paper shadow-brutal-sm">
              {bannerPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={bannerPreview} alt="Pratinjau banner" className="h-full w-full object-cover" />
              ) : (
                <span className="text-3xl">🖼️</span>
              )}
            </div>
            <div className="min-w-[200px] flex-1 space-y-2">
              <input
                type="file"
                name="BANNER_IMAGE_FILE"
                accept="image/*"
                onChange={onBannerFile}
                className="block w-full border-3 border-ink bg-white p-2 text-sm font-medium file:mr-3 file:border-3 file:border-ink file:bg-main file:px-3 file:py-1 file:font-bold"
              />
              <Input
                name="BANNER_IMAGE_URL"
                defaultValue={initial.BANNER_IMAGE_URL}
                onChange={(e) => setBannerPreview(e.target.value.trim() || null)}
                placeholder="atau tempel URL (https://… atau /uploads/…)"
                className="!text-sm"
              />
            </div>
          </div>
        </Field>
        <Field label="Teks Tombol (opsional)">
          <Input name="BANNER_CTA_LABEL" defaultValue={initial.BANNER_CTA_LABEL} placeholder="Lihat Promo" />
        </Field>
        <Field label="Link Tombol (opsional)" hint="Tombol hanya muncul jika teks & link diisi.">
          <Input name="BANNER_CTA_URL" defaultValue={initial.BANNER_CTA_URL} placeholder="/produk atau https://…" />
        </Field>
      </Section>

      {/* Contact */}
      <Section
        title="📞 Kontak Admin"
        desc="Tampil di footer, tombol mengambang, dan halaman produk. Kosongkan yang tak dipakai."
      >
        <Field label="Nomor WhatsApp" hint="Format internasional tanpa +, mis. 628123456789.">
          <Input name="CONTACT_WHATSAPP" defaultValue={initial.CONTACT_WHATSAPP} placeholder="628123456789" />
        </Field>
        <Field label="Email">
          <Input name="CONTACT_EMAIL" defaultValue={initial.CONTACT_EMAIL} placeholder="admin@kilat.shop" />
        </Field>
        <Field label="Instagram" hint="Username saja, tanpa @.">
          <Input name="CONTACT_INSTAGRAM" defaultValue={initial.CONTACT_INSTAGRAM} placeholder="kilatshop" />
        </Field>
        <Field label="Telegram" hint="Username saja, tanpa @.">
          <Input name="CONTACT_TELEGRAM" defaultValue={initial.CONTACT_TELEGRAM} placeholder="kilatshop" />
        </Field>
        <Field label="Jam Operasional">
          <Input name="CONTACT_HOURS" defaultValue={initial.CONTACT_HOURS} placeholder="Setiap hari · 08.00–22.00 WIB" />
        </Field>
      </Section>

      <div className="flex items-center gap-3">
        <Button type="submit" size="lg" variant="grape" disabled={pending}>
          {pending ? "Menyimpan…" : "Simpan Pengaturan"}
        </Button>
        <span className="text-xs font-medium text-ink/50">
          Field kosong = pakai default. Kunci rahasia disimpan aman & tidak ditampilkan ulang.
        </span>
      </div>
    </form>
  );
}
