require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');

async function cleanupDuplicates() {
    console.log('🧹 Starting Duplicate Cleanup...');

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

        // 1. Get initial count
        const [startRows] = await connection.execute('SELECT COUNT(*) as count FROM vendor_embeddings');
        console.log(`📊 Current total rows: ${startRows[0].count}`);

        // 2. Identify duplicates (keep the one with MAX id or MIN id? Let's keep MIN id)
        console.log('🔍 Identifying duplicates...');

        // Use a self-join DELETE or a two-step process. TiDB supports common MySQL syntax.
        // Safe approach: Find IDs to keep.

        // This query finds the ID of the first occurrence of each question
        const findKeepIdsQuery = `
            SELECT MIN(id) as id 
            FROM vendor_embeddings 
            GROUP BY question
        `;

        const [keepRows] = await connection.execute(findKeepIdsQuery);
        const keepIds = keepRows.map(r => r.id);
        console.log(`✅ Found ${keepIds.length} unique questions to keep.`);

        const rowsToDelete = startRows[0].count - keepIds.length;
        console.log(`🗑️  Rows to delete: ${rowsToDelete}`);

        if (rowsToDelete > 0) {
            // Delete in batches to avoid transaction limits if any
            // We can delete where ID NOT IN (keepIds)
            // But waiting for 2.6k IDs in WHERE IN might be fine.

            // To be safe and handle list size limit, we can split
            const keepIdsString = keepIds.join(',');

            // Note: If the list is too long, this might fail.
            // Alternative: Add a temporary column or use a smarter query.
            // Since we know we have ~13k total and ~2.6k unique, the Keep list is 2.6k.
            // The Delete list is ~10k.

            // Let's try to DELETE using the standard MySQL trick:
            // DELETE t1 FROM vendor_embeddings t1 INNER JOIN vendor_embeddings t2 
            // WHERE t1.id > t2.id AND t1.question = t2.question

            console.log('🚀 Executing Delete...');
            const deleteQuery = `
                DELETE t1 FROM vendor_embeddings t1 
                INNER JOIN vendor_embeddings t2 
                WHERE t1.id > t2.id AND t1.question = t2.question
            `;

            const [result] = await connection.execute(deleteQuery);
            console.log(`✅ Deleted ${result.affectedRows} duplicate rows.`);

        } else {
            console.log('✨ No duplicates found.');
        }

        // Final check
        const [endRows] = await connection.execute('SELECT COUNT(*) as count FROM vendor_embeddings');
        console.log(`📊 Final total rows: ${endRows[0].count}`);

        await connection.end();
    } catch (error) {
        console.error('❌ Error during cleanup:', error.message);
    }
}

cleanupDuplicates();
