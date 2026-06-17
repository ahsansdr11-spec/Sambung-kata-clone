# 🚀 Cara Deploy ke Vercel + Setup Admin Panel (Step-by-Step untuk Pemula)

Web ini punya 2 bagian:
- **Web utama** (`/`) — pencarian kata, statis, super cepat.
- **Admin panel** (`/admin`) — login khusus kamu, bisa tambah/reject kata & kelola user.

Perubahan dari admin panel **langsung live** untuk semua pengunjung (karena pakai database).

---

> ⚠️ **CATATAN STRUKTUR (penting):** File web (`index.html`, `css/`, `js/`, `data/`) sekarang ada di **root** (bukan di folder `site/`), supaya Vercel langsung bisa serve halaman utama tanpa 404.

## 📋 Yang kamu butuhkan (semua GRATIS)
1. Akun **GitHub** → https://github.com
2. Akun **Vercel** → https://vercel.com (login pakai GitHub aja)

---

## LANGKAH 1 — Upload kode ke GitHub

**Cara paling gampang (lewat web, tanpa command):**
1. Buka https://github.com/new
2. Repository name: `sambung-kata` → klik **Create repository**
3. Di halaman repo, klik **"uploading an existing file"**
4. Extract ZIP `sambung-kata-vercel.zip`, lalu **drag semua isinya** (folder `site`, `api`, `lib`, file `package.json`, `vercel.json`, dll) ke kotak upload.
5. Klik **Commit changes**.

> ⚠️ JANGAN upload folder `node_modules` kalau ada (nggak perlu).

---

## LANGKAH 2 — Import ke Vercel

1. Buka https://vercel.com/new
2. Pilih repo **sambung-kata** → klik **Import**
3. Biarkan semua setting default → klik **Deploy**
4. Tunggu ~1 menit. Akan muncul URL seperti `https://sambung-kata-xxx.vercel.app`

> Saat ini web utama sudah jalan, tapi admin panel BELUM (perlu database). Lanjut ke Langkah 3.

---

## LANGKAH 3 — Tambah Database (Vercel Postgres)

1. Di dashboard project Vercel, klik tab **Storage**
2. Klik **Create Database** → pilih **Postgres** → **Continue**
3. Kasih nama (bebas), pilih region terdekat (mis. Singapore) → **Create**
4. Klik **Connect** ke project kamu.

> Vercel otomatis menambahkan variabel `POSTGRES_URL` dll ke project. Kamu **tidak perlu** isi manual.

---

## LANGKAH 4 — Set Password Admin (Environment Variables)

1. Di project Vercel → tab **Settings** → **Environment Variables**
2. Tambahkan 3 variabel ini (klik Add untuk tiap baris):

| Key | Value |
|-----|-------|
| `ADMIN_USERNAME` | `ahsans` (atau username pilihanmu) |
| `ADMIN_PASSWORD` | password kuat pilihanmu |
| `PW_SALT` | teks acak panjang & rahasia (mis. `xK9$mP2qLz...`) |

3. Klik **Save**.

---

## LANGKAH 5 — Redeploy

1. Tab **Deployments** → klik deployment paling atas → titik tiga (⋯) → **Redeploy**
2. Tunggu selesai.

✅ **SELESAI!**

---

## 🎮 Cara Pakai

- **Web utama**: `https://web-kamu.vercel.app/`
- **Admin panel**: `https://web-kamu.vercel.app/admin`
  - Login pakai `ADMIN_USERNAME` + `ADMIN_PASSWORD` yang tadi kamu set.

### Fitur Admin Panel
| Fitur | Keterangan |
|-------|-----------|
| ➕ **Tambah Kata** | Tambah kata baru (bisa tandai verified) |
| 🚫 **Reject Kata** | Sembunyikan kata dari hasil publik (soft delete) |
| ✔ **Ubah Status** | Set verified/unverified suatu kata |
| 📋 **Kelola** | Lihat & batalkan kata tambahan / reject |
| ⚡ **Tactical** | Tambah/hapus tactical suffix untuk Trap Mode |
| 🔑 **Akun** | Ganti password (Current/New/Confirm) |
| 👤 **Users** (superadmin) | Buat user baru, jadikan superadmin, hapus user |

### Fitur Web Utama (persis sambung-kata-ten)
- **Fast / Normal Mode** — 1 search bar vs prefix+suffix terpisah
- **Trap Mode** — grouping hasil per tactical suffix (prioritas tier)
- **Hide Mode** — klik judul grup buat sembunyiin
- **Brutal Mode** — tampilkan semua hasil (no cap)
- **Full Width** — kartu 1 kolom
- **Sort by length** — A–Z / panjang naik / panjang turun
- **Status filter** — All / Verified / Unverified
- **Magic Suffixes** — chip Dead-End traps
- **Recent history** — kata terakhir disalin
- Semua setting tersimpan di browser (localStorage)

Semua perubahan **langsung live** di web utama (refresh halaman untuk lihat).

---

## ❓ Troubleshooting

- **Admin panel "Server error"** → pastikan Database sudah di-Connect (Langkah 3) & sudah Redeploy.
- **Login gagal** → cek `ADMIN_USERNAME`/`ADMIN_PASSWORD` di Environment Variables sudah benar & sudah Redeploy.
- **Lupa password admin** → ganti `ADMIN_PASSWORD` di env, lalu di database hapus baris user lama (atau buat username baru), Redeploy.
- **Web utama tetap jalan** walau database belum ada — fitur admin saja yang butuh database.

---

## 🔒 Catatan Keamanan
- Password admin disimpan **hash** (SHA-256 + salt), bukan plain text.
- Password tidak ada di dalam kode — hanya di Environment Variables Vercel.
- Ganti `PW_SALT` dengan nilai unik & rahasia milikmu.
