# AI Chat Assistant

Website interaktif untuk berkomunikasi dengan AI menggunakan OpenAI API.

## Fitur

- 🎨 Design modern dengan color palette hitam dan putih
- 💬 Chat interface yang responsif dengan histori chat
- 🚀 Menggunakan Tailwind CSS via CDN
- 🔒 Penyimpanan API key di localStorage (untuk development)
- 📊 Knowledge Base dari CSV untuk data perusahaan
- 🔍 Pencarian data berbasis keyword dan semantic search
- 🤖 Integrasi RAG (Retrieval Augmented Generation) dengan GPT-4o-mini
- 📁 Upload dan manajemen file CSV
- 🔄 Auto-reload data CSV saat file diperbarui

## Cara Menggunakan

### ⚠️ PENTING: Masalah CORS
Browser memblokir request langsung ke OpenAI API karena kebijakan CORS. Oleh karena itu, Anda **harus menjalankan server proxy** terlebih dahulu.

### Langkah-langkah:

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Setup Environment Variable**
   - Buat file `.env` di root project
   - Salin isi dari `env.example` ke `.env`
   - Masukkan API Key OpenAI Anda:
     ```
     OPENAI_API_KEY=sk-your-api-key-here
     ```
   - Atau edit `config.js` dan masukkan API key di `OPENAI_API_KEY`

3. **Jalankan Server Proxy**
   ```bash
   npm start
   ```
   Server akan berjalan di `http://localhost:3000`

4. **Buka Website**
   - Buka file `index.html` di browser Anda
   - Atau gunakan live server jika Anda menggunakan VS Code
   - Pastikan server proxy masih berjalan di terminal

5. **Menggunakan Chat**
   - Ketik pesan Anda di input box
   - Tekan Enter atau klik tombol "Kirim"
   - AI akan merespons pesan Anda

## Catatan Keamanan

⚠️ **PENTING**: Aplikasi ini menyimpan API key di localStorage browser, yang berarti:
- API key terlihat di browser developer tools
- Hanya untuk penggunaan development/pribadi
- **JANGAN** gunakan untuk production tanpa backend yang aman

Untuk production, sebaiknya:
- Buat backend server untuk menangani API calls
- Simpan API key di environment variables server
- Jangan expose API key ke client-side

## Struktur File

```
.
├── index.html              # File HTML utama
├── script.js               # JavaScript untuk handling chat dan API calls
├── config.js               # File konfigurasi untuk API key (edit file ini)
├── config.example.js       # Template untuk config.js
├── server.js               # Server proxy untuk menghindari CORS
├── knowledgeBase.js        # Module untuk memproses dan mencari data CSV
├── package.json            # Dependencies Node.js
├── .env                    # Environment variables (buat file ini)
├── env.example             # Template untuk .env
├── uploads/                # Folder untuk menyimpan file CSV yang diupload
├── example_vendor_data.csv # Contoh file CSV untuk testing
└── README.md               # Dokumentasi
```

## Konfigurasi

Edit file `config.js` dan masukkan API Key OpenAI Anda:

```javascript
const CONFIG = {
    OPENAI_API_KEY: 'sk-your-api-key-here',
    MODEL: 'gpt-3.5-turbo',        // Opsional
    TEMPERATURE: 0.7,              // Opsional
    MAX_TOKENS: 1000              // Opsional
};
```

## Teknologi

- HTML5
- Tailwind CSS (via CDN)
- Vanilla JavaScript
- Node.js + Express (Server Proxy)
- OpenAI API (via Maia Router)
- CSV Parser untuk knowledge base
- RAG (Retrieval Augmented Generation)

## RAG (Retrieval Augmented Generation) dengan Vector Embeddings

VendorBot menggunakan sistem RAG dengan vector embeddings untuk memberikan jawaban yang lebih akurat dan relevan.

### Teknologi RAG

- **Embedding Model**: BAAI/bge-m3 (via Xenova Transformers)
- **Storage Mode**: 
  - **In-Memory** (default): Embeddings disimpan di memory dan file JSON lokal
  - **TiDB** (opsional): Embeddings disimpan di TiDB database
- **Similarity Search**: Cosine similarity
- **Q&A Dataset**: CSV dengan pertanyaan dan jawaban seputar vendor

### Knowledge Base dari CSV

VendorBot dapat menggunakan data dari file CSV sebagai knowledge base untuk menjawab pertanyaan dengan lebih akurat.

### Cara Menggunakan Knowledge Base

1. **Upload CSV File**
   - Klik tombol "Upload CSV" di sidebar
   - Pilih file CSV yang berisi data perusahaan/vendor
   - File akan diproses dan dimuat ke memory

2. **Format CSV**
   - File CSV harus memiliki header di baris pertama
   - Setiap kolom mewakili atribut data (contoh: Nama Vendor, Kategori, Alamat, dll)
   - Lihat `example_vendor_data.csv` untuk contoh format

3. **Pencarian Data**
   - Chatbot akan otomatis mencari data relevan dari CSV berdasarkan pertanyaan
   - Data yang relevan akan diintegrasikan ke dalam konteks untuk GPT
   - Jawaban akan berbasis pada data yang ada di CSV

4. **Auto-Reload**
   - Sistem akan otomatis memeriksa perubahan file CSV setiap 30 detik
   - Jika file diperbarui, data akan otomatis di-reload

### Fitur RAG & Knowledge Base

- ✅ Vector embeddings menggunakan BAAI/bge-m3
- ✅ Semantic search dengan cosine similarity
- ✅ Penyimpanan embeddings (In-Memory atau TiDB)
- ✅ Q&A dataset dengan pertanyaan dan jawaban
- ✅ Pencarian berbasis keyword (fallback)
- ✅ Filter data berdasarkan kolom
- ✅ Integrasi otomatis ke konteks GPT
- ✅ Auto-reload saat file berubah
- ✅ Validasi dan error handling
- ✅ Tidak perlu database eksternal (mode in-memory)

### Setup RAG

#### Mode In-Memory (Default - Tidak Perlu Database)

Mode ini tidak memerlukan database eksternal. Embeddings disimpan di memory dan file JSON lokal (`embeddings_store.json`).

1. **Setup Environment Variables** di `.env`:
   ```
   RAG_STORAGE_MODE=memory
   QA_CSV_PATH=./vendor_qa_dataset.csv
   ```

2. **File Q&A Dataset**:
   - File `vendor_qa_dataset.csv` sudah disediakan
   - Berisi pertanyaan dan jawaban seputar vendor Waskita
   - Format: `Pertanyaan,Jawaban`

3. **Auto-load saat server start**:
   - Server akan otomatis load Q&A dataset
   - Generate embeddings untuk setiap pertanyaan
   - Store embeddings di memory dan file JSON

4. **Vector Search**:
   - Saat user bertanya, sistem akan:
     1. Generate embedding untuk query
     2. Search di memory menggunakan cosine similarity
     3. Ambil top-k hasil yang paling relevan
     4. Kirim ke GPT dengan context yang relevan

#### Mode TiDB (Opsional)

Jika ingin menggunakan TiDB untuk penyimpanan embeddings:

1. **Setup Environment Variables** di `.env`:
   ```
   RAG_STORAGE_MODE=tidb
   TIDB_HOST=gateway01.eu-central-1.prod.aws.tidbcloud.com
   TIDB_PORT=4000
   TIDB_USER=your_tidb_user
   TIDB_PASSWORD=your_tidb_password
   TIDB_DATABASE=RAG
   QA_CSV_PATH=./vendor_qa_dataset.csv
   ```

2. **Auto-load saat server start**:
   - Server akan otomatis connect ke TiDB
   - Load Q&A dataset ke TiDB
   - Generate embeddings untuk setiap pertanyaan
   - Store embeddings di database

3. **Fallback ke In-Memory**:
   - Jika TiDB tidak tersedia, sistem otomatis switch ke mode in-memory

## 🚀 Deployment

Aplikasi ini dapat di-deploy ke berbagai platform hosting. Lihat [DEPLOY.md](./DEPLOY.md) untuk panduan lengkap.

### Platform yang Didukung:
- ✅ **Vercel** (Recommended) - Full-stack deployment
- ✅ **Railway** - Easy Node.js deployment
- ✅ **Render** - Free tier available
- ✅ **DigitalOcean App Platform**
- ✅ **Docker** - VPS, AWS EC2, dll

### Quick Deploy:

**Vercel:**
```bash
npm i -g vercel
vercel
```

**Railway:**
1. Connect GitHub repo
2. Railway auto-detects and deploys

**Docker:**
```bash
docker build -t vendorbot .
docker run -p 3000:3000 -e MAIA_API_KEY=your_key vendorbot
```

Lihat [DEPLOY.md](./DEPLOY.md) untuk detail lengkap.

## Lisensi

MIT License

