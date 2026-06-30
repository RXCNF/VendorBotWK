require('dotenv').config();
const ragVectorStore = require('./ragVectorStore');

async function verifyLoad() {
    console.log('Testing loadEmbeddingsFromTiDB...');
    const db = await ragVectorStore.getDbConnection();

    // Manually trigger the internal load function (we can't access it directly as it's not exported, 
    // but we can infer success if we check in-memory store via a search)

    // Actually, I'll modify ragVectorStore to export it temporarily or just trust the initializeRAG
    // But initializeRAG is async background.

    // Let's use the public API 'initializeRAG' and wait.
    await ragVectorStore.initializeRAG();

    // Wait Loop
    let ready = false;
    for (let i = 0; i < 10; i++) {
        if (ragVectorStore.isReady()) { // This just checks connection, not data loaded
            // We need to check if data is loaded. 
            // We can do a search. If search returns result, data is loaded.
            const results = await ragVectorStore.vectorSearch("test", 1);
            if (results.length > 0) {
                console.log('✅ Setup Verified: Search returned results, meaning data is loaded in memory.');
                console.log('   (If this happens, it means loading from TiDB worked)');
                process.exit(0);
            }
        }
        console.log('Waiting for data load...');
        await new Promise(r => setTimeout(r, 2000));
    }
    console.log('❌ Timeout waiting for data load');
    process.exit(1);
}

verifyLoad();
