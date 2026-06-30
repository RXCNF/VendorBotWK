// Script untuk generate Q&A dataset dari data vendor CSV
// Menggunakan batch processing untuk handle data besar
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
require('dotenv').config();

const BATCH_SIZE = 1000; // Process 1000 vendors per batch
const OUTPUT_FILE = path.join(__dirname, 'vendor_qa_dataset.csv');

// Generate Q&A dari data vendor
function generateQAFromVendor(vendor) {
    const qaPairs = [];
    const vendorName = vendor['NAMA VENDOR'] || vendor['Nama Vendor'] || '';

    if (!vendorName || !vendorName.trim()) {
        return qaPairs; // Skip jika tidak ada nama vendor
    }

    // Question 1: Informasi umum tentang vendor
    const question1 = `Siapa ${vendorName}?`;
    let answer1 = `${vendorName} adalah vendor`;
    const parts = [];
    if (vendor['KUALIFIKASI PERUSAHAAN']) parts.push(`berkualifikasi ${vendor['KUALIFIKASI PERUSAHAAN']}`);
    if (vendor['STATUS REKANAN']) parts.push(`dengan status ${vendor['STATUS REKANAN']}`);
    if (vendor['BIDANG USAHA']) parts.push(`di bidang ${vendor['BIDANG USAHA']}`);
    if (vendor['PROVINSI']) parts.push(`berlokasi di ${vendor['PROVINSI']}`);
    if (parts.length > 0) {
        answer1 += ' ' + parts.join(', ') + '.';
    } else {
        answer1 += '.';
    }
    if (vendor['CQSMS VENDOR']) answer1 += ` Status CQSMS: ${vendor['CQSMS VENDOR']}.`;
    if (vendor['INDUSTRY KEY']) answer1 += ` Industry: ${vendor['INDUSTRY KEY']}.`;
    if (vendor['KODE SUBKLASIFIKASI SBU']) answer1 += ` Kode SBU: ${vendor['KODE SUBKLASIFIKASI SBU']}.`;

    qaPairs.push({ question: question1, answer: answer1 });

    // Question 2: Status rekanan
    if (vendor['STATUS REKANAN']) {
        qaPairs.push({
            question: `Apa status rekanan ${vendorName}?`,
            answer: `${vendorName} memiliki status rekanan ${vendor['STATUS REKANAN']}.`
        });
    }

    // Question 3: Bidang usaha
    if (vendor['BIDANG USAHA']) {
        qaPairs.push({
            question: `Apa bidang usaha ${vendorName}?`,
            answer: `${vendorName} bergerak di bidang ${vendor['BIDANG USAHA']}.`
        });
    }

    // Question 4: Lokasi/Provinsi
    if (vendor['PROVINSI']) {
        qaPairs.push({
            question: `Dimana lokasi ${vendorName}?`,
            answer: `${vendorName} berlokasi di ${vendor['PROVINSI']}.`
        });
    }

    // Question 5: CQSMS Vendor
    if (vendor['CQSMS VENDOR']) {
        qaPairs.push({
            question: `Apa status CQSMS ${vendorName}?`,
            answer: `${vendorName} memiliki status CQSMS: ${vendor['CQSMS VENDOR']}.`
        });
    }

    // Question 6: Industry Key
    if (vendor['INDUSTRY KEY']) {
        qaPairs.push({
            question: `Apa industry key ${vendorName}?`,
            answer: `${vendorName} memiliki industry key: ${vendor['INDUSTRY KEY']}.`
        });
    }

    // Question 7: Kualifikasi perusahaan
    if (vendor['KUALIFIKASI PERUSAHAAN']) {
        qaPairs.push({
            question: `Apa kualifikasi perusahaan ${vendorName}?`,
            answer: `${vendorName} memiliki kualifikasi ${vendor['KUALIFIKASI PERUSAHAAN']}.`
        });
    }

    // Question 8: Pencarian dengan nama vendor
    qaPairs.push({
        question: `Cari vendor ${vendorName}`,
        answer: answer1
    });

    // Question 9: Informasi lengkap
    qaPairs.push({
        question: `Berikan informasi lengkap tentang ${vendorName}`,
        answer: answer1
    });

    return qaPairs;
}

// Process CSV in batches
async function generateQADataset(csvPath) {
    return new Promise((resolve, reject) => {
        let totalQACount = 0;
        let processedCount = 0;
        let batchCount = 0;

        console.log(`🔄 Processing CSV file: ${csvPath}`);
        console.log(`📦 Batch size: ${BATCH_SIZE} vendors`);

        const writeStream = fs.createWriteStream(OUTPUT_FILE);
        writeStream.write('Pertanyaan,Jawaban\n'); // CSV header

        fs.createReadStream(csvPath)
            .pipe(csv())
            .on('data', (row) => {
                // Preprocessing: Ganti UNKNOWN-DATA COMPLETE dengan "Tidak diketahui" agar lebih profesional
                Object.keys(row).forEach(key => {
                    if (row[key] && row[key].toString().includes('UNKNOWN-DATA COMPLETE')) {
                        row[key] = row[key].toString().replace(/UNKNOWN-DATA COMPLETE/g, 'Tidak diketahui');
                    }
                });

                const qaPairs = generateQAFromVendor(row);

                // Write to file immediately (streaming)
                qaPairs.forEach(qa => {
                    // Escape CSV special characters
                    const question = `"${qa.question.replace(/"/g, '""')}"`;
                    const answer = `"${qa.answer.replace(/"/g, '""')}"`;
                    writeStream.write(`${question},${answer}\n`);
                });

                // Track counts only, don't keep objects in memory
                processedCount++;
                const qaCount = qaPairs.length;
                totalQACount += qaCount;

                // Log progress setiap batch
                if (processedCount % BATCH_SIZE === 0) {
                    batchCount++;
                    console.log(`✅ Processed batch ${batchCount}: ${processedCount} vendors, ${totalQACount} Q&A pairs generated`);

                    // Force garbage collection if available
                    if (global.gc) global.gc();
                }
            })
            .on('end', () => {
                writeStream.end();
                console.log(`\n✅ Q&A Dataset generation completed!`);
                console.log(`   📊 Total vendors processed: ${processedCount}`);
                console.log(`   📝 Total Q&A pairs generated: ${totalQACount}`);
                console.log(`   💾 Output file: ${OUTPUT_FILE}`);
                resolve({ vendors: processedCount, qaPairs: totalQACount });
            })
            .on('error', (error) => {
                writeStream.end();
                reject(error);
            });
    });
}

// Main execution
async function main() {
    // Check multiple possible locations for the source CSV
    const possiblePaths = [
        process.env.CSV_FILE_PATH,
        path.join(__dirname, 'Data Vendor 051225.csv'),
        path.join(__dirname, 'uploads', 'knowledge_base.csv')
    ].filter(p => p && fs.existsSync(p));

    if (possiblePaths.length === 0) {
        console.error(`❌ File CSV sumber tidak ditemukan di lokasi manapun.`);
        console.log('Dicoba mencari di:');
        console.log(`- ${path.join(__dirname, 'Data Vendor 051225.csv')}`);
        console.log(`- ${path.join(__dirname, 'uploads', 'knowledge_base.csv')}`);
        process.exit(1);
    }

    const csvPath = possiblePaths[0]; // Use the first one found

    try {
        console.log(`🚀 Starting Q&A Dataset Generation using: ${csvPath}\n`);
        await generateQADataset(csvPath);
        console.log('\n✨ Done! Q&A dataset siap digunakan untuk RAG.');
    } catch (error) {
        console.error('❌ Error generating Q&A dataset:', error);
        process.exit(1);
    }
}

// Run if executed directly
if (require.main === module) {
    main();
}

module.exports = { generateQADataset, generateQAFromVendor };

