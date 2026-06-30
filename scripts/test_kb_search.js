const knowledgeBase = require('./src/knowledgeBase');
const path = require('path');

async function testSearch() {
    const csvPath = path.join(__dirname, 'data/Data Vendor 051225_cleaned.csv');
    await knowledgeBase.loadCSV(csvPath);

    const query = "beton di jakarta";
    const result = knowledgeBase.getRelevantContext(query, 100);

    if (result && result.rows) {
        console.log(`Query: "${query}"`);
        console.log(`Total Matches: ${result.totalMatches}`);
        console.log(`Rows Found: ${result.rows.length}`);
        console.log('Vendors:');
        result.rows.forEach(r => {
            console.log(`- ${r['NAMA VENDOR']} (Prov: ${r['PROVINSI']})`);
            // We can't easily see the score from getRelevantContext as it doesn't return it, 
            // but we can re-run searchByKeyword for debugging.
        });

        console.log('\n--- Debugging searchByKeyword scores ---');
        const searchKeywords = ["beton", "ready", "mix"];
        result.rows.forEach(row => {
            const rowText = row._searchString;
            let details = [];
            searchKeywords.forEach(kw => {
                const kwRegex = new RegExp(`\\b${kw}\\b`, 'i');
                if (kwRegex.test(rowText)) details.push(`${kw}(word)`);
                else if (rowText.includes(kw)) details.push(`${kw}(sub)`);
            });
            console.log(`${row['NAMA VENDOR']}: ${details.join(', ')}`);
        });
    } else {
        console.log('No results found.');
    }
}

testSearch();
