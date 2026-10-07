# wuspot

Alat online gratis berbahasa Indonesia. Alat pertama: **Kompres PDF** (bisa memilih target ukuran KB).
Semua file diproses di browser pengguna (pdf.js + pdf-lib), tidak ada upload ke server.

## Menjalankan di komputer

```bash
npm install
npm run dev        # http://localhost:3000
```

`npm run dev` dan `npm run build` otomatis menyalin aset pdf.js (worker, cmaps, font standar, wasm)
ke `public/pdfjs/`. Folder itu tidak ikut di-commit.

## Perintah lain

| Perintah | Fungsi |
|---|---|
| `npm run build` lalu `npm start` | build produksi dan menjalankannya |
| `npm run lint` / `npm run typecheck` | cek kode |
| `npm test` | unit test (vitest) |
| `npm run fixtures` | membuat PDF contoh untuk pengujian (butuh `python3` + `pikepdf`) |
| `npm run test:e2e` | uji mesin kompres di Chromium sungguhan (Playwright) |

## Struktur singkat

- `src/lib/pdf-compress/` — mesin kompres (berjalan di browser). Kontrak publiknya ada di `types.ts`.
- `src/content/` — semua teks halaman (bisa diedit tanpa menyentuh komponen).
- `src/lib/site.ts` — nama situs, email kontak, daftar alat.
- `src/proxy.ts` — menjawab URL wuspot versi lama (`/cari/...`, `/channel/...`, `/08365/...html`, dll.) dengan **410 Gone**.
- `src/app/uji-mesin` — halaman uji khusus mode pengembangan (otomatis 404 di produksi).

## Deploy

Paling mudah di **Vercel** (gratis untuk mulai): impor repo ini, tanpa pengaturan tambahan.
`src/proxy.ts` butuh server Next.js atau platform yang mendukung Next.js penuh (Vercel, Netlify, Cloudflare via OpenNext).
Kalau suatu saat ingin hosting statis murni, aturan 410 harus dipindah ke konfigurasi server/CDN.

Setelah online:
1. Pastikan domain `wuspot.com` (tanpa www) jadi alamat utama, `www` dialihkan ke sana.
2. Kirim `https://wuspot.com/sitemap.xml` di Google Search Console.
3. Ganti email kontak di `src/lib/site.ts` dengan alamat yang aktif.
