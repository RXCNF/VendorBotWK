require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');

async function runMigrationAndList() {
    console.log('🔄 Starting Schema Migration & User Check...');

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

        // 1. MIGRATION: Add role column if missing
        const [columns] = await connection.execute('SHOW COLUMNS FROM users');
        const hasRole = columns.some(col => col.Field === 'role');

        if (!hasRole) {
            console.log('🔄 Migrating users table: Adding role column...');
            await connection.execute("ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'staff scm' AFTER password");
            console.log('✅ Role column added successfully');
        } else {
            console.log('ℹ️ Role column already exists');
        }

        // 2. LIST USERS
        const [users] = await connection.execute('SELECT fullname, email, role FROM users');
        console.log('\n--- DAFTAR PENGGUNA TERDAFTAR ---\n');

        if (users.length === 0) {
            console.log('No users found.');
        } else {
            console.table(users);
        }

        await connection.end();
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

runMigrationAndList();
