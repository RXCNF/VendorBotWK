// RAG Vector Store Module menggunakan BAAI/bge-m3
// Support TiDB (optional) atau in-memory storage
const { pipeline } = require('@xenova/transformers');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
require('dotenv').config();

// Model embedding
let embedder = null;
const MODEL_NAME = 'Xenova/bge-m3'; // Xenova version of BAAI/bge-m3

// Storage mode: 'tidb' atau 'memory'
const STORAGE_MODE = process.env.RAG_STORAGE_MODE || 'memory';

// Database connection pool (optional, hanya jika menggunakan TiDB)
let dbPool = null;
let mysql = null;

// In-memory storage untuk embeddings
let inMemoryStore = [];
const EMBEDDINGS_FILE = path.join(__dirname, '../data/embeddings_store.json');

// Initialize database connection (optional, hanya jika menggunakan TiDB)
async function initDatabase() {
    if (STORAGE_MODE !== 'tidb') {
        return false; // Skip jika tidak menggunakan TiDB
    }

    try {
        // Lazy load mysql2 hanya jika diperlukan
        if (!mysql) {
            mysql = require('mysql2/promise');
        }

        const poolConfig = {
            host: process.env.TIDB_HOST || 'gateway01.eu-central-1.prod.aws.tidbcloud.com',
            port: parseInt(process.env.TIDB_PORT || '4000'),
            user: process.env.TIDB_USER || '4FqBFypz77uRj5T.root',
            password: process.env.TIDB_PASSWORD || 'oYR3jAzts3D0RMkF',
            database: process.env.TIDB_DATABASE || 'RAG',
            connectionLimit: 10, // Menambah jalur koneksi agar Login/Signup tidak antri
            waitForConnections: true,
            queueLimit: 0,
            enableKeepAlive: true,
            keepAliveInitialDelay: 0,
            maxIdle: 10, // Max idle connections
            idleTimeout: 60000 // Close idle connections after 60s to prevent server-side reset
        };

        // TiDB menggunakan SSL
        if (process.env.TIDB_CA_PATH && fs.existsSync(process.env.TIDB_CA_PATH)) {
            poolConfig.ssl = {
                ca: fs.readFileSync(process.env.TIDB_CA_PATH)
            };
        } else {
            poolConfig.ssl = {
                rejectUnauthorized: false
            };
        }

        dbPool = mysql.createPool(poolConfig);

        console.log('✅ Connected to TiDB database (Pool Initialized)');

        // Create tables if not exists
        await createTableIfNotExists();
        await createUsersTableIfNotExists(); // Add users table for auth
        await createPasswordResetsTableIfNotExists(); // Add password resets table
        await createChatSessionsTableIfNotExists(); // Add chat sessions table
        await createVendorsTableIfNotExists(); // Add vendors table
        await createVendorRequestsTableIfNotExists(); // Add vendor requests table

        return true;
    } catch (error) {
        console.error('❌ Error connecting to TiDB:', error.message);
        console.error('   Switching to in-memory storage mode');
        return false;
    }
}

// Create embeddings table (hanya untuk TiDB mode)
async function createTableIfNotExists() {
    if (!dbPool) return;

    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS vendor_embeddings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            question TEXT NOT NULL,
            answer TEXT NOT NULL,
            embedding JSON NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_question (question(255))
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    try {
        await dbPool.execute(createTableQuery);
        console.log('✅ Embeddings table ready');
    } catch (error) {
        console.error('❌ Error creating table:', error.message);
        throw error;
    }
}

// Create users table for authentication
async function createUsersTableIfNotExists() {
    if (!dbPool) return;

    const createUsersTableQuery = `
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            fullname VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            role VARCHAR(50) DEFAULT 'staff scm',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    try {
        await dbPool.execute(createUsersTableQuery);
        console.log('✅ Users table ready');
        // Ensure role column exists (migration for existing DB)
        await ensureRoleColumnExists();
    } catch (error) {
        console.error('❌ Error creating users table:', error.message);
    }
}

// Migration helper to add role column to existing users table
async function ensureRoleColumnExists() {
    if (!dbPool) return;
    try {
        const [columns] = await dbPool.execute('SHOW COLUMNS FROM users');
        const hasRole = columns.some(col => col.Field === 'role');

        if (!hasRole) {
            console.log('🔄 Migrating users table: Adding role column...');
            await dbPool.execute("ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'staff scm' AFTER password");
            console.log('✅ Role column added successfully');
        }
    } catch (error) {
        console.error('⚠️ Migration error (role column):', error.message);
    }
}

// Create password link reset table
async function createPasswordResetsTableIfNotExists() {
    if (!dbPool) return;

    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS password_resets (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(255) NOT NULL,
            token VARCHAR(255) NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_token (token),
            INDEX idx_email (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    try {
        await dbPool.execute(createTableQuery);
        console.log('✅ Password resets table ready');
    } catch (error) {
        console.error('❌ Error creating password_resets table:', error.message);
    }
}



// Create chat sessions table for cloud history
async function createChatSessionsTableIfNotExists() {
    if (!dbPool) return;

    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS chat_sessions (
            id VARCHAR(50) PRIMARY KEY,
            user_email VARCHAR(255) NOT NULL,
            title TEXT,
            messages JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_user_email (user_email),
            INDEX idx_updated (updated_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    try {
        await dbPool.execute(createTableQuery);
        console.log('✅ Chat sessions table ready');
    } catch (error) {
        console.error('❌ Error creating chat_sessions table:', error.message);
    }
}

// Create vendors table for persistent data storage
async function createVendorsTableIfNotExists() {
    if (!dbPool) return;

    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS vendors (
            id INT AUTO_INCREMENT PRIMARY KEY,
            kualifikasi VARCHAR(100),
            nama_vendor VARCHAR(255) NOT NULL,
            status_rekanan VARCHAR(100),
            bidang_usaha TEXT,
            cqsms_vendor VARCHAR(100),
            provinsi VARCHAR(100),
            industry_key VARCHAR(100),
            kode_sbu TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_nama (nama_vendor),
            INDEX idx_status (status_rekanan)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    try {
        await dbPool.execute(createTableQuery);
        console.log('✅ Vendors table ready');
    } catch (error) {
        console.error('❌ Error creating vendors table:', error.message);
    }
}

// Create vendor update requests table for approval workflow
async function createVendorRequestsTableIfNotExists() {
    if (!dbPool) return;

    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS vendor_requests (
            id INT AUTO_INCREMENT PRIMARY KEY,
            vendor_id INT,
            action_type ENUM('CREATE', 'UPDATE', 'DELETE') NOT NULL,
            payload JSON,
            requested_by VARCHAR(255) NOT NULL,
            status ENUM('PENDING', 'APPROVED', 'REJECTED') DEFAULT 'PENDING',
            admin_note TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    try {
        await dbPool.execute(createTableQuery);
        console.log('✅ Vendor requests table ready');
    } catch (error) {
        console.error('❌ Error creating vendor_requests table:', error.message);
    }
}

// Create query logs table for performance evaluation
async function createQueryLogsTableIfNotExists() {
    if (!dbPool) return;

    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS query_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_email VARCHAR(255),
            query TEXT,
            rag_results_count INT,
            rag_top_similarity FLOAT,
            pre_processing_time FLOAT,
            stream_duration FLOAT,
            total_duration FLOAT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_user (user_email),
            INDEX idx_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    try {
        await dbPool.execute(createTableQuery);
        console.log('✅ Query logs table ready');
    } catch (error) {
        console.error('❌ Error creating query_logs table:', error.message);
    }
}

// Load all embeddings from TiDB into in-memory store for fast searching
async function loadEmbeddingsFromTiDB() {
    if (!dbPool) return false;

    try {
        console.log('🚀 Loading embeddings from TiDB into memory cache...');
        const [rows] = await dbPool.execute(
            'SELECT question, answer, embedding FROM vendor_embeddings'
        );

        inMemoryStore = rows.map(row => {
            let embeddingVal = row.embedding;
            // TiDB/MySQL2 driver might auto-parse JSON columns
            if (typeof embeddingVal === 'string') {
                try {
                    embeddingVal = JSON.parse(embeddingVal);
                } catch (e) {
                    console.error('❌ Error parsing embedding JSON:', e.message);
                    embeddingVal = []; // Fallback
                }
            }

            return {
                question: row.question,
                answer: row.answer,
                embedding: embeddingVal
            };
        });

        console.log(`✅ Cached ${inMemoryStore.length} embeddings from TiDB`);
        return true;
    } catch (error) {
        console.error('❌ Error loading from TiDB:', error.message);
        return false;
    }
}

// Export database pool for other modules (like auth)
async function getDbConnection() {
    if (!dbPool) {
        await initDatabase();
    }
    return dbPool;
}

// Load embeddings from file (untuk in-memory mode)
async function loadEmbeddingsFromFile() {
    try {
        if (fs.existsSync(EMBEDDINGS_FILE)) {
            const data = fs.readFileSync(EMBEDDINGS_FILE, 'utf8');
            inMemoryStore = JSON.parse(data);
            console.log(`✅ Loaded ${inMemoryStore.length} embeddings from file`);
            return true;
        }
        return false;
    } catch (error) {
        console.error('❌ Error loading embeddings from file:', error.message);
        return false;
    }
}

// Save embeddings to file (untuk in-memory mode)
async function saveEmbeddingsToFile() {
    try {
        fs.writeFileSync(EMBEDDINGS_FILE, JSON.stringify(inMemoryStore, null, 2));
        console.log(`✅ Saved ${inMemoryStore.length} embeddings to file`);
        return true;
    } catch (error) {
        console.error('❌ Error saving embeddings to file:', error.message);
        return false;
    }
}

// Initialize embedder
async function initEmbedder() {
    try {
        console.log('🔄 Loading embedding model:', MODEL_NAME);
        embedder = await pipeline('feature-extraction', MODEL_NAME);
        console.log('✅ Embedding model loaded');
        return true;
    } catch (error) {
        console.error('❌ Error loading embedding model:', error.message);
        return false;
    }
}

// Generate embedding for text
async function generateEmbedding(text) {
    if (!embedder) {
        await initEmbedder();
    }

    try {
        // Generate embedding using the model
        const output = await embedder(text, {
            pooling: 'mean',
            normalize: true
        });

        // Convert tensor/array to regular JavaScript array
        let embedding;
        if (output.data) {
            embedding = Array.from(output.data);
        } else if (Array.isArray(output)) {
            embedding = output;
        } else {
            // Handle different output formats
            embedding = Array.from(output);
        }

        return embedding;
    } catch (error) {
        console.error('❌ Error generating embedding:', error.message);
        throw error;
    }
}

// Load Q&A from CSV and store embeddings with batch processing
async function loadQAFromCSV(csvPath) {
    return new Promise((resolve, reject) => {
        const qaData = [];
        const BATCH_SIZE = 100; // Process 100 Q&A pairs per batch untuk embedding generation

        if (!fs.existsSync(csvPath)) {
            return reject(new Error('File CSV tidak ditemukan'));
        }

        // Build a Set of existing questions for O(1) lookup (Normalize to lowercase)
        const existingQuestions = new Set(inMemoryStore.map(item => item.question.toLowerCase().trim()));

        fs.createReadStream(csvPath)
            .pipe(csv())
            .on('data', (row) => {
                if (row.Pertanyaan && row.Jawaban) {
                    const qRaw = row.Pertanyaan.trim();
                    const qNormalized = qRaw.toLowerCase();

                    // Only add if not already in store (Case insensitive check)
                    if (!existingQuestions.has(qNormalized)) {
                        qaData.push({
                            question: qRaw,
                            answer: row.Jawaban.trim()
                        });
                        // Add to set to prevent duplicates within the CSV itself
                        existingQuestions.add(qNormalized);
                    }
                }
            })
            .on('end', async () => {
                console.log(`📚 Found ${qaData.length} new Q&A pairs to process from CSV`);

                if (qaData.length === 0) {
                    console.log('✅ No new data to process.');
                    return resolve({ total: 0, stored: 0 });
                }

                console.log(`🔄 Processing in batches of ${BATCH_SIZE}...`);

                let stored = 0;
                let processed = 0;
                const totalBatches = Math.ceil(qaData.length / BATCH_SIZE);

                // Process in batches untuk menghindari memory issues
                for (let i = 0; i < qaData.length; i += BATCH_SIZE) {
                    const batch = qaData.slice(i, i + BATCH_SIZE);
                    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

                    console.log(`   Processing batch ${batchNum}/${totalBatches} (${batch.length} items)...`);

                    try {
                        // 1. Generate embeddings with CPU THROTTLING
                        // Process in smaller sub-batches (e.g., 5 at a time) to avoid 100% CPU spikes
                        const SUB_BATCH_SIZE = 5;
                        const successfulItems = [];

                        for (let j = 0; j < batch.length; j += SUB_BATCH_SIZE) {
                            const subBatch = batch.slice(j, j + SUB_BATCH_SIZE);
                            const subBatchResults = await Promise.all(subBatch.map(async (qa) => {
                                try {
                                    const embedding = await generateEmbedding(qa.question);
                                    return { ...qa, embedding, success: true };
                                } catch (e) {
                                    console.error(`   ⚠️  Error generating embedding for: ${qa.question.substring(0, 50)}...`, e.message);
                                    return { ...qa, success: false };
                                }
                            }));

                            successfulItems.push(...subBatchResults.filter(item => item.success));

                            // Yield to event loop to keep the server snappy
                            await new Promise(resolve => setTimeout(resolve, 50));
                        }

                        if (STORAGE_MODE === 'tidb' && dbPool && successfulItems.length > 0) {
                            // 2. BULK INSERT: Satu query untuk banyak data (Sangat cepat dan efisien)
                            const sql = 'INSERT INTO vendor_embeddings (question, answer, embedding) VALUES ?';
                            const values = successfulItems.map(item => [
                                item.question,
                                item.answer,
                                JSON.stringify(item.embedding)
                            ]);

                            await dbPool.query(sql, [values]);
                        }

                        // 3. Update memory cache for all erfolgreiche items
                        successfulItems.forEach(item => {
                            inMemoryStore.push({
                                question: item.question,
                                answer: item.answer,
                                embedding: item.embedding
                            });
                        });

                        stored += successfulItems.length;
                        processed += batch.length;
                    } catch (error) {
                        console.error(`   ❌ Error in batch ${batchNum}:`, error.message);
                    }

                    // Log progress
                    console.log(`   Progress: ${processed}/${qaData.length} (${((processed / qaData.length) * 100).toFixed(1)}%)`);

                    // --- YIELD TO EVENT LOOP ---
                    // Memberikan kesempatan pada Express untuk memproses request lain (seperti Login/Signup)
                    await new Promise(resolve => setTimeout(resolve, 100));

                    // Garbage collection hint (optional)
                    if (global.gc) global.gc();
                }

                // Final save ONLY once at the end
                if (STORAGE_MODE === 'memory' && stored > 0) {
                    await saveEmbeddingsToFile();
                }

                console.log(`✅ Completed: Stored ${stored} new Q&A pairs`);
                resolve({ total: qaData.length, stored });
            })
            .on('error', (error) => {
                reject(error);
            });
    });
}

// Re-index RAG system: Truncate and Reload
async function reindexRAG(csvPath) {
    if (!dbPool && STORAGE_MODE === 'tidb') {
        await initDatabase();
    }

    console.log('🔄 [Re-index] Starting RAG re-index...');

    try {
        if (STORAGE_MODE === 'tidb' && dbPool) {
            console.log('   🧹 Truncating vendor_embeddings table...');
            await dbPool.execute('TRUNCATE TABLE vendor_embeddings');
        }

        console.log('   🧹 Clearing in-memory cache...');
        inMemoryStore = [];

        console.log(`   📖 Loading data from ${csvPath}...`);
        const result = await loadQAFromCSV(csvPath);

        console.log(`✅ [Re-index] Completed. Total stored: ${result.stored}`);
        return result;
    } catch (error) {
        console.error('❌ [Re-index] Error:', error.message);
        throw error;
    }
}

// Vector similarity search using cosine similarity
async function vectorSearch(query, limit = 5) {
    try {
        // Generate embedding for query
        const queryEmbedding = await generateEmbedding(query);

        // Always use in-memory store for searching (it's synchronized with TiDB on startup and sync)
        rows = inMemoryStore.map((item, index) => ({
            id: index + 1,
            question: item.question,
            answer: item.answer,
            embedding: item.embedding
        }));

        if (rows.length === 0) {
            return [];
        }

        // Calculate cosine similarity
        const similarities = rows.map(row => {
            const similarity = cosineSimilarity(queryEmbedding, row.embedding);
            return {
                id: row.id,
                question: row.question,
                answer: row.answer,
                similarity: similarity
            };
        });

        // Sort by similarity and return top results
        const results = similarities
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit)
            .filter(item => item.similarity > 0.3); // Threshold untuk relevansi

        console.log(`🔍 Vector search: Found ${results.length} relevant results for query: "${query}"`);
        if (results.length > 0) {
            console.log(`   Top similarity: ${results[0].similarity.toFixed(4)}`);
        }

        return results;
    } catch (error) {
        console.error('❌ Error in vector search:', error.message);
        throw error;
    }
}

// Cosine similarity function
function cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) {
        return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
}

// Get relevant context from vector search with metadata
async function getRelevantContext(query, maxResults = 3) {
    try {
        const results = await vectorSearch(query, maxResults);

        const metrics = {
            count: results.length,
            topSimilarity: results.length > 0 ? results[0].similarity : 0
        };

        if (results.length === 0) {
            return { context: null, metrics };
        }

        // Format results for context
        let context = 'Berikut adalah informasi relevan dari knowledge base:\n\n';
        results.forEach((result, index) => {
            context += `[Informasi ${index + 1}]\n`;
            context += `Pertanyaan: ${result.question}\n`;
            context += `Jawaban: ${result.answer}\n`;
            context += `(Relevansi: ${(result.similarity * 100).toFixed(1)}%)\n\n`;
        });

        return { context, metrics };
    } catch (error) {
        console.error('❌ Error getting relevant context:', error.message);
        return { context: null, metrics: { count: 0, topSimilarity: 0 } };
    }
}

// Initialize RAG system - PHASE 1: Fast initialization (Enables Login/Signup)
async function initializeRAG() {
    // Phase 1: Initialize Database Pool (Instant)
    let dbReady = false;
    if (STORAGE_MODE === 'tidb') {
        dbReady = await initDatabase();
        if (dbReady) {
            // Priority: Load existing users table for auth (Fast)
            await createUsersTableIfNotExists();
            await createQueryLogsTableIfNotExists(); // Initialize query logs
        }
    }

    // Phase 2: Background heavy work (Async, doesn't block server startup)
    setImmediate(async () => {
        try {
            console.log('🔄 [Background] Initializing embedding model and pre-fetching data...');
            const embedderReady = await initEmbedder();
            if (!embedderReady) return;

            if (dbReady) {
                // LOAD CACHE: Fetch all existing data from TiDB into memory
                await loadEmbeddingsFromTiDB();
            } else {
                console.log('ℹ️  Using in-memory storage mode');
                await loadEmbeddingsFromFile();
            }

            // Load Q&A from CSV
            const possiblePaths = [
                process.env.QA_CSV_PATH,
                path.join(__dirname, '../data/vendor_qa_dataset.csv'),
                path.join(__dirname, '../data/uploads/vendor_qa_dataset.csv')
            ].filter(p => p && fs.existsSync(p));

            const qaPath = possiblePaths.length > 0 ? possiblePaths[0] : null;
            if (qaPath) {
                console.log(`📖 [Background] Scanning Q&A dataset: ${qaPath}`);
                await loadQAFromCSV(qaPath);
            }
        } catch (error) {
            console.error('❌ [Background] Initialization error:', error.message);
        }
    });

    return true;
}

module.exports = {
    initializeRAG,
    getRelevantContext,
    vectorSearch,
    generateEmbedding,
    loadQAFromCSV,
    reindexRAG,
    getDbConnection,
    clearMemoryStore: () => { inMemoryStore = []; },
    isReady: () => embedder !== null && (STORAGE_MODE === 'memory' || dbPool !== null)
};

