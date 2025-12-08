// Server Proxy untuk Maia API
// Maia adalah platform pembayaran untuk akses OpenAI API
// Menjalankan server ini untuk menghindari masalah CORS

const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Import Knowledge Base module
const knowledgeBase = require('./knowledgeBase');

// Import RAG Vector Store module
const ragVectorStore = require('./ragVectorStore');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files (for production)
app.use(express.static(__dirname));

// Knowledge base akan di-load otomatis dari file CSV
// Tidak perlu multer untuk upload karena file dihandle di backend

// Inisialisasi OpenAI client dengan base_url Maia Router
const getOpenAIClient = (apiKey) => {
    if (!apiKey || !apiKey.trim()) {
        throw new Error('API key is required');
    }
    
    return new OpenAI({
        apiKey: apiKey.trim(),
        baseURL: 'https://api.maiarouter.ai/v1'
    });
};

// Endpoint proxy untuk Maia API
app.post('/api/chat', async (req, res) => {
    try {
        const { message, model, temperature, max_tokens } = req.body;
        
        console.log('📨 Request received:', { 
            model, 
            hasMessage: !!message,
            messageLength: message?.length 
        });
        
        // Ambil API key dari environment variable atau request body
        const apiKey = process.env.MAIA_API_KEY || req.body.apiKey;
        
        console.log('🔑 API Key check:', {
            hasEnvKey: !!process.env.MAIA_API_KEY,
            hasBodyKey: !!req.body.apiKey,
            keyLength: apiKey ? apiKey.length : 0,
            keyPrefix: apiKey ? apiKey.substring(0, 7) + '...' : 'none'
        });
        
        if (!apiKey) {
            console.error('❌ API Key tidak ditemukan');
            return res.status(400).json({ 
                error: {
                    message: 'API Key tidak ditemukan. Pastikan MAIA_API_KEY ada di .env atau dikirim melalui request.'
                }
            });
        }
        
        // Pastikan API key tidak kosong atau hanya whitespace
        if (!apiKey.trim()) {
            console.error('❌ API Key kosong');
            return res.status(400).json({ 
                error: {
                    message: 'API Key tidak valid (kosong).'
                }
            });
        }

        // Ambil parameter tambahan dari request
        const { top_p, frequency_penalty, presence_penalty, max_completion_tokens } = req.body;

        // Inisialisasi OpenAI client dengan Maia Router base URL
        // Pastikan API key digunakan dengan benar
        const openai = getOpenAIClient(apiKey.trim());
        
        console.log('✅ OpenAI client initialized with baseURL:', 'https://api.maiarouter.ai/v1');

        // Kirim request menggunakan OpenAI library
        console.log('🚀 Sending request to Maia Router API...');
        
        // Ambil konteks relevan dari RAG Vector Store (prioritas) atau knowledge base
        let contextData = null;
        let ragContext = null;
        let systemPrompt = `Anda adalah VendorBot, asisten AI untuk pencarian vendor Waskita. Jawablah dalam bahasa Indonesia dengan ramah dan profesional seperti percakapan sehari-hari.

FORMAT JAWABAN PENTING:
- Jawablah dalam bentuk paragraf yang mengalir alami, seperti berbicara langsung dengan pengguna
- BOLEH menggunakan markdown bold (**text**) untuk menekankan kata atau frasa penting, seperti **Website Resmi**, **Email**, **Telepon**, dll
- JANGAN gunakan bullet points, list dengan tanda bintang untuk list item, garis pemisah (---), atau format list terstruktur
- JANGAN gunakan tabel atau format terstruktur lainnya
- Jawaban harus langsung ke intinya, natural, dan mudah dipahami
- Gunakan nada percakapan yang sederhana dan lugas, seperti percakapan sehari-hari
- Hindari format yang terlihat robotik atau terlalu terstruktur
- Gunakan **bold** hanya untuk menekankan informasi penting seperti label (Website, Email, Telepon, dll), bukan untuk membuat list

INSTRUKSI KONTEN YANG SANGAT PENTING:
- Data dari knowledge base di bawah adalah SUMBER KEBENARAN TUNGGAL Anda
- Anda HARUS menggunakan data tersebut untuk menjawab SEMUA pertanyaan tentang vendor
- JANGAN PERNAH mengatakan "saya tidak memiliki informasi" atau "data tidak tersedia" jika data tersebut ada di knowledge base
- JANGAN membuat asumsi atau informasi yang tidak ada dalam knowledge base
- Jika user bertanya tentang vendor tertentu, CARI di data knowledge base dan berikan informasi LENGKAP dari data tersebut
- Jika data ditemukan di knowledge base, jawablah dengan informasi lengkap dari data tersebut
- Hanya katakan "informasi tidak tersedia" jika BENAR-BENAR tidak ada di knowledge base setelah Anda mencari dengan teliti
- Sampaikan informasi dengan jelas dalam paragraf yang natural, tanpa elemen visual yang tidak perlu`;
        
        // Prioritaskan RAG Vector Store jika tersedia
        if (ragVectorStore.isReady()) {
            try {
                ragContext = await ragVectorStore.getRelevantContext(message, 3);
                if (ragContext) {
                    systemPrompt += `\n\n${ragContext}\n\nPERINGATAN KRITIS: 
- Informasi di atas adalah SUMBER KEBENARAN TUNGGAL Anda dari knowledge base dengan relevansi tinggi.
- Gunakan informasi tersebut untuk menjawab pertanyaan user dengan lengkap dan akurat.
- JANGAN mengatakan bahwa Anda tidak memiliki informasi jika informasi tersebut ada di atas.
- Berikan jawaban dalam bentuk paragraf natural yang mengalir, bukan list atau format terstruktur.
- Gunakan markdown bold (**text**) untuk label penting seperti **Nama Vendor**, **Kategori**, **Alamat**, **Telepon**, **Email**, **Produk**, **Status**, **Harga Minimum**.`;
                    
                    console.log('🔍 RAG Vector Store context found');
                }
            } catch (error) {
                console.error('❌ Error getting RAG context:', error.message);
            }
        }
        
        // Fallback ke knowledge base CSV jika RAG tidak tersedia atau tidak menemukan hasil
        if (!ragContext && knowledgeBase.hasData()) {
            contextData = knowledgeBase.getRelevantContext(message, 10);
            const formattedContext = knowledgeBase.formatDataForContext(contextData);
            
            if (formattedContext) {
                systemPrompt += `\n\n${formattedContext}\n\nPERINGATAN KRITIS: 
- Data di atas adalah SUMBER KEBENARAN TUNGGAL Anda. Data tersebut BENAR dan AKURAT.
- Jika user bertanya tentang vendor yang disebutkan dalam data di atas, Anda HARUS memberikan informasi lengkap dari data tersebut.
- JANGAN mengatakan bahwa Anda tidak memiliki informasi jika vendor tersebut ada di data di atas.
- CARI dengan teliti di data di atas sebelum mengatakan informasi tidak tersedia.
- Berikan informasi lengkap dalam bentuk paragraf natural yang mengalir, bukan list atau format terstruktur.
- Gunakan markdown bold (**text**) untuk label penting seperti **Nama Vendor**, **Kategori**, **Alamat**, **Telepon**, **Email**, **Produk**, **Status**, **Harga Minimum**.`;
                
                console.log('📊 Knowledge base context:', {
                    query: message,
                    rowsFound: contextData.length,
                    hasData: true,
                    sampleVendors: contextData.slice(0, 3).map(r => r['Nama Vendor'] || 'N/A')
                });
            } else {
                systemPrompt += '\n\nCatatan: Knowledge base ada tapi tidak ada data yang relevan ditemukan.';
            }
        } else if (!ragContext && !knowledgeBase.hasData()) {
            systemPrompt += '\n\nCatatan: Knowledge base belum dimuat. Pastikan file CSV sudah ada di folder uploads/knowledge_base.csv';
            console.log('⚠️  Knowledge base tidak dimuat');
        }
        
        // Jika ada RAG atau knowledge base, tambahkan instruksi eksplisit di user message juga
        let userMessage = message;
        if (ragContext || (knowledgeBase.hasData() && contextData && contextData.length > 0)) {
            userMessage = `${message}\n\nPENTING: Informasi vendor sudah disediakan di system prompt dengan relevansi tinggi. CARI vendor atau informasi yang disebutkan dalam pertanyaan di data tersebut. Jika ditemukan, berikan informasi LENGKAP dari data tersebut dalam bentuk paragraf natural. JANGAN katakan bahwa Anda tidak memiliki informasi jika data tersebut ada. Jawablah dalam bentuk paragraf yang mengalir, gunakan markdown bold (**text**) untuk label penting, tapi JANGAN gunakan bullet points atau format list.`;
        }
        
        // Siapkan parameter request
        const requestParams = {
            model: model || 'openai/gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: systemPrompt
                },
                {
                    role: 'user',
                    content: userMessage
                }
            ],
            temperature: temperature || 0.7,
            top_p: top_p !== undefined ? top_p : 1,
            frequency_penalty: frequency_penalty !== undefined ? frequency_penalty : 0,
            presence_penalty: presence_penalty !== undefined ? presence_penalty : 0
        };
        
        // Gunakan max_completion_tokens jika ada, jika tidak gunakan max_tokens
        if (max_completion_tokens) {
            requestParams.max_completion_tokens = max_completion_tokens;
        } else if (max_tokens) {
            requestParams.max_tokens = max_tokens;
        } else {
            requestParams.max_completion_tokens = 2048;
        }
        
        const completion = await openai.chat.completions.create(requestParams);

        console.log('✅ Response received successfully');
        res.json(completion);
    } catch (error) {
        console.error('Error details:', {
            message: error.message,
            status: error.status,
            response: error.response,
            error: error.error
        });
        
        // Handle error dari OpenAI library
        // OpenAI library menggunakan error.status dan error.error
        if (error.status) {
            const errorMessage = error.error?.message || error.message || 'Terjadi kesalahan saat memproses permintaan';
            return res.status(error.status).json({
                error: {
                    message: errorMessage,
                    type: error.error?.type || 'api_error',
                    code: error.error?.code
                }
            });
        }
        
        // Handle error lainnya
        res.status(500).json({ 
            error: {
                message: error.message || 'Terjadi kesalahan pada server',
                type: 'server_error'
            }
        });
    }
});

// Endpoint untuk mendapatkan statistik knowledge base
app.get('/api/knowledge-base/stats', (req, res) => {
    try {
        const stats = knowledgeBase.getStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({
            error: { message: error.message }
        });
    }
});

// Endpoint untuk reload Q&A dataset ke RAG
app.post('/api/rag/reload-qa', async (req, res) => {
    try {
        const qaPath = process.env.QA_CSV_PATH || path.join(__dirname, 'vendor_qa_dataset.csv');
        
        if (!fs.existsSync(qaPath)) {
            return res.status(404).json({
                error: { message: 'File Q&A CSV tidak ditemukan' }
            });
        }
        
        if (!ragVectorStore.isReady()) {
            return res.status(503).json({
                error: { message: 'RAG Vector Store belum siap. Pastikan database dan embedder sudah terhubung.' }
            });
        }
        
        const result = await ragVectorStore.loadQAFromCSV(qaPath);
        res.json({
            success: true,
            message: 'Q&A dataset berhasil di-reload',
            result: result
        });
    } catch (error) {
        console.error('Error reloading Q&A:', error);
        res.status(500).json({
            error: { message: error.message || 'Terjadi kesalahan saat memproses file Q&A CSV' }
        });
    }
});

// Endpoint untuk test vector search
app.post('/api/rag/search', async (req, res) => {
    try {
        const { query, limit = 5 } = req.body;
        
        if (!query) {
            return res.status(400).json({
                error: { message: 'Query tidak boleh kosong' }
            });
        }
        
        if (!ragVectorStore.isReady()) {
            return res.status(503).json({
                error: { message: 'RAG Vector Store belum siap' }
            });
        }
        
        const results = await ragVectorStore.vectorSearch(query, limit);
        res.json({
            query: query,
            results: results,
            count: results.length
        });
    } catch (error) {
        res.status(500).json({
            error: { message: error.message }
        });
    }
});

// Endpoint untuk mencari data dari knowledge base
app.post('/api/knowledge-base/search', (req, res) => {
    try {
        const { query, limit = 10 } = req.body;
        
        if (!query) {
            return res.status(400).json({
                error: { message: 'Query tidak boleh kosong' }
            });
        }
        
        const results = knowledgeBase.searchByKeyword(query, limit);
        const relevantContext = knowledgeBase.getRelevantContext(query, limit);
        
        res.json({
            query: query,
            searchResults: results,
            relevantContext: relevantContext,
            count: results.length,
            contextCount: relevantContext ? relevantContext.length : 0
        });
    } catch (error) {
        res.status(500).json({
            error: { message: error.message }
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    const kbStats = knowledgeBase.getStats();
    res.json({ 
        status: 'OK', 
        message: 'Server proxy berjalan dengan baik',
        knowledgeBase: {
            loaded: knowledgeBase.hasData(),
            rowCount: kbStats.rowCount,
            columns: kbStats.columns.length
        }
    });
});

// Auto-load CSV dari folder uploads atau environment variable
async function initializeKnowledgeBase() {
    // Cek beberapa lokasi potensial
    const possiblePaths = [
        process.env.CSV_FILE_PATH,
        path.join(__dirname, 'uploads', 'knowledge_base.csv'),
        path.join(__dirname, 'example_vendor_data.csv'),
        path.join(__dirname, 'knowledge_base.csv')
    ].filter(p => p); // Hapus undefined
    
    let csvPath = null;
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            csvPath = p;
            break;
        }
    }
    
    if (csvPath) {
        try {
            await knowledgeBase.loadCSV(csvPath);
            const stats = knowledgeBase.getStats();
            console.log(`✅ Knowledge Base loaded from: ${csvPath}`);
            console.log(`   📊 Total rows: ${stats.rowCount}`);
            console.log(`   📋 Columns: ${stats.columns.join(', ')}`);
        } catch (error) {
            console.error(`❌ Error loading CSV from ${csvPath}:`, error.message);
        }
    } else {
        console.log(`⚠️  File CSV tidak ditemukan di lokasi berikut:`);
        possiblePaths.forEach(p => console.log(`   - ${p}`));
        console.log(`   Untuk menggunakan knowledge base, letakkan file CSV di salah satu lokasi di atas`);
        console.log(`   Atau set CSV_FILE_PATH di .env`);
    }
}

// Health check endpoint (for Docker/container monitoring)
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve index.html for root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, async () => {
    console.log(`🚀 Server proxy berjalan di http://localhost:${PORT}`);
    console.log(`📝 Pastikan file .env sudah berisi MAIA_API_KEY`);
    console.log(`🔗 Menggunakan Maia Router API: https://api.maiarouter.ai`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    
    // Initialize knowledge base
    await initializeKnowledgeBase();
    
    // Initialize RAG Vector Store
    console.log('🔄 Initializing RAG Vector Store...');
    await ragVectorStore.initializeRAG();
});

