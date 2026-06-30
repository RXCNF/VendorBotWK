const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const inputPath = path.join(__dirname, 'Data Vendor 051225.csv');
const outputPath = path.join(__dirname, 'Data Vendor 051225_cleaned.csv');

async function cleanCSV() {
    console.log('🚀 Starting CSV cleanup (Stream Mode)...');

    if (!fs.existsSync(inputPath)) {
        console.error('❌ Input file not found:', inputPath);
        return;
    }

    const results = [];
    const writeStream = fs.createWriteStream(outputPath);

    // Header for cleaned file
    let headerWritten = false;

    fs.createReadStream(inputPath)
        .pipe(csv())
        .on('data', (row) => {
            // Check if significant data exists (skip empty rows)
            const vendorName = row['NAMA VENDOR'] || row['Nama Vendor'];
            if (vendorName && vendorName.trim().length > 0) {

                // 1. Normalize Provinsi (fix "DKI Jakarta Jakarta" -> "DKI Jakarta")
                if (row['PROVINSI']) {
                    let prov = row['PROVINSI'].trim();
                    // Fix specific cases or doubled words
                    const specificFixes = {
                        "DKI Jakarta Jakarta": "DKI Jakarta",
                        "Riau Riau": "Riau",
                        "Lampung Lampung": "Lampung",
                        "DI Aceh Aceh": "DI Aceh",
                        "DI Yogyakarta Yogyak": "DI Yogyakarta",
                        "DI Yogyakarta Yogyakarta": "DI Yogyakarta",
                        "Jawa Barat West Java": "Jawa Barat",
                        "Jawa Tengah Central": "Jawa Tengah",
                        "Jawa Timur East Java": "Jawa Timur",
                        "Sumatera Utara North": "Sumatera Utara",
                        "Sumatera Selatan Sou": "Sumatera Selatan",
                        "Banten Bante": "Banten",
                        "Sulawesi Tengah Cent": "Sulawesi Tengah",
                        "Sulawesi Selatan Sou": "Sulawesi Selatan",
                        "Kalimantan Selatan S": "Kalimantan Selatan",
                        "Kalimantan Timur Eas": "Kalimantan Timur"
                    };

                    if (specificFixes[prov]) {
                        prov = specificFixes[prov];
                    } else {
                        // General deduplication for simple doubled words
                        const words = prov.split(' ');
                        if (words.length >= 2 && words.length % 2 === 0) {
                            const mid = words.length / 2;
                            const firstHalf = words.slice(0, mid).join(' ');
                            const secondHalf = words.slice(mid).join(' ');
                            if (firstHalf.toLowerCase() === secondHalf.toLowerCase()) {
                                prov = firstHalf;
                            }
                        }
                    }
                    row['PROVINSI'] = prov;
                }

                // 2. Cleanup "UNKNOWN-DATA COMPLETE" in any column
                Object.keys(row).forEach(key => {
                    if (row[key] && row[key].toString().includes('UNKNOWN-DATA COMPLETE')) {
                        row[key] = row[key].toString().replace(/UNKNOWN-DATA COMPLETE/g, 'Tidak diketahui');
                    }
                });

                // Write to output
                const keys = Object.keys(row);
                if (!headerWritten) {
                    writeStream.write(keys.join(',') + '\n');
                    headerWritten = true;
                }

                // Simple CSV stringify (handling commas by quoting everything for safety)
                const values = keys.map(key => {
                    let val = String(row[key] || '').replace(/"/g, '""');
                    return `"${val}"`;
                });
                writeStream.write(values.join(',') + '\n');

                if (results.length % 10000 === 0 && results.length > 0) {
                    console.log(`⏳ Processed ${results.length} valid rows...`);
                }
                results.push(1);
            }
        })
        .on('end', () => {
            writeStream.end();
            console.log(`✅ Cleanup complete!`);
            console.log(`📊 Total valid records saved: ${results.length}`);
            console.log(`✨ Saved to: ${outputPath}`);
        })
        .on('error', (err) => {
            console.error('❌ Error during stream processing:', err);
        });
}

cleanCSV();
