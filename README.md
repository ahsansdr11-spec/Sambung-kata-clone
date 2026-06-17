# 🟢 Sambung Kata — Word Cheat Sheet (Offline Clone)

> UI & fitur mirip **sambung-kata-ten.vercel.app**, tapi **offline**, **tanpa login**, pakai database lokal **150.485 kata**.

## ✨ Fitur

- 🔍 **Prefix + Suffix search** — cari kata dari awalan, akhiran, atau kombinasi (combo).
- ⚡ **Magic Suffixes** — chip suffix jebakan (OA, EZ, KS, TT, X, Z, Q, …) dengan tier warna sesuai jumlah kata.
- ✅ **Status filter** — All / Verified / Unverified (badge ✓ untuk kata terverifikasi).
- 🏎️ **Fast Mode** — ketik di Prefix langsung muncul hasil prefix **dan** suffix.
- 🙈 **Hide Mode** — klik kata buat sembunyiin dari hasil (tersimpan di browser).
- 📏 **Full Width** — tampilkan kartu kata satu kolom penuh.
- 💀 **Brutal Mode** — tampilkan semua hasil tanpa soft-cap.
- 🎲 **Random** — kata acak.
- 🕘 **Recent** — kata yang baru disalin.
- 📋 **Klik kata = salin** ke clipboard.
- 🌑 **Dark terminal theme**, responsive HP & desktop.

## 🚀 Cara Menjalankan

```bash
cd site
python3 -m http.server 8000
# buka http://localhost:8000
```

> ⚠️ Wajib lewat **server (localhost)**, jangan dobel-klik `index.html` (protokol `file://` akan memblokir pemuatan database & clipboard).

### Di Termux (HP)
```bash
termux-wake-lock                # biar proses nggak dimatiin android
cd /sdcard/Download/kamus-sambung-kata-v5/site
python3 -m http.server 8000
# buka http://localhost:8000 di browser
```

### Hosting statis
Upload folder `site/` ke Netlify / Vercel / GitHub Pages / Cloudflare Pages. Otomatis HTTPS, langsung jalan tanpa backend.

## 📁 Struktur

```
site/
├── index.html          # Layout clone (dark terminal)
├── css/style.css       # Tema dark + komponen
├── js/
│   ├── data.js         # Engine pencarian (prefix/suffix/combo + status)
│   └── app.js          # Logika UI (search, magic suffix, toggle, dll)
└── data/
    ├── words.json      # 150.485 kata + status verified
    ├── tactical.json   # (legacy) data suffix taktis
    ├── trap-tiers.json # (legacy) tier suffix
    └── popular-suffixes.json
```

## 📊 Database

- **Total**: 150.485 kata unik
- **Verified**: 12.994 kata
- **Format entri**: `{ "w": "meja", "s": "m", "e": "a", "l": 4, "v": 1 }`
  - `v` = 1 verified, 0 unverified
- Gabungan database lama (155.969) + kata baru dari sambung-kata-ten (43.626 baru).

## 📜 Lisensi

MIT — bebas dipakai. Bukan produk resmi Roblox Corporation. UI terinspirasi sambung-kata-ten.vercel.app (@vlodex12).
