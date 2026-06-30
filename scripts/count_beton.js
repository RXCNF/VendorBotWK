const fs = require('fs');
const readline = require('readline');

async function countVendors() {
    const fileStream = fs.createReadStream('d:\\Project\\VendorBot\\data\\Data Vendor 051225_cleaned.csv');
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let count = 0;
    let header = null;
    let results = [];

    for await (const line of rl) {
        if (!header) {
            header = line.split(',');
            continue;
        }

        // Simple CSV parser for quoted fields
        const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        if (!matches) continue;

        // Match indexes based on header:
        // KUALIFIKASI PERUSAHAAN (0), NAMA VENDOR (1), STATUS REKANAN (2), BIDANG USAHA (3), CQSMS VENDOR (4), PROVINSI (5), INDUSTRY KEY (6), KODE SUBKLASIFIKASI SBU (7)

        // The regex above might be slightly off for empty fields. 
        // Let's use a more robust split for this specific CSV structure.
        const cols = line.split(',').map(c => c.replace(/"/g, '').trim());

        if (cols.length < 7) continue;

        const namaVendor = cols[1] ? cols[1].toLowerCase() : '';
        const provinsi = cols[5] ? cols[5].toLowerCase() : '';
        const industryKey = cols[6] ? cols[6].toLowerCase() : '';

        if (provinsi.includes('jakarta') && (namaVendor.includes('beton') || industryKey.includes('beton'))) {
            count++;
            results.push(cols[1]);
        }
    }

    console.log(`Total Beton Vendors in Jakarta: ${count}`);
    console.log('Vendors:');
    results.forEach(v => console.log(`- ${v}`));
}

countVendors();
