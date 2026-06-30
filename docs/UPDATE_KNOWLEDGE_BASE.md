# Update Knowledge Base - Data Vendor 051225

## ✅ Perubahan yang Telah Dilakukan

### 1. **Knowledge Base CSV Baru**
- File `Data Vendor 051225.csv` (1,042,978 baris) telah di-copy ke `uploads/knowledge_base.csv`
- Struktur kolom baru:
  - `KUALIFIKASI PERUSAHAAN`
  - `NAMA VENDOR`
  - `STATUS REKANAN`
  - `BIDANG USAHA`
  - `CQSMS VENDOR`
  - `PROVINSI`
  - `INDUSTRY KEY`
  - `KODE SUBKLASIFIKASI SBU`

### 2. **Q&A Dataset Generated**
- Script `generateQADataset.js` telah dibuat dan dijalankan
- File `uploads/vendor_qa_dataset.csv` berhasil dibuat (2,654 Q&A pairs)
- Setiap vendor menghasilkan 8-9 pertanyaan dan jawaban otomatis

### 3. **Update Knowledge Base Module** (`knowledgeBase.js`)
- ✅ Support kolom baru (NAMA VENDOR, STATUS REKANAN, dll)
- ✅ Fallback ke kolom lama untuk kompatibilitas
- ✅ Format data untuk context yang lebih natural
- ✅ Pencarian keyword yang lebih baik

### 4. **Update RAG Vector Store** (`ragVectorStore.js`)
- ✅ Batch processing untuk handle data besar (100 Q&A per batch)
- ✅ Progress logging setiap 50 items
- ✅ Sequential processing dalam batch untuk menghindari overwhelming tokenizer
- ✅ Auto-save embeddings setelah setiap batch
- ✅ Path detection untuk Q&A dataset (uploads/vendor_qa_dataset.csv)

### 5. **Update Server** (`server.js`)
- ✅ Path detection untuk knowledge base baru
- ✅ System prompt updated dengan label kolom baru
- ✅ Support untuk kolom baru dan lama

## 🚀 Cara Menggunakan

### 1. Generate Q&A Dataset (Jika Perlu Regenerate)
```bash
node generateQADataset.js
```

Script ini akan:
- Membaca `uploads/knowledge_base.csv`
- Generate Q&A pairs untuk setiap vendor
- Menyimpan ke `uploads/vendor_qa_dataset.csv`

### 2. Start Server
```bash
npm start
```

Server akan:
- Load knowledge base dari `uploads/knowledge_base.csv`
- Initialize RAG Vector Store
- Load Q&A dataset dari `uploads/vendor_qa_dataset.csv`
- Generate embeddings dengan batch processing

### 3. Proses Embedding Generation

**Penting**: Untuk data besar (2,654 Q&A pairs), proses embedding generation akan memakan waktu:
- **Estimasi waktu**: ~30-60 menit (tergantung hardware)
- **Progress**: Akan ditampilkan setiap 50 items
- **Batch size**: 100 Q&A per batch
- **Storage**: In-memory dengan auto-save ke `embeddings_store.json`

**Catatan**: 
- Embeddings hanya di-generate sekali untuk Q&A baru
- Q&A yang sudah ada akan di-skip
- File `embeddings_store.json` akan otomatis dibuat/disimpan

## 📊 Struktur Data

### Knowledge Base CSV
- **File**: `uploads/knowledge_base.csv`
- **Total rows**: ~1,042,978 vendor
- **Format**: CSV dengan header kolom baru

### Q&A Dataset CSV
- **File**: `uploads/vendor_qa_dataset.csv`
- **Total Q&A pairs**: 2,654
- **Format**: CSV dengan kolom `Pertanyaan` dan `Jawaban`
- **Generated from**: Knowledge base CSV

### Embeddings Store
- **File**: `embeddings_store.json` (auto-generated)
- **Format**: JSON array dengan structure:
  ```json
  [
    {
      "question": "Siapa KARYA WARANI?",
      "answer": "KARYA WARANI adalah vendor...",
      "embedding": [0.123, 0.456, ...]
    }
  ]
  ```

## 🔍 Testing

### Test Knowledge Base Search
1. Start server: `npm start`
2. Tunggu knowledge base loaded
3. Test query di chat: "Cari vendor KARYA WARANI"

### Test RAG Vector Store
1. Tunggu RAG initialization selesai (embedding generation)
2. Test query: "Siapa KARYA WARANI?"
3. System akan menggunakan vector similarity search

## ⚙️ Optimasi untuk Data Besar

### Batch Processing
- **Q&A Generation**: 1000 vendors per batch
- **Embedding Generation**: 100 Q&A per batch
- **Progress Logging**: Setiap 50 items

### Memory Management
- Streaming CSV reading (tidak load semua ke memory)
- Batch processing untuk embeddings
- Auto-save setelah setiap batch

### Tokenizer
- Menggunakan `Xenova/bge-m3` (optimized untuk browser/Node.js)
- Sequential processing dalam batch untuk menghindari overwhelming
- Error handling per item (jika satu gagal, yang lain tetap lanjut)

## 📝 Catatan Penting

1. **First Run**: Embedding generation akan memakan waktu lama (~30-60 menit)
2. **Subsequent Runs**: Hanya Q&A baru yang akan di-process
3. **Storage Mode**: Default menggunakan in-memory storage
4. **TiDB Mode**: Bisa diaktifkan dengan set `RAG_STORAGE_MODE=tidb` di `.env`

## 🐛 Troubleshooting

### Error: "File CSV tidak ditemukan"
- Pastikan `uploads/knowledge_base.csv` ada
- Atau set `CSV_FILE_PATH` di `.env`

### Error: "Q&A CSV not found"
- Jalankan `node generateQADataset.js` untuk generate Q&A dataset
- Atau set `QA_CSV_PATH` di `.env`

### Embedding Generation Lambat
- Normal untuk data besar
- Progress akan ditampilkan setiap 50 items
- Pastikan tidak ada error di console

### Memory Issues
- Kurangi `BATCH_SIZE` di `ragVectorStore.js` (default: 100)
- Atau gunakan TiDB storage mode

