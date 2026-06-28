# Deploy Kilat ke VPS

Panduan deploy **kilat.shop** ke VPS sendiri (Ubuntu 22.04/24.04). Database tetap
**SQLite** (file di disk VPS) — cocok untuk skala awal. Jalankan perintah di VPS
lewat SSH. Ganti `kilat.shop` / path `/var/www/kilat` kalau berbeda.

> Estimasi: ~30–45 menit untuk pertama kali.

---

## 0. Prasyarat
- VPS Ubuntu dengan akses `sudo`, dan IP publik.
- Domain `kilat.shop` (sudah kamu punya) + akses ke pengaturan DNS-nya.
- Node.js **20 LTS** atau lebih baru.

```bash
# Node 20 (via nodesource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git nginx
sudo npm install -g pm2
```

---

## 1. Ambil kode ke VPS
Pilih salah satu:

```bash
sudo mkdir -p /var/www && sudo chown $USER:$USER /var/www
cd /var/www

# A) via Git (kalau sudah kamu push ke GitHub):
git clone <URL_REPO_KAMU> kilat

# B) atau via rsync dari komputer lokal (jalankan DI LOKAL):
#   rsync -avz --exclude node_modules --exclude .next --exclude 'prisma/*.db' \
#     "D:/kilat-shop/" user@IP_VPS:/var/www/kilat/
```

```bash
cd /var/www/kilat
npm install
```

---

## 2. Buat file `.env` production
```bash
cp .env.production.example .env
nano .env
```
Isi minimal yang WAJIB:
- `DATABASE_URL="file:/var/www/kilat/prisma/prod.db"`
- `AUTH_SECRET="..."`  → generate: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
- `NEXT_PUBLIC_SITE_URL="https://kilat.shop"` dan `APP_BASE_URL="https://kilat.shop"`
- `CRON_SECRET="..."` (generate seperti AUTH_SECRET) — opsional tapi disarankan

> ⚠️ JANGAN copy `dev.db` dari komputer lokal (isinya data uji + 20 bot). Production
> mulai dari database bersih (langkah berikut).

---

## 3. Siapkan database (SQLite)
```bash
npx prisma db push          # buat tabel di prod.db
npm run db:seed             # isi admin + 5 kategori (PRODUKSI-AMAN, tanpa data demo)
```
Seed default membuat admin **admin@kilat.shop / admin123** + 5 kategori kosong
(tanpa produk/kupon/user demo — production mulai bersih, tinggal tambah produk asli
via `/admin`).

Opsi:
- Set password admin kuat saat seed: `ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run db:seed`
- Isi data contoh untuk testing: `SEED_DEMO=1 npm run db:seed` (16 produk demo +
  stok PALSU + kupon — **jangan dipakai di production**).

**Wajib ganti password admin** setelah login pertama (atau ganti email/akun via /admin/users).

---

## 4. Build
```bash
npm run build
```

---

## 5. Jalankan dengan PM2
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup        # ikuti perintah yang ditampilkan agar auto-start saat reboot
pm2 logs kilat     # cek log, pastikan app jalan di port 3000
```
Tes lokal di VPS: `curl -I http://127.0.0.1:3000` → harus `200 OK`.

---

## 6. Arahkan domain (DNS)
Di panel DNS `kilat.shop`, buat A record ke IP VPS kamu:

| Type | Name | Value          |
|------|------|----------------|
| A    | @    | `IP_VPS_KAMU`  |
| A    | www  | `IP_VPS_KAMU`  |

Tunggu propagasi (biasanya beberapa menit–1 jam).

---

## 7. Nginx (reverse proxy)
```bash
sudo cp deploy/nginx-kilat.shop.conf /etc/nginx/sites-available/kilat.shop
sudo ln -s /etc/nginx/sites-available/kilat.shop /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```
Buka `http://kilat.shop` — situs harus muncul (masih HTTP).

---

## 8. HTTPS (SSL gratis, Let's Encrypt)
```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d kilat.shop -d www.kilat.shop
```
Certbot otomatis menambah SSL + redirect HTTP→HTTPS, dan auto-renew.
Buka `https://kilat.shop` ✅

---

## 9. (Opsional) Cron expire pesanan
Pesanan PENDING yang lewat batas juga auto-expire saat halaman admin/dashboard dibuka,
jadi ini cuma jaring pengaman. Tambah crontab:
```bash
crontab -e
# tiap 10 menit:
*/10 * * * * curl -s -H "Authorization: Bearer GANTI_DENGAN_CRON_SECRET" https://kilat.shop/api/cron/expire-orders >/dev/null
```

---

## 10. Update / redeploy ke depan
```bash
cd /var/www/kilat
git pull                 # atau rsync ulang
npm install
npx prisma db push       # kalau ada perubahan schema
npm run build
pm2 reload kilat
```

---

## 🔒 Catatan penting
- **Backup database rutin** (ini menyimpan saldo & transaksi user!):
  ```bash
  cp /var/www/kilat/prisma/prod.db ~/backups/prod-$(date +%F).db
  ```
  Disarankan otomatis lewat cron harian + simpan off-site.
- **Ganti password admin** setelah deploy (default admin123).
- **Pembayaran** masih mode `simulation` — isi key Midtrans/Tripay di `.env` saat siap
  jualan beneran, lalu daftarkan webhook `https://kilat.shop/api/webhook/<provider>`.
- **Kontak** (IG/Telegram/email): atur di **/admin/settings**.
- Firewall: `sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable`.
