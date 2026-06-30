require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');

async function checkTiDB() {
    console.log('Checking TiDB Connection and Data...');

    // Config from ragVectorStore.js
    const poolConfig = {
        host: process.env.TIDB_HOST || 'gateway01.eu-central-1.prod.aws.tidbcloud.com',
        port: parseInt(process.env.TIDB_PORT || '4000'),
        user: process.env.TIDB_USER || '4FqBFypz77uRj5T.root',
        password: process.env.TIDB_PASSWORD || 'oYR3jAzts3D0RMkF',
        database: process.env.TIDB_DATABASE || 'RAG',
        ssl: { rejectUnauthorized: false }
    };

    if (process.env.TIDB_CA_PATH && fs.existsSync(process.env.TIDB_CA_PATH)) {
        poolConfig.ssl.ca = fs.readFileSync(process.env.TIDB_CA_PATH);
    }

    try {
        const connection = await mysql.createConnection(poolConfig);
        console.log('✅ Connected to TiDB');

        const [rows] = await connection.execute('SELECT COUNT(*) as count FROM vendor_embeddings');
        console.log(`📊 Total rows in vendor_embeddings: ${rows[0].count}`);

        if (rows[0].count > 0) {
            const [excludeSample] = await connection.execute('SELECT question FROM vendor_embeddings LIMIT 5');
            console.log('Sample questions in DB:');
            excludeSample.forEach(r => console.log(` - ${r.question}`));
        }

        await connection.end();
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

checkTiDB();
