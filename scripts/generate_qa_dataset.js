const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const SOURCE_CSV = 'Data Vendor 051225_cleaned.csv';
const OUTPUT_CSV = 'vendor_qa_dataset.csv';

async function generate() {
    console.log(`🚀 Generating Q&A dataset from ${SOURCE_CSV}...`);

    const rows = [];
    if (!fs.existsSync(SOURCE_CSV)) {
        console.error('❌ Source CSV not found');
        return;
    }

    const stream = fs.createReadStream(SOURCE_CSV).pipe(csv({
        mapHeaders: ({ header }) => header.replace(/^\uFEFF/, '').trim()
    }));

    stream.on('data', (row) => rows.push(row));

    stream.on('end', () => {
        try {
            console.log(`✅ Loaded ${rows.length} rows. Generating QA pairs...`);

            const qaPairs = [];

            rows.forEach(row => {
                const name = (row['NAMA VENDOR'] || 'Vendor').trim();
                const status = (row['STATUS REKANAN'] || 'Tidak diketahui').trim();
                const industry = (row['BIDANG USAHA'] || 'Tidak diketahui').trim();
                const province = (row['PROVINSI'] || 'Tidak diketahui').trim();
                const industryKey = (row['INDUSTRY KEY'] || 'Tidak diketahui').trim();
                const kualifikasi = (row['KUALIFIKASI PERUSAHAAN'] || 'Tidak diketahui').trim();
                const sbu = (row['KODE SUBKLASIFIKASI SBU'] || 'Tidak diketahui').trim();

                if (name && name !== 'NAMA VENDOR') {
                    // 1. General info
                    qaPairs.push({
                        Pertanyaan: `Siapa ${name}?`,
                        Jawaban: `${name} adalah vendor dengan status ${status}, kualifikasi ${kualifikasi}, di bidang ${industry}, berlokasi di ${province}. Kode SBU: ${sbu}.`
                    });

                    // 2. Status
                    qaPairs.push({
                        Pertanyaan: `Bagaimana status rekanan ${name}?`,
                        Jawaban: `${name} memiliki status rekanan ${status}.`
                    });

                    // 3. Bidang Usaha
                    qaPairs.push({
                        Pertanyaan: `Apa bidang usaha ${name}?`,
                        Jawaban: `${name} bergerak di bidang ${industry} (${industryKey}).`
                    });

                    // 4. Lokasi
                    qaPairs.push({
                        Pertanyaan: `Dimana lokasi atau provinsi ${name}?`,
                        Jawaban: `${name} berlokasi di ${province}.`
                    });

                    // 5. Kualifikasi
                    qaPairs.push({
                        Pertanyaan: `Apa kualifikasi perusahaan untuk ${name}?`,
                        Jawaban: `Kualifikasi perusahaan ${name} adalah ${kualifikasi}.`
                    });
                }
            });

            console.log(`📝 Generated ${qaPairs.length} pairs. Writing to file...`);

            // Write to CSV
            const header = 'Pertanyaan,Jawaban\n';
            const content = qaPairs.map(p => {
                const q = `"${p.Pertanyaan.replace(/"/g, '""')}"`;
                const a = `"${p.Jawaban.replace(/"/g, '""')}"`;
                return `${q},${a}`;
            }).join('\n');

            fs.writeFileSync(OUTPUT_CSV, header + content);
            console.log(`✨ DONE! Generated ${qaPairs.length} Q&A pairs in ${OUTPUT_CSV}`);
        } catch (e) {
            console.error('❌ Error during generation:', e.message);
        }
    });
}

generate();
