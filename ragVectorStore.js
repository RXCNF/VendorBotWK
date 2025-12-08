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

// Database connection (optional, hanya jika menggunakan TiDB)
let dbConnection = null;
let mysql = null;

// In-memory storage untuk embeddings
let inMemoryStore = [];
const EMBEDDINGS_FILE = path.join(__dirname, 'embeddings_store.json');

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
        
        const connectionConfig = {
            host: process.env.TIDB_HOST || 'gateway01.eu-central-1.prod.aws.tidbcloud.com',
            port: parseInt(process.env.TIDB_PORT || '4000'),
            user: process.env.TIDB_USER || '4FqBFypz77uRj5T.root',
            password: process.env.TIDB_PASSWORD || '00ZVkGpp0Gwexy0s',
            database: process.env.TIDB_DATABASE || 'RAG'
        };
        
        // TiDB menggunakan SSL
        if (process.env.TIDB_CA_PATH && fs.existsSync(process.env.TIDB_CA_PATH)) {
            connectionConfig.ssl = {
                ca: fs.readFileSync(process.env.TIDB_CA_PATH)
            };
        } else {
            connectionConfig.ssl = {
                rejectUnauthorized: false
            };
        }
        
        dbConnection = await mysql.createConnection(connectionConfig);
        
        console.log('✅ Connected to TiDB database');
        
        // Create table if not exists
        await createTableIfNotExists();
        
        return true;
    } catch (error) {
        console.error('❌ Error connecting to TiDB:', error.message);
        console.error('   Switching to in-memory storage mode');
        return false;
    }
}

// Create embeddings table (hanya untuk TiDB mode)
async function createTableIfNotExists() {
    if (!dbConnection) return;
    
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
        await dbConnection.execute(createTableQuery);
        console.log('✅ Embeddings table ready');
    } catch (error) {
        console.error('❌ Error creating table:', error.message);
        throw error;
    }
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

// Load Q&A from CSV and store embeddings
async function loadQAFromCSV(csvPath) {
    return new Promise((resolve, reject) => {
        const qaData = [];
        
        if (!fs.existsSync(csvPath)) {
            return reject(new Error('File CSV tidak ditemukan'));
        }
        
        fs.createReadStream(csvPath)
            .pipe(csv())
            .on('data', (row) => {
                if (row.Pertanyaan && row.Jawaban) {
                    qaData.push({
                        question: row.Pertanyaan.trim(),
                        answer: row.Jawaban.trim()
                    });
                }
            })
            .on('end', async () => {
                console.log(`📚 Loaded ${qaData.length} Q&A pairs from CSV`);
                
                let stored = 0;
                
                if (STORAGE_MODE === 'tidb' && dbConnection) {
                    // Store in TiDB
                    for (const qa of qaData) {
                        try {
                            const embedding = await generateEmbedding(qa.question);
                            
                            const [existing] = await dbConnection.execute(
                                'SELECT id FROM vendor_embeddings WHERE question = ?',
                                [qa.question]
                            );
                            
                            if (existing.length === 0) {
                                await dbConnection.execute(
                                    'INSERT INTO vendor_embeddings (question, answer, embedding) VALUES (?, ?, ?)',
                                    [qa.question, qa.answer, JSON.stringify(embedding)]
                                );
                                stored++;
                            }
                        } catch (error) {
                            console.error(`Error processing Q&A: ${qa.question}`, error.message);
                        }
                    }
                    console.log(`✅ Stored ${stored} new Q&A pairs in TiDB`);
                } else {
                    // Store in memory
                    for (const qa of qaData) {
                        try {
                            // Check if already exists
                            const exists = inMemoryStore.find(item => item.question === qa.question);
                            
                            if (!exists) {
                                const embedding = await generateEmbedding(qa.question);
                                inMemoryStore.push({
                                    question: qa.question,
                                    answer: qa.answer,
                                    embedding: embedding
                                });
                                stored++;
                            }
                        } catch (error) {
                            console.error(`Error processing Q&A: ${qa.question}`, error.message);
                        }
                    }
                    
                    // Save to file
                    await saveEmbeddingsToFile();
                    console.log(`✅ Stored ${stored} new Q&A pairs in memory`);
                }
                
                resolve({ total: qaData.length, stored });
            })
            .on('error', (error) => {
                reject(error);
            });
    });
}

// Vector similarity search using cosine similarity
async function vectorSearch(query, limit = 5) {
    try {
        // Generate embedding for query
        const queryEmbedding = await generateEmbedding(query);
        
        let rows = [];
        
        if (STORAGE_MODE === 'tidb' && dbConnection) {
            // Get from TiDB
            const [dbRows] = await dbConnection.execute(
                'SELECT id, question, answer, embedding FROM vendor_embeddings'
            );
            rows = dbRows.map(row => ({
                id: row.id,
                question: row.question,
                answer: row.answer,
                embedding: JSON.parse(row.embedding)
            }));
        } else {
            // Get from in-memory store
            rows = inMemoryStore.map((item, index) => ({
                id: index + 1,
                question: item.question,
                answer: item.answer,
                embedding: item.embedding
            }));
        }
        
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

// Get relevant context from vector search
async function getRelevantContext(query, maxResults = 3) {
    try {
        const results = await vectorSearch(query, maxResults);
        
        if (results.length === 0) {
            return null;
        }
        
        // Format results for context
        let context = 'Berikut adalah informasi relevan dari knowledge base:\n\n';
        results.forEach((result, index) => {
            context += `[Informasi ${index + 1}]\n`;
            context += `Pertanyaan: ${result.question}\n`;
            context += `Jawaban: ${result.answer}\n`;
            context += `(Relevansi: ${(result.similarity * 100).toFixed(1)}%)\n\n`;
        });
        
        return context;
    } catch (error) {
        console.error('❌ Error getting relevant context:', error.message);
        return null;
    }
}

// Initialize RAG system
async function initializeRAG() {
    const embedderReady = await initEmbedder();
    if (!embedderReady) {
        console.warn('⚠️  Embedder not ready, RAG features may not work');
        return;
    }
    
    // Try to initialize database (optional)
    let dbReady = false;
    if (STORAGE_MODE === 'tidb') {
        dbReady = await initDatabase();
        if (!dbReady) {
            console.log('ℹ️  TiDB not available, switching to in-memory storage');
        }
    } else {
        console.log('ℹ️  Using in-memory storage mode');
        // Load existing embeddings from file if available
        await loadEmbeddingsFromFile();
    }
    
    // Load Q&A from CSV
    const qaPath = process.env.QA_CSV_PATH || path.join(__dirname, 'vendor_qa_dataset.csv');
    if (fs.existsSync(qaPath)) {
        try {
            await loadQAFromCSV(qaPath);
        } catch (error) {
            console.error('❌ Error loading Q&A dataset:', error.message);
        }
    } else {
        console.log(`ℹ️  Q&A CSV not found at ${qaPath}`);
    }
}

module.exports = {
    initializeRAG,
    getRelevantContext,
    vectorSearch,
    loadQAFromCSV,
    generateEmbedding,
    isReady: () => embedder !== null && (STORAGE_MODE === 'memory' || dbConnection !== null)
};

