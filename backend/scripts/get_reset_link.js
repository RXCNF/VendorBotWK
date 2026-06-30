require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');

async function getResetLink() {
    console.log('🔍 Searching for latest password reset tokens...');

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

        // Get valid tokens (not expired)
        const [rows] = await connection.execute(
            'SELECT email, token, created_at FROM password_resets WHERE expires_at > NOW() ORDER BY created_at DESC LIMIT 5'
        );

        if (rows.length === 0) {
            console.log('❌ No active reset tokens found.');
        } else {
            console.log('\n✅ Found active reset links:');
            rows.forEach(row => {
                const link = `http://localhost:3000/reset_password.html?token=${row.token}&email=${row.email}`;
                console.log(`\n📧 Email: ${row.email}`);
                console.log(`🕒 Created: ${row.created_at}`);
                console.log(`🔗 Link: ${link}`);
            });
        }

        await connection.end();
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

getResetLink();
