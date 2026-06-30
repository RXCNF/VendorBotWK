const knowledgeBase = require('../src/knowledgeBase');
const path = require('path');

(async () => {
    try {
        await knowledgeBase.loadCSV(path.join(__dirname, '../data/Data Vendor 051225_cleaned.csv'));

        console.log('\n=== Test 1: "di jatim ada vendor apa aja" ===');
        const result1 = knowledgeBase.getRelevantContext('di jatim ada vendor apa aja', 10);
        console.log('Total matches:', result1.totalMatches);
        console.log('Sample vendors:');
        result1.rows.slice(0, 5).forEach((v, i) => {
            console.log(`${i + 1}. ${v['NAMA VENDOR']} - ${v.PROVINSI}`);
        });

        console.log('\n=== Test 2: "vendor di jawa timur" ===');
        const result2 = knowledgeBase.getRelevantContext('vendor di jawa timur', 10);
        console.log('Total matches:', result2.totalMatches);
        console.log('Sample vendors:');
        result2.rows.slice(0, 5).forEach((v, i) => {
            console.log(`${i + 1}. ${v['NAMA VENDOR']} - ${v.PROVINSI}`);
        });

    } catch (error) {
        console.error('Error:', error.message);
    }
})();
