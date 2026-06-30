require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');

async function checkJSON() {
    console.log('Checking JSON Column Type...');

    // Config
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
        console.log('✅ Connected');

        const [rows] = await connection.execute('SELECT embedding FROM vendor_embeddings LIMIT 1');

        if (rows.length > 0) {
            const raw = rows[0].embedding; // Changed from 'question' to 'embedding' (my bad in variable name, but logic is right)
            console.log('Type of embedding:', typeof raw);
            console.log('Is Array?', Array.isArray(raw));
            console.log('Value (first 50 chars):', JSON.stringify(raw).substring(0, 50));

            try {
                JSON.parse(raw);
                console.log('✅ JSON.parse(raw) succeeded');
            } catch (e) {
                console.log('❌ JSON.parse(raw) FAILED:', e.message);
            }
        } else {
            console.log('No rows found');
        }

        await connection.end();
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

checkJSON();
