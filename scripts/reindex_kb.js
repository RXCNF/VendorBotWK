require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const ragVectorStore = require('./ragVectorStore');
const { loadQAFromCSV, clearMemoryStore, initializeRAG } = ragVectorStore;

async function reindex() {
    console.log('🔄 Memulai proses RE-INDEX Knowledge Base...');

    try {
        // 1. Initialize RAG first (to setup pool and embedder)
        console.log('🏗️ Menginisialisasi sistem RAG...');
        await initializeRAG();

        // Wait a bit for background init to finish or just clear memory
        await new Promise(resolve => setTimeout(resolve, 5000));
        clearMemoryStore();

        const poolConfig = {
            host: process.env.TIDB_HOST,
            port: parseInt(process.env.TIDB_PORT),
            user: process.env.TIDB_USER,
            password: process.env.TIDB_PASSWORD,
            database: process.env.TIDB_DATABASE,
            ssl: {
                rejectUnauthorized: false
            }
        };

        const connection = await mysql.createConnection(poolConfig);
        console.log('✅ Terhubung ke TiDB.');

        // 2. Kosongkan tabel embeddings yang lama
        console.log('🧹 Mengosongkan tabel vendor_embeddings...');
        await connection.execute('TRUNCATE TABLE vendor_embeddings');
        console.log('✅ Tabel dikosongkan.');

        await connection.end();

        // 3. Jalankan loadQAFromCSV dari file yang bersih
        const cleanedCsvPath = path.join(__dirname, 'Data Vendor 051225_cleaned.csv');
        if (!fs.existsSync(cleanedCsvPath)) {
            throw new Error(`File cleaned CSV tidak ditemukan di ${cleanedCsvPath}`);
        }

        console.log(`📖 Mengindeks ulang dari: ${cleanedCsvPath}`);

        const result = await loadQAFromCSV(cleanedCsvPath);
        console.log(`\n✨ SELESAI! Berhasil mengindeks ${result.stored} vendor.`);
        process.exit(0);

    } catch (error) {
        console.error('❌ Gagal melakukan re-index:', error.message);
        process.exit(1);
    }
}

reindex();
