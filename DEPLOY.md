# Panduan Deployment VendorBot

Panduan lengkap untuk deploy dan hosting aplikasi VendorBot.

## 📋 Prerequisites

- Node.js 18+ terinstall
- Akun hosting platform (Vercel, Railway, Render, dll)
- API Key Maia Router
- File CSV untuk knowledge base

## 🚀 Platform Hosting yang Didukung

### 1. Vercel (Recommended)

Vercel sangat cocok untuk aplikasi full-stack dengan Node.js.

#### Setup:
1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Login ke Vercel:
   ```bash
   vercel login
   ```

3. Deploy:
   ```bash
   vercel
   ```

4. Set Environment Variables di Vercel Dashboard:
   - `MAIA_API_KEY`: API key Maia Router
   - `RAG_STORAGE_MODE`: `memory` (default) atau `tidb`
   - `QA_CSV_PATH`: `./vendor_qa_dataset.csv`
   - `CSV_FILE_PATH`: `./uploads/knowledge_base.csv`
   - (Opsional) TiDB credentials jika menggunakan TiDB

#### Catatan:
- Vercel akan otomatis detect `vercel.json`
- Serverless functions untuk API routes
- Static files untuk frontend

---

### 2. Railway

Railway sangat mudah untuk deploy Node.js apps.

#### Setup:
1. Buat akun di [railway.app](https://railway.app)
2. Klik "New Project" → "Deploy from GitHub repo"
3. Pilih repository Anda
4. Railway akan otomatis detect `package.json`

#### Environment Variables:
Set di Railway Dashboard → Variables:
- `MAIA_API_KEY`
- `RAG_STORAGE_MODE`
- `QA_CSV_PATH`
- `CSV_FILE_PATH`
- `PORT` (Railway akan set otomatis)

#### Catatan:
- Railway menggunakan port dari environment variable `PORT`
- File CSV perlu di-upload ke repository atau gunakan Railway volumes

---

### 3. Render

Render menyediakan free tier untuk Node.js apps.

#### Setup:
1. Buat akun di [render.com](https://render.com)
2. Klik "New" → "Web Service"
3. Connect GitHub repository
4. Settings:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: `Node`

#### Environment Variables:
Set di Render Dashboard → Environment:
- `MAIA_API_KEY`
- `RAG_STORAGE_MODE`
- `QA_CSV_PATH`
- `CSV_FILE_PATH`
- `PORT` (Render akan set otomatis)

---

### 4. DigitalOcean App Platform

#### Setup:
1. Buat akun di [DigitalOcean](https://www.digitalocean.com)
2. Create App → Connect GitHub
3. Pilih repository
4. Configure:
   - **Type**: Web Service
   - **Build Command**: `npm install`
   - **Run Command**: `npm start`

#### Environment Variables:
Set di App Settings → App-Level Environment Variables

---

### 5. Docker Deployment

Untuk deployment dengan Docker (VPS, AWS EC2, dll):

#### Build & Run:
```bash
# Build image
docker build -t vendorbot .

# Run container
docker run -d \
  -p 3000:3000 \
  -e MAIA_API_KEY=your_key \
  -e RAG_STORAGE_MODE=memory \
  -v $(pwd)/vendor_qa_dataset.csv:/app/vendor_qa_dataset.csv \
  -v $(pwd)/uploads:/app/uploads \
  --name vendorbot \
  vendorbot
```

---

## 📝 Environment Variables

Buat file `.env` atau set di hosting platform:

```env
# API Configuration
MAIA_API_KEY=your_maia_api_key_here

# RAG Configuration
RAG_STORAGE_MODE=memory
QA_CSV_PATH=./vendor_qa_dataset.csv
CSV_FILE_PATH=./uploads/knowledge_base.csv

# Server Configuration
PORT=3000

# TiDB Configuration (Opsional, hanya jika RAG_STORAGE_MODE=tidb)
# TIDB_HOST=your_tidb_host
# TIDB_PORT=4000
# TIDB_USER=your_tidb_user
# TIDB_PASSWORD=your_tidb_password
# TIDB_DATABASE=RAG
```

## 📁 File yang Perlu Di-Deploy

### Wajib:
- ✅ `package.json`
- ✅ `server.js`
- ✅ `index.html`
- ✅ `script.js`
- ✅ `config.js` (atau set di environment)
- ✅ `knowledgeBase.js`
- ✅ `ragVectorStore.js`
- ✅ `vendor_qa_dataset.csv`
- ✅ `assets/images/waskita-logo.png`

### Opsional:
- `example_vendor_data.csv`
- `uploads/knowledge_base.csv` (jika ada)

### Jangan Deploy:
- ❌ `node_modules/` (akan di-install otomatis)
- ❌ `.env` (gunakan environment variables di platform)
- ❌ `embeddings_store.json` (akan dibuat otomatis)
- ❌ `.git/`

## 🔧 Konfigurasi Server

### Update `server.js` untuk Production

Pastikan server.js menggunakan port dari environment variable:

```javascript
const PORT = process.env.PORT || 3000;
```

### Serve Static Files

Jika menggunakan platform yang tidak otomatis serve static files, tambahkan:

```javascript
app.use(express.static('public')); // atau path ke folder static files
```

## 🚨 Troubleshooting

### 1. Port Error
**Masalah**: `EADDRINUSE` atau port tidak tersedia
**Solusi**: Gunakan `process.env.PORT` dari hosting platform

### 2. Environment Variables Tidak Terbaca
**Masalah**: API key tidak ditemukan
**Solusi**: 
- Pastikan set di hosting platform dashboard
- Restart aplikasi setelah set environment variables

### 3. CSV File Tidak Ditemukan
**Masalah**: `File CSV tidak ditemukan`
**Solusi**:
- Pastikan file CSV ada di repository
- Atau gunakan absolute path
- Atau upload via hosting platform file system

### 4. RAG Embeddings Tidak Load
**Masalah**: Embeddings tidak ter-generate
**Solusi**:
- Pastikan `@xenova/transformers` ter-install
- Check log untuk error embedding generation
- Pastikan CSV file path benar

### 5. CORS Error
**Masalah**: CORS error di browser
**Solusi**:
- Pastikan `cors()` middleware sudah di-set
- Check allowed origins di hosting platform

## 📊 Monitoring & Logs

### Vercel:
- Dashboard → Functions → Logs

### Railway:
- Dashboard → Deployments → View Logs

### Render:
- Dashboard → Logs

## 🔒 Security Checklist

- [ ] Jangan commit `.env` file
- [ ] Gunakan environment variables untuk sensitive data
- [ ] Set CORS dengan domain yang tepat
- [ ] Gunakan HTTPS (otomatis di kebanyakan platform)
- [ ] Rate limiting untuk API endpoints
- [ ] Validasi input user

## 📈 Scaling

### Untuk Traffic Tinggi:
1. Gunakan TiDB untuk RAG storage (lebih scalable)
2. Implement caching untuk embeddings
3. Gunakan CDN untuk static files
4. Consider serverless functions untuk API

## 🆘 Support

Jika ada masalah saat deployment:
1. Check logs di hosting platform
2. Verify environment variables
3. Test local dengan `npm start`
4. Check file paths dan permissions

---

**Selamat Deploy! 🚀**

