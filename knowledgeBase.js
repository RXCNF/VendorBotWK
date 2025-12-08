// Knowledge Base Module untuk memproses dan mencari data dari CSV
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// In-memory storage untuk data CSV
let csvData = [];
let csvFilePath = null;
let lastModified = null;

// Fungsi untuk membaca dan memproses file CSV
function loadCSV(filePath) {
    return new Promise((resolve, reject) => {
        csvData = [];
        
        if (!fs.existsSync(filePath)) {
            return reject(new Error('File CSV tidak ditemukan'));
        }
        
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => {
                csvData.push(row);
            })
            .on('end', () => {
                csvFilePath = filePath;
                lastModified = fs.statSync(filePath).mtime;
                console.log(`✅ CSV loaded: ${csvData.length} rows from ${path.basename(filePath)}`);
                resolve(csvData);
            })
            .on('error', (error) => {
                reject(error);
            });
    });
}

// Fungsi untuk mencari data berdasarkan keyword
function searchByKeyword(query, limit = 10) {
    if (csvData.length === 0) {
        return [];
    }
    
    const queryLower = query.toLowerCase().trim();
    // Ambil semua kata, termasuk yang pendek (untuk "CV", "PT", dll)
    const keywords = queryLower.split(/\s+/).filter(k => k.length > 0);
    
    // Score setiap row berdasarkan jumlah keyword yang match
    const scoredResults = csvData.map(row => {
        let score = 0;
        // Gabungkan semua nilai dalam row menjadi string untuk pencarian
        const rowText = Object.values(row).join(' ').toLowerCase();
        
        keywords.forEach(keyword => {
            // Exact match mendapat score lebih tinggi
            if (rowText.includes(keyword)) {
                score += keyword.length > 2 ? 2 : 1; // Kata panjang mendapat score lebih tinggi
            }
            // Bonus untuk match di kolom Nama Vendor
            if (row['Nama Vendor'] && row['Nama Vendor'].toLowerCase().includes(keyword)) {
                score += 3; // Match di nama vendor mendapat score tertinggi
            }
        });
        
        return { row, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
    
    return scoredResults.map(item => item.row);
}

// Fungsi untuk mencari data berdasarkan kolom spesifik
function searchByColumn(columnName, value, limit = 10) {
    if (csvData.length === 0) {
        return [];
    }
    
    const valueLower = value.toLowerCase();
    const results = csvData
        .filter(row => {
            const cellValue = String(row[columnName] || '').toLowerCase();
            return cellValue.includes(valueLower);
        })
        .slice(0, limit);
    
    return results;
}

// Fungsi untuk mendapatkan semua kolom yang ada
function getColumns() {
    if (csvData.length === 0) {
        return [];
    }
    
    return Object.keys(csvData[0]);
}

// Fungsi untuk mendapatkan konteks relevan berdasarkan query
function getRelevantContext(query, maxRows = 10) {
    if (csvData.length === 0) {
        return null;
    }
    
    const queryLower = query.toLowerCase().trim();
    
    // Cari data yang relevan dengan berbagai metode
    let relevantData = searchByKeyword(query, maxRows);
    
    // Jika tidak ada hasil, coba pencarian lebih agresif
    if (relevantData.length === 0) {
        // Split query menjadi kata-kata individual dan cari partial match
        const queryWords = queryLower.split(/\s+/).filter(w => w.length > 0);
        
        relevantData = csvData.filter(row => {
            const rowText = Object.values(row).join(' ').toLowerCase();
            // Cek apakah minimal satu kata dari query ada di row
            return queryWords.some(word => rowText.includes(word));
        }).slice(0, maxRows);
    }
    
    // Jika masih tidak ada, coba cari dengan substring matching
    if (relevantData.length === 0 && queryLower.length >= 3) {
        relevantData = csvData.filter(row => {
            const rowText = Object.values(row).join(' ').toLowerCase();
            // Cek substring dari query (minimal 3 karakter)
            for (let i = 0; i <= queryLower.length - 3; i++) {
                const substr = queryLower.substring(i, i + 3);
                if (rowText.includes(substr)) {
                    return true;
                }
            }
            return false;
        }).slice(0, maxRows);
    }
    
    // Jika masih tidak ada hasil spesifik, return semua data untuk memastikan AI punya akses
    if (relevantData.length === 0) {
        console.log(`⚠️  No relevant data found for "${query}", returning all ${csvData.length} rows`);
        return csvData; // Return semua data agar AI punya akses
    }
    
    console.log(`✅ Found ${relevantData.length} relevant rows for query: "${query}"`);
    // Log beberapa hasil untuk debugging
    if (relevantData.length > 0) {
        console.log('   Sample matches:', relevantData.slice(0, 3).map(r => r['Nama Vendor'] || 'N/A'));
    }
    
    return relevantData;
}

// Fungsi untuk memformat data CSV menjadi teks untuk context
function formatDataForContext(data) {
    if (!data || data.length === 0) {
        return '';
    }
    
    const columns = Object.keys(data[0]);
    let formatted = `DATA VENDOR DARI KNOWLEDGE BASE (Total: ${data.length} vendor):\n\n`;
    
    data.forEach((row, index) => {
        formatted += `VENDOR ${index + 1}:\n`;
        columns.forEach(col => {
            if (row[col] && row[col].trim()) {
                formatted += `${col}: ${row[col]}\n`;
            }
        });
        formatted += '\n';
    });
    
    formatted += 'INSTRUKSI: Data di atas adalah data vendor yang tersedia. Jika user bertanya tentang vendor tertentu, CARI nama vendor tersebut di data di atas dan berikan semua informasi yang ada. JANGAN katakan bahwa Anda tidak memiliki informasi jika vendor tersebut ada di data di atas.';
    
    return formatted;
}

// Fungsi untuk check apakah CSV perlu di-reload
function shouldReloadCSV() {
    if (!csvFilePath || !fs.existsSync(csvFilePath)) {
        return false;
    }
    
    const currentModified = fs.statSync(csvFilePath).mtime;
    return currentModified > lastModified;
}

// Auto-reload jika file berubah
function autoReload() {
    if (shouldReloadCSV()) {
        console.log('🔄 CSV file updated, reloading...');
        loadCSV(csvFilePath).catch(err => {
            console.error('Error reloading CSV:', err);
        });
    }
}

// Check setiap 30 detik
setInterval(autoReload, 30000);

module.exports = {
    loadCSV,
    searchByKeyword,
    searchByColumn,
    getColumns,
    getRelevantContext,
    formatDataForContext,
    getData: () => csvData,
    hasData: () => csvData.length > 0,
    getStats: () => ({
        rowCount: csvData.length,
        columns: csvData.length > 0 ? Object.keys(csvData[0]) : [],
        lastModified: lastModified,
        filePath: csvFilePath
    })
};

