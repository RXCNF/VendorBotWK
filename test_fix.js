const knowledgeBase = require('./src/knowledgeBase');
const path = require('path');

async function testStats() {
    try {
        const csvPath = path.join(__dirname, 'data/Data Vendor 051225_cleaned.csv');
        // console.log(`Loading CSV from: ${csvPath}`);

        await knowledgeBase.loadCSV(csvPath);

        const stats = knowledgeBase.getDashboardStats();

        if (!stats) return;

        console.log('Qualification Counts:', stats.qualificationCounts);
        // Expect keys like "PT", "CV", "Firma", etc.

    } catch (error) {
        console.error('Error during test:', error);
    }
}

testStats();
