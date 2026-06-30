# Proses RAG (Retrieval Augmented Generation) di VendorBot

Dokumentasi lengkap tentang bagaimana sistem RAG bekerja di VendorBot.

## 📋 Daftar Isi

1. [Fase Inisialisasi (Server Start)](#fase-inisialisasi)
2. [Fase Query Processing (User Bertanya)](#fase-query-processing)
3. [Fase Response Generation](#fase-response-generation)
4. [Diagram Alur](#diagram-alur)

---

## 🔄 Fase Inisialisasi (Server Start)

Saat server pertama kali dijalankan (`npm start`), sistem RAG melakukan inisialisasi:

### 1. Load Embedding Model
```javascript
// File: ragVectorStore.js
initEmbedder()
```
- **Model**: `Xenova/bge-m3` (BAAI/bge-m3 via Xenova Transformers)
- **Tujuan**: Model untuk mengubah teks menjadi vector embeddings
- **Output**: Model siap digunakan untuk generate embeddings

### 2. Setup Storage Mode
```javascript
// File: ragVectorStore.js
STORAGE_MODE = process.env.RAG_STORAGE_MODE || 'memory'
```

**Mode In-Memory (Default)**:
- Load embeddings dari file `embeddings_store.json` jika ada
- Siapkan array `inMemoryStore` untuk menyimpan embeddings

**Mode TiDB (Opsional)**:
- Connect ke TiDB database
- Create table `vendor_embeddings` jika belum ada
- Jika gagal, fallback ke in-memory mode

### 3. Load Q&A Dataset dari CSV
```javascript
// File: ragVectorStore.js
loadQAFromCSV(csvPath)
```

**Proses**:
1. Baca file `vendor_qa_dataset.csv`
2. Parse setiap baris (Pertanyaan, Jawaban)
3. Untuk setiap Q&A pair:
   - Generate embedding untuk **pertanyaan** menggunakan model BAAI/bge-m3
   - Simpan ke storage:
     - **In-Memory**: Simpan ke array `inMemoryStore` + file JSON
     - **TiDB**: Insert ke database dengan embedding sebagai JSON
4. Log jumlah Q&A yang berhasil di-load

**Output**: 
- Embeddings tersimpan dan siap untuk vector search
- File `embeddings_store.json` ter-update (untuk mode in-memory)

### 4. Load Knowledge Base CSV (Fallback)
```javascript
// File: knowledgeBase.js
loadCSV(filePath)
```
- Load file CSV vendor data (contoh: `example_vendor_data.csv`)
- Simpan ke memory untuk keyword search (fallback jika vector search tidak menemukan hasil)

---

## 🔍 Fase Query Processing (User Bertanya)

Saat user mengirim pesan melalui chat interface:

### 1. User Input
```javascript
// File: script.js
sendMessage(message)
```
- User mengetik pertanyaan di chat interface
- Frontend mengirim POST request ke `/api/chat`

### 2. Server Menerima Request
```javascript
// File: server.js
app.post('/api/chat', async (req, res) => {
    const { message } = req.body;
    // ...
})
```

### 3. RAG Vector Search (Prioritas Utama)

#### 3.1 Generate Query Embedding
```javascript
// File: ragVectorStore.js
generateEmbedding(query)
```
- **Input**: Query user (contoh: "CV Mandiri Jaya")
- **Proses**: 
  - Gunakan model BAAI/bge-m3 untuk generate embedding
  - Output: Vector array (contoh: 1024 dimensi)
- **Output**: Query embedding vector

#### 3.2 Vector Similarity Search
```javascript
// File: ragVectorStore.js
vectorSearch(query, limit = 5)
```

**Proses**:
1. **Ambil semua embeddings dari storage**:
   - **In-Memory**: Ambil dari `inMemoryStore`
   - **TiDB**: Query database `SELECT * FROM vendor_embeddings`

2. **Hitung Cosine Similarity**:
   ```javascript
   cosineSimilarity(queryEmbedding, storedEmbedding)
   ```
   - Bandingkan query embedding dengan setiap stored embedding
   - Hitung similarity score (0-1, semakin tinggi semakin relevan)

3. **Ranking & Filter**:
   - Sort berdasarkan similarity score (tertinggi ke terendah)
   - Ambil top 5 hasil
   - Filter hasil dengan similarity > 0.3 (threshold relevansi)

4. **Output**: Array hasil dengan format:
   ```javascript
   [
       {
           id: 1,
           question: "Apa produk dari CV Mandiri Jaya?",
           answer: "CV Mandiri Jaya menyediakan Kabel Listrik...",
           similarity: 0.89
       },
       // ...
   ]
   ```

#### 3.3 Format Context untuk GPT
```javascript
// File: ragVectorStore.js
getRelevantContext(query, maxResults = 3)
```

**Proses**:
- Ambil top 3 hasil dari vector search
- Format menjadi context string:
  ```
  Berikut adalah informasi relevan dari knowledge base:

  [Informasi 1]
  Pertanyaan: Apa produk dari CV Mandiri Jaya?
  Jawaban: CV Mandiri Jaya menyediakan Kabel Listrik...
  (Relevansi: 89.0%)

  [Informasi 2]
  ...
  ```

### 4. Fallback: Knowledge Base Keyword Search

Jika RAG Vector Store tidak tersedia atau tidak menemukan hasil:

```javascript
// File: knowledgeBase.js
getRelevantContext(query, maxRows = 10)
```

**Proses**:
1. **Keyword Search**:
   - Split query menjadi keywords
   - Cari di semua kolom CSV (Nama Vendor, Kategori, Alamat, dll)
   - Score berdasarkan jumlah keyword yang match
   - Bonus score jika match di kolom "Nama Vendor"

2. **Format Data**:
   - Ambil top 10 hasil
   - Format menjadi narrative text untuk context

### 5. Build System Prompt

```javascript
// File: server.js
let systemPrompt = `Anda adalah VendorBot...`;
```

**Proses**:
1. **Base System Prompt**:
   - Instruksi untuk AI tentang peran dan format jawaban
   - Format: paragraf natural, boleh markdown bold, tidak boleh bullet points

2. **Tambahkan RAG Context** (jika ada):
   ```javascript
   if (ragContext) {
       systemPrompt += `\n\n${ragContext}\n\nPERINGATAN KRITIS: ...`;
   }
   ```

3. **Tambahkan Knowledge Base Context** (jika RAG tidak ada):
   ```javascript
   if (!ragContext && contextData) {
       systemPrompt += `\n\n${formattedContext}\n\nPERINGATAN KRITIS: ...`;
   }
   ```

4. **Tambahkan Instruksi Eksplisit**:
   - "Data di atas adalah SUMBER KEBENARAN TUNGGAL"
   - "JANGAN katakan tidak memiliki informasi jika data ada"
   - "Berikan informasi LENGKAP dalam bentuk paragraf natural"

### 6. Build User Message

```javascript
// File: server.js
let userMessage = message;
if (ragContext || contextData) {
    userMessage = `${message}\n\nPENTING: Informasi vendor sudah disediakan...`;
}
```

**Tujuan**: Memperkuat instruksi untuk AI agar menggunakan context yang sudah disediakan.

---

## 💬 Fase Response Generation

### 1. Kirim ke GPT API

```javascript
// File: server.js
const completion = await openai.chat.completions.create({
    model: 'openai/gpt-5-mini',
    messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
    ],
    temperature: 0.7,
    max_completion_tokens: 2048
});
```

**Request Structure**:
- **System Message**: Berisi instruksi + RAG context
- **User Message**: Pertanyaan user + instruksi tambahan

### 2. GPT Memproses

**Proses Internal GPT**:
1. Baca system prompt (termasuk RAG context)
2. Pahami instruksi format jawaban
3. Identifikasi informasi relevan dari RAG context
4. Generate jawaban berdasarkan:
   - RAG context (prioritas utama)
   - Instruksi format (paragraf natural, markdown bold)
   - Knowledge base data (jika ada)

### 3. Response ke Frontend

```javascript
// File: server.js
res.json(completion);
```

**Response Format**:
```json
{
    "choices": [{
        "message": {
            "role": "assistant",
            "content": "CV Mandiri Jaya adalah vendor di kategori Elektrikal yang berlokasi di Bandung. Mereka menyediakan produk **Kabel Listrik**..."
        }
    }]
}
```

### 4. Frontend Render

```javascript
// File: script.js
const content = data.choices[0].message.content;
addMessage(content, false); // false = AI message
```

**Proses**:
- Render markdown bold (`**text**` → **text**)
- Tampilkan di chat interface
- Simpan ke chat history

---

## 📊 Diagram Alur

```
┌─────────────────────────────────────────────────────────────┐
│                    SERVER START                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │  1. Load Embedding Model          │
        │     (BAAI/bge-m3)                 │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │  2. Setup Storage                  │
        │     - In-Memory (default)          │
        │     - TiDB (optional)              │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │  3. Load Q&A Dataset CSV          │
        │     - Parse CSV                    │
        │     - Generate Embeddings          │
        │     - Store Embeddings             │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │  4. Load Knowledge Base CSV       │
        │     (Fallback)                     │
        └───────────────────────────────────┘
                            │
                            ▼
                    ✅ RAG READY


┌─────────────────────────────────────────────────────────────┐
│                    USER QUERY                               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │  1. Generate Query Embedding       │
        │     (BAAI/bge-m3)                  │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │  2. Vector Search                 │
        │     - Cosine Similarity           │
        │     - Ranking & Filter            │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │  3. Format RAG Context            │
        │     (Top 3 results)               │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │  4. Build System Prompt           │
        │     - Base instructions            │
        │     - RAG context                 │
        │     - Critical warnings            │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │  5. Send to GPT API               │
        │     (openai/gpt-5-mini)          │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │  6. GPT Generates Response        │
        │     - Use RAG context             │
        │     - Natural paragraph format    │
        │     - Markdown bold for labels    │
        └───────────────────────────────────┘
                            │
                            ▼
                    ✅ RESPONSE TO USER
```

---

## 🔑 Komponen Utama

### 1. **Embedding Model** (BAAI/bge-m3)
- **Fungsi**: Convert text → vector embeddings
- **Library**: `@xenova/transformers`
- **Dimensi**: ~1024 dimensi per embedding

### 2. **Vector Store**
- **In-Memory**: Array + JSON file
- **TiDB**: Database table dengan JSON column
- **Fungsi**: Menyimpan Q&A + embeddings

### 3. **Similarity Search**
- **Algoritma**: Cosine Similarity
- **Threshold**: 0.3 (minimum relevansi)
- **Top-K**: 5 hasil terbaik

### 4. **Knowledge Base** (Fallback)
- **Method**: Keyword search
- **Scoring**: Keyword matching + column bonus
- **Format**: Narrative text

### 5. **System Prompt Engineering**
- **Base**: Instruksi peran dan format
- **Context**: RAG results atau knowledge base
- **Warnings**: Instruksi kritis untuk AI

---

## 📝 Contoh Proses Lengkap

### Input User:
```
"Siapa CV Mandiri Jaya?"
```

### Proses:

1. **Generate Query Embedding**:
   ```
   Query: "Siapa CV Mandiri Jaya?"
   → Embedding: [0.12, -0.45, 0.78, ...] (1024 dimensi)
   ```

2. **Vector Search**:
   ```
   Compare dengan semua stored embeddings
   → Found: "Apa produk dari CV Mandiri Jaya?" (similarity: 0.89)
   → Found: "Informasi kontak CV Mandiri Jaya?" (similarity: 0.76)
   → Found: "Dimana lokasi CV Mandiri Jaya?" (similarity: 0.71)
   ```

3. **Format Context**:
   ```
   [Informasi 1]
   Pertanyaan: Apa produk dari CV Mandiri Jaya?
   Jawaban: CV Mandiri Jaya menyediakan Kabel Listrik. Mereka adalah vendor Elektrikal di Bandung.
   (Relevansi: 89.0%)
   ...
   ```

4. **System Prompt**:
   ```
   Anda adalah VendorBot...
   
   [Informasi 1]
   Pertanyaan: Apa produk dari CV Mandiri Jaya?
   Jawaban: CV Mandiri Jaya menyediakan Kabel Listrik...
   
   PERINGATAN KRITIS:
   - Data di atas adalah SUMBER KEBENARAN TUNGGAL
   - JANGAN katakan tidak memiliki informasi jika data ada
   ...
   ```

5. **GPT Response**:
   ```
   CV Mandiri Jaya adalah vendor di kategori **Elektrikal** yang berlokasi di **Bandung**. 
   Mereka menyediakan produk **Kabel Listrik**. Untuk informasi lebih lanjut, 
   Anda dapat menghubungi mereka melalui kontak yang tersedia.
   ```

---

## 🎯 Keuntungan RAG

1. **Akurasi Tinggi**: Jawaban berdasarkan data yang sudah diverifikasi
2. **Relevansi**: Vector search menemukan konteks yang paling relevan
3. **Konsistensi**: AI selalu menggunakan sumber data yang sama
4. **Efisiensi**: Tidak perlu fine-tuning model, cukup update dataset
5. **Scalability**: Mudah menambah Q&A baru ke dataset

---

## 🔧 Troubleshooting

### RAG tidak bekerja?
1. Check apakah embedding model sudah loaded
2. Check apakah Q&A dataset sudah di-load
3. Check similarity threshold (mungkin terlalu tinggi)
4. Check storage mode (in-memory atau TiDB)

### Jawaban tidak akurat?
1. Check apakah Q&A dataset sudah lengkap
2. Check similarity score (mungkin perlu adjust threshold)
3. Check system prompt (mungkin perlu diperkuat)
4. Check apakah knowledge base fallback bekerja

### Performance lambat?
1. Reduce top-k results (dari 5 ke 3)
2. Use TiDB untuk dataset besar (lebih efisien)
3. Cache embeddings yang sering digunakan
4. Optimize similarity calculation

---

**Dokumen ini menjelaskan proses RAG secara lengkap. Untuk pertanyaan lebih lanjut, lihat kode di `ragVectorStore.js`, `knowledgeBase.js`, dan `server.js`.**

