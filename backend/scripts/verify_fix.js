require('dotenv').config();
const ragVectorStore = require('./ragVectorStore');
const mysql = require('mysql2/promise');

async function verifyFix() {
    console.log('🧪 Verifying Fix for TiDB JSON Parsing...');

    // 1. Initialize RAG (should trigger loadEmbeddingsFromTiDB)
    // We expect it to load ~13k rows and NOT trigger "Processing batch"

    // Mocking console.log to capture output
    const originalLog = console.log;
    let logs = [];
    console.log = (...args) => {
        logs.push(args.join(' '));
        originalLog(...args);
    };

    try {
        await ragVectorStore.initializeRAG();

        // Wait for background process (setImmediate)
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Check logs
        const cachedLog = logs.find(l => l.includes('Cached') && l.includes('embeddings from TiDB'));
        const batchLog = logs.find(l => l.includes('Processing batch'));
        const noNewDataLog = logs.find(l => l.includes('No new data to process'));

        if (cachedLog) {
            console.log('✅ PASS: Successfully cached data from TiDB');
        } else {
            console.error('❌ FAIL: Did not cache data from TiDB');
        }

        if (!batchLog) {
            console.log('✅ PASS: Did not trigger batch processing (Correct behavior)');
        } else {
            console.error('❌ FAIL: Triggered batch processing (Duplication check failed)');
        }

        if (noNewDataLog) {
            console.log('✅ PASS: Detected no new data');
        } else {
            // It might be okay if there is genuinely new data, but given we have 13k rows, it should be empty
            console.warn('⚠️ WARN: "No new data" log not found. Check if there really is new data.');
        }

    } catch (error) {
        console.error('❌ Error during verification:', error);
    } finally {
        console.log = originalLog;

        // Close DB connection if possible to let process exit
        try {
            const db = await ragVectorStore.getDbConnection();
            if (db) await db.end();
        } catch (e) { }
    }
}

verifyFix();
