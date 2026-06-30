const knowledgeBase = require('./src/knowledgeBase');

(async () => {
    try {
        await knowledgeBase.loadCSV('./data/Data Vendor 051225_cleaned.csv');

        console.log('\n=== Test 1: "vendor di lamongan" (City Detection) ===');
        const result1 = knowledgeBase.getRelevantContext('vendor di lamongan', 10);
        console.log('Total matches:', result1.totalMatches);
        if (result1.rows && result1.rows.length > 0) {
            console.log('Sample vendors:');
            result1.rows.slice(0, 5).forEach((v, i) => {
                console.log(`${i + 1}. ${v['NAMA VENDOR']} - ${v.PROVINSI}`);
            });
        } else {
            console.log('❌ No results found!');
        }

        console.log('\n=== Test 2: "vendor di surabaya" (City Detection) ===');
        const result2 = knowledgeBase.getRelevantContext('vendor di surabaya', 10);
        console.log('Total matches:', result2.totalMatches);
        if (result2.rows && result2.rows.length > 0) {
            console.log('Sample vendors:');
            result2.rows.slice(0, 5).forEach((v, i) => {
                console.log(`${i + 1}. ${v['NAMA VENDOR']} - ${v.PROVINSI}`);
            });
        } else {
            console.log('❌ No results found!');
        }

        console.log('\n=== Test 3: "di jatim ada vendor apa aja" (Province Alias) ===');
        const result3 = knowledgeBase.getRelevantContext('di jatim ada vendor apa aja', 10);
        console.log('Total matches:', result3.totalMatches);
        if (result3.rows && result3.rows.length > 0) {
            console.log('Sample vendors:');
            result3.rows.slice(0, 3).forEach((v, i) => {
                console.log(`${i + 1}. ${v['NAMA VENDOR']} - ${v.PROVINSI}`);
            });
        }

    } catch (error) {
        console.error('Error:', error.message);
        console.error(error.stack);
    }
})();
