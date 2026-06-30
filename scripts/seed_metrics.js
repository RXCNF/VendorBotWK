const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const ragVectorStore = require('../src/ragVectorStore');

async function run() {
    await ragVectorStore.initializeRAG();
    // Wait a bit for connection
    setTimeout(async () => {
        const db = await ragVectorStore.getDbConnection();
        try {
            await db.execute(
                `INSERT INTO query_logs (user_email, query, rag_results_count, rag_top_similarity, pre_processing_time, stream_duration, total_duration) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                ['admin@tester.com', 'Test Query for Metrics UI', 5, 0.875, 0.5, 2.3, 2.8]
            );
            console.log("✅ Dummy log inserted");
        } catch (e) {
            console.error(e);
        }
        process.exit(0);
    }, 2000);
}

run();
