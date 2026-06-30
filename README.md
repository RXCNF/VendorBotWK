# VendorBotWK 🤖

VendorBotWK adalah AI Chat Assistant berbasis **Node.js**, **Express**, dan **OpenAI**. Aplikasi ini dirancang untuk memberikan respon percakapan interaktif menggunakan arsitektur REST API dengan integrasi langsung ke OpenAI.

## 🚀 Fitur Utama
- **OpenAI Integration**: Menghasilkan respon cerdas dan dinamis berkat dukungan model AI dari OpenAI.
- **File Uploads**: Mendukung pengunggahan dan pemrosesan file, parsing CSV, dll (menggunakan Multer & CSV Parser).
- **Database Integration**: Terintegrasi menggunakan `mysql2` untuk persistensi data percakapan/user.
- **Environment Terpusat**: Pengaturan keys (seperti OpenAI API Key) secara aman menggunakan `.env`.

## 🛠️ Teknologi yang Digunakan
- **Backend:** Node.js, Express.js
- **AI & ML:** OpenAI API, @xenova/transformers
- **Database:** MySQL (via `mysql2`)
- **Utilities:** Multer, CSV Parser, json2csv, bcryptjs, cors, dotenv

## 📦 Cara Instalasi & Menjalankan di Lokal

1. **Clone Repositori ini:**
   ```bash
   git clone https://github.com/RXCNF/VendorBotWK.git
   cd VendorBotWK
   ```

2. **Instal dependensi (Node.js):**
   ```bash
   npm install
   ```

3. **Konfigurasi Environment:**
   Buat file bernama `.env` di root direktori project, dan sesuaikan berdasarkan file `.env.example` (atau contoh berikut):
   ```env
   PORT=3000
   OPENAI_API_KEY=masukkan_api_key_openai_kamu_di_sini
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=vendorbot
   ```

4. **Jalankan Aplikasi:**
   - **Mode Produksi:**
     ```bash
     npm start
     ```
   - **Mode Development (Auto-reload):**
     ```bash
     npm run dev
     ```

## ⚙️ Skrip Tambahan
Project ini menyediakan beberapa PowerShell script (khusus sistem operasi Windows) untuk manajemen server:
- `npm run restart` : Menjalankan `restart-server.ps1`
- `npm run check` : Menjalankan `check-server.ps1`

## 📝 Lisensi
[MIT License](LICENSE)
