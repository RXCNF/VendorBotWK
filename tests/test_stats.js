const knowledgeBase = require('../src/knowledgeBase');
const path = require('path');

async function testStats() {
    try {
        const csvPath = path.join(__dirname, '../data/Data Vendor 051225_cleaned.csv');
        console.log(`Loading CSV from: ${csvPath}`);

        await knowledgeBase.loadCSV(csvPath);

        const stats = knowledgeBase.getDashboardStats();

        if (!stats) {
            console.error('Failed to get stats (null returned)');
            return;
        }

        console.log('--- Dashboard Stats ---');
        console.log('Total Vendors:', stats.totalVendors);
        console.log('Status Counts:', stats.statusCounts);
        console.log('Province Counts (Top 5):', Object.entries(stats.provinceCounts).slice(0, 5));
        console.log('Qualification Counts:', stats.qualificationCounts);
        console.log('Top Business Fields:', stats.topBusinessFields);

        // Validation
        if (stats.totalVendors > 0 && stats.topBusinessFields.length > 0) {
            console.log('\n✅ Verification SUCCEEDED: Stats generated correctly.');
        } else {
            console.error('\n❌ Verification FAILED: data missing.');
        }

    } catch (error) {
        console.error('Error during test:', error);
    }
}

testStats();
