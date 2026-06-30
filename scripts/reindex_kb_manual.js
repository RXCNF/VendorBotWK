require('dotenv').config();
const path = require('path');
const { reindexRAG } = require('./ragVectorStore');

async function run() {
    const csvPath = path.join(__dirname, 'vendor_qa_dataset.csv');
    try {
        await reindexRAG(csvPath);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

run();
