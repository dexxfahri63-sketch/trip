# DexxDigital — Open Trip & Tour Operator Nusantara

Platform katalog Open Trip & Tour Operator berbasis React, Vite, Express, dan Cloud Firestore dengan panel manajemen CMS tersembunyi.

## Persyaratan

- **Node.js 22.14+** (mendukung eksekusi langsung `node server.ts`)
- **npm 10+**

## Menjalankan Secara Lokal

1. Salin berkas konfigurasi lingkungan:
   ```bash
   cp .env.example .env
   ```
2. Pasang dependensi:
   ```bash
   npm install
   ```
3. Jalankan server pengembangan (`http://localhost:3000`):
   ```bash
   npm run dev
   ```

## Build & Produksi

```bash
npm run build
npm start
```

## Pengujian & Verifikasi

```bash
npx tsx --test src/utils/tripLogic.test.ts
npm run lint
```

## Sinkronisasi Firebase

Aplikasi terhubung ke Cloud Firestore & Firebase Authentication melalui `firebase-applet-config.json` dan aturan keamanan `firestore.rules`. Data pesanan pelanggan dan konfigurasi lokal disimpan otomatis pada `data/store.json` (diabaikan oleh Git agar data sensitif tidak ikut terunggah ke GitHub).
