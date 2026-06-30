require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');

async function checkUsers() {
    console.log('👥 Checking Registered Users...');

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
        console.log('✅ Connected to TiDB');

        const [rows] = await connection.execute('SELECT id, fullname, email, created_at FROM users ORDER BY created_at DESC');

        console.log(`\n📊 Total Users: ${rows.length}`);
        console.log('---------------------------------------------------');
        console.log('| ID | Name                 | Email                |');
        console.log('---------------------------------------------------');

        rows.forEach(user => {
            const name = user.fullname.padEnd(20).substring(0, 20);
            const email = user.email.padEnd(20).substring(0, 20);
            console.log(`| ${user.id.toString().padEnd(2)} | ${name} | ${email} |`);
        });
        console.log('---------------------------------------------------');

        await connection.end();
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

checkUsers();
