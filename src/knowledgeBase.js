// Knowledge Base Module untuk memproses dan mencari data dari CSV
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// In-memory storage untuk data CSV
let csvData = [];
let csvFilePath = null;
let lastModified = null;
let provinceStats = {};
let provinceStatsText = '';

// Fungsi untuk menghitung jarak Levenshtein (Fuzzy Match)
function levenshtein(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

// Fungsi untuk membaca dan memproses file CSV
function loadCSV(filePath) {
    return new Promise((resolve, reject) => {
        csvData = [];

        if (!fs.existsSync(filePath)) {
            return reject(new Error('File CSV tidak ditemukan'));
        }

        fs.createReadStream(filePath)
            .pipe(csv({
                mapHeaders: ({ header }) => header.trim().replace(/^\ufeff/, '')
            }))
            .on('data', (row) => {
                // Preprocessing: Ganti UNKNOWN-DATA COMPLETE dengan "Tidak diketahui"
                Object.keys(row).forEach(key => {
                    if (row[key] && row[key].toString().includes('UNKNOWN-DATA COMPLETE')) {
                        row[key] = row[key].toString().replace(/UNKNOWN-DATA COMPLETE/g, 'Tidak diketahui');
                    }
                });

                // OPTIMIZATION: Pre-calculate search string to avoid repetitive joining/lowercasing
                // Construct string from important columns first (Name, Business Field, etc.) for better relevance
                // Hidden property non-enumerable if possible, but for simplicity just a property
                row._searchString = Object.values(row).join(' ').toLowerCase();

                csvData.push(row);
            })
            .on('end', () => {
                csvFilePath = filePath;
                lastModified = fs.statSync(filePath).mtime;

                // Calculate Province Stats
                provinceStats = {};
                csvData.forEach(row => {
                    const prov = (row['PROVINSI'] || 'Tidak Diketahui').toUpperCase().trim();
                    provinceStats[prov] = (provinceStats[prov] || 0) + 1;
                });

                // Format textual summary for LLM
                // Sort by count desc
                const sortedProvinces = Object.entries(provinceStats)
                    .sort(([, a], [, b]) => b - a);

                provinceStatsText = sortedProvinces
                    .map(([prov, count]) => `- ${prov}: ${count} vendor`)
                    .join('\n');

                console.log(`✅ CSV loaded: ${csvData.length} rows from ${path.basename(filePath)}`);
                console.log(`📊 Province Stats Calculated: ${sortedProvinces.length} regions.`);
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
    // Stop words yang sering muncul dan tidak relevan untuk pencarian
    const stopWords = new Set([
        'di', 'yang', 'ada', 'dan', 'siapa', 'apa', 'mana', 'itu', 'ini',
        'sebutkan', 'tampilkan', 'berikan', 'daftar', 'list', 'dari', 'ke', 'dengan',
        'total', 'jumlah', 'berapa', 'anda', 'kamu', 'saya', 'yakin', 'hanya', 'kabar', 'gimana', 'woi', 'oy',
        // Common context words to ignore
        'vendor', 'penyedia', 'sediakan', 'menyediakan', 'ingin', 'mau', 'tahu', 'tolong', 'cari', 'carikan', 'terkait', 'tentang', 'perusahaan', 'pt', 'cv', 'dki', 'daerah', 'istimewa'
    ]);

    // Ambil semua kata, saring stop words (kecilkan noise)
    let keywords = queryLower.split(/\s+/).filter(k => k.length > 0 && !stopWords.has(k));

    // Synonym expansion
    if (keywords.includes('beton')) {
        // Jika user mencari beton, pastikan "ready mix" juga diprioritaskan
        if (!keywords.includes('ready')) keywords.push('ready');
        if (!keywords.includes('mix')) keywords.push('mix');
    } else if (keywords.includes('ready') && keywords.includes('mix')) {
        // Sebaliknya, jika mencari ready mix, pastikan "beton" juga masuk
        if (!keywords.includes('beton')) keywords.push('beton');
    }

    // Jika setelah disaring tidak ada sisa, gunakan query asli
    const searchKeywords = keywords.length > 0 ? keywords : [queryLower];
    // Pattern for SBU Code (e.g., BS010, BG002) - 2 letters followed by 3 digits
    const sbuPattern = /^[a-z]{2}[0-9]{3}$/i;

    // Score setiap row berdasarkan jumlah keyword yang match
    const scoredResults = csvData.map(row => {
        let score = 0;
        // Use pre-calculated search string
        const rowText = row._searchString;

        searchKeywords.forEach(keyword => {
            // Check if keyword matches SBU pattern
            const isSbuCode = sbuPattern.test(keyword);

            // Exact match mendapat score lebih tinggi
            // Gunakan Regex Word Boundary untuk menghindari false match (misal: "mix" match di "hotmix")
            const keywordRegex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');


            if (keywordRegex.test(rowText)) {
                score += keyword.length > 2 ? 10 : 5; // Increased bonus for word-boundary match
            } else if (rowText.includes(keyword) && keyword.length > 3) {
                // Hanya izinkan substring match untuk kata yang cukup panjang (>3 karakter)
                score += 1;
            }

            // Bonus untuk match di kolom KODE SUBKLASIFIKASI SBU
            const sbuCode = (row['KODE SUBKLASIFIKASI SBU'] || '').toLowerCase();
            if (sbuCode && sbuCode === keyword) {
                score += 20; // High bonus for exact SBU code match
            } else if (sbuCode && sbuCode.includes(keyword)) {
                score += isSbuCode ? 10 : 2; // Moderate bonus if keyword looks like SBU code
            }

            // Bonus untuk match di kolom Nama Vendor (support kolom baru dan lama)
            const vendorName = (row['NAMA VENDOR'] || row['Nama Vendor'] || '').toLowerCase();
            if (vendorName) {
                if (keywordRegex.test(vendorName)) {
                    score += 15; // Match di nama vendor (word boundary) mendapat score tinggi
                    if (vendorName === keyword) score += 10; // Extra bonus for exact name match
                } else if (vendorName.includes(keyword) && keyword.length > 3) {
                    score += 5;
                }
            }

            // Bonus untuk match di kolom INDUSTRY KEY
            const industryKey = (row['INDUSTRY KEY'] || '').toLowerCase();
            if (industryKey) {
                if (keywordRegex.test(industryKey)) {
                    score += 10; // Match di industry key (word boundary) mendapat bonus score
                } else if (industryKey.includes(keyword) && keyword.length > 3) {
                    score += 2;
                }
            }

            // FUZZY MATCH: Jika tidak ada exact match, coba fuzzy search (Levenshtein)
            // Hanya untuk keyword yang cukup panjang (> 3 karakter)
            if (keyword.length > 3 && !keywordRegex.test(rowText)) {
                const words = rowText.split(/\s+/);
                words.forEach(word => {
                    if (word.length > 3) {
                        const dist = levenshtein(keyword, word);
                        // Toleransi: 1 typo untuk kata pendek, 2 typo untuk kata panjang
                        const threshold = word.length > 6 ? 2 : 1;
                        if (dist <= threshold) {
                            score += (threshold - dist + 1); // Bonus kecil untuk fuzzy match
                        }
                    }
                });
            }
        });

        return { row, score };
    })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score);

    // Retrieve all matches first
    const allMatches = scoredResults.map(item => item.row);

    // Allow limiting, but if limit is -1 or null, return all
    if (limit && limit > 0) {
        return allMatches.slice(0, limit);
    }
    return allMatches;
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

    // Deteksi apakah ini pertanyaan list/filter (perlu lebih banyak hasil)
    const isListQuery = /(list|daftar|apa aja|siapa aja|berapa|berapa banyak|vendor yang|vendor di|vendor dengan|vendor status|semua vendor|cari vendor|ada berapa|sebutkan)/i.test(queryLower);

    // Untuk pertanyaan list/filter, gunakan maxRows yang lebih besar (50-100)
    // Tapi tetap batasi untuk menghindari token limit
    const effectiveMaxRows = isListQuery ? Math.min(maxRows * 5, 100) : maxRows;

    // --- PROVINCE DETECTION & STRIPPING ---
    // Added 'dki' to regex, REMOVED 'di' to avoid false positive with preposition
    const provinceRegex = /\b(dki|jakarta|jawa|sumatera|kalimantan|sulawesi|bali|papua|ntt|nz|nusa tenggara|aceh|riau|sumut|sumsel|jabar|jateng|jatim|yogyakarta|jogja|banten|kepulauan|maluku)\b/ig;

    let provinsiMatch = queryLower.match(provinceRegex);
    let searchInterfaceQuery = queryLower;

    // Province alias mapping - map short forms to full names or expanded search terms
    const provinceAliasMap = {
        'jatim': 'jawa timur',
        'jabar': 'jawa barat',
        'jateng': 'jawa tengah',
        'sumut': 'sumatera utara',
        'sumsel': 'sumatera selatan',
        'kalbar': 'kalimantan barat',
        'kaltim': 'kalimantan timur',
        'kalteng': 'kalimantan tengah',
        'kalsel': 'kalimantan selatan',
        'sulut': 'sulawesi utara',
        'sulsel': 'sulawesi selatan',
        'sulteng': 'sulawesi tengah',
        'ntt': 'nusa tenggara timur',
        'ntb': 'nusa tenggara barat'
    };

    // City/Kabupaten to Province mapping - for smarter location understanding
    // Bot can understand queries like "vendor di Lamongan" and know it's in Jawa Timur
    const cityToProvinceMap = {
        // Jawa Timur
        'surabaya': 'jawa timur', 'malang': 'jawa timur', 'kediri': 'jawa timur', 'probolinggo': 'jawa timur',
        'madiun': 'jawa timur', 'jember': 'jawa timur', 'pasuruan': 'jawa timur', 'blitar': 'jawa timur',
        'mojokerto': 'jawa timur', 'banyuwangi': 'jawa timur', 'gresik': 'jawa timur', 'sidoarjo': 'jawa timur',
        'lamongan': 'jawa timur', 'tuban': 'jawa timur', 'lumajang': 'jawa timur', 'bondowoso': 'jawa timur',
        'situbondo': 'jawa timur', 'ngawi': 'jawa timur', 'magetan': 'jawa timur', 'ponorogo': 'jawa timur',
        'pacitan': 'jawa timur', 'trenggalek': 'jawa timur', 'tulungagung': 'jawa timur', 'bojonegoro': 'jawa timur',
        'nganjuk': 'jawa timur', 'jombang': 'jawa timur', 'sampang': 'jawa timur', 'pamekasan': 'jawa timur',
        'sumenep': 'jawa timur', 'bangkalan': 'jawa timur',

        // Jawa Barat
        'bandung': 'jawa barat', 'bekasi': 'jawa barat', 'bogor': 'jawa barat', 'depok': 'jawa barat',
        'cirebon': 'jawa barat', 'tasikmalaya': 'jawa barat', 'sukabumi': 'jawa barat', 'cimahi': 'jawa barat',
        'banjar': 'jawa barat', 'garut': 'jawa barat', 'ciamis': 'jawa barat', 'kuningan': 'jawa barat',
        'majalengka': 'jawa barat', 'sumedang': 'jawa barat', 'indramayu': 'jawa barat', 'subang': 'jawa barat',
        'purwakarta': 'jawa barat', 'karawang': 'jawa barat', 'cianjur': 'jawa barat', 'pangandaran': 'jawa barat',

        // Jawa Tengah
        'semarang': 'jawa tengah', 'solo': 'jawa tengah', 'surakarta': 'jawa tengah', 'salatiga': 'jawa tengah',
        'tegal': 'jawa tengah', 'pekalongan': 'jawa tengah', 'magelang': 'jawa tengah', 'purwokerto': 'jawa tengah',
        'banyumas': 'jawa tengah', 'cilacap': 'jawa tengah', 'kebumen': 'jawa tengah', 'purworejo': 'jawa tengah',
        'wonosobo': 'jawa tengah', 'temanggung': 'jawa tengah', 'kendal': 'jawa tengah', 'batang': 'jawa tengah',
        'pekalongan': 'jawa tengah', 'pemalang': 'jawa tengah', 'brebes': 'jawa tengah', 'boyolali': 'jawa tengah',
        'klaten': 'jawa tengah', 'wonogiri': 'jawa tengah', 'karanganyar': 'jawa tengah', 'sragen': 'jawa tengah',
        'sukoharjo': 'jawa tengah', 'blora': 'jawa tengah', 'rembang': 'jawa tengah', 'pati': 'jawa tengah',
        'kudus': 'jawa tengah', 'jepara': 'jawa tengah', 'demak': 'jawa tengah', 'grobogan': 'jawa tengah',

        // DKI Jakarta
        'jakarta': 'dki jakarta', 'jakarta pusat': 'dki jakarta', 'jakarta utara': 'dki jakarta',
        'jakarta selatan': 'dki jakarta', 'jakarta barat': 'dki jakarta', 'jakarta timur': 'dki jakarta',
        'kepulauan seribu': 'dki jakarta',

        // Banten
        'tangerang': 'banten', 'serang': 'banten', 'cilegon': 'banten', 'lebak': 'banten',
        'pandeglang': 'banten', 'tangerang selatan': 'banten',

        // Sumatera Utara
        'medan': 'sumatera utara', 'pematangsiantar': 'sumatera utara', 'sibolga': 'sumatera utara',
        'tanjungbalai': 'sumatera utara', 'binjai': 'sumatera utara', 'tebing tinggi': 'sumatera utara',
        'padangsidimpuan': 'sumatera utara', 'deli serdang': 'sumatera utara', 'langkat': 'sumatera utara',

        // Sumatera Selatan
        'palembang': 'sumatera selatan', 'prabumulih': 'sumatera selatan', 'lubuklinggau': 'sumatera selatan',
        'pagar alam': 'sumatera selatan', 'ogan komering ulu': 'sumatera selatan',

        // Add more as needed - this covers major cities
    };


    // --- CITY DETECTION & EXPANSION ---
    // Check if query contains a city name, expand to province for better matching
    let detectedCity = null;
    let expandedProvince = null;

    // Only check cities if no province was detected
    if (!provinsiMatch) {
        for (const [city, province] of Object.entries(cityToProvinceMap)) {
            const cityRegex = new RegExp(`\\b${city}\\b`, 'i');
            if (cityRegex.test(queryLower)) {
                detectedCity = city;
                expandedProvince = province;
                console.log(`🏙️  City detected: "${city}" → Expanding to province: "${province}"`);

                // Remove city name from search query
                searchInterfaceQuery = queryLower.replace(cityRegex, '').replace(/\bdi\b/g, '').trim();

                // Create a fake provinsiMatch to trigger province filtering
                provinsiMatch = [province];
                break;
            }
        }
    }

    if (provinsiMatch && !expandedProvince) {
        // Remove province name from query so it doesn't pollute keyword search
        // We use a regex to remove only the word, keeping the rest
        searchInterfaceQuery = queryLower.replace(provinceRegex, '').replace(/\bdi\b/g, '').trim();
        console.log(`📍 Province detected: ${provinsiMatch[0]}. Keyword query refined to: "${searchInterfaceQuery}"`);
    }

    // Cari data yang relevan dengan berbagai metode (Unlimitted first to get count)
    // If searchInterfaceQuery becomes empty (e.g., query was just "Jakarta"), return all from that province
    let relevantData = [];
    if (searchInterfaceQuery.length > 0) {
        relevantData = searchByKeyword(searchInterfaceQuery, -1);
    }

    // Apply Province Filter (Strictly)
    if (provinsiMatch) {
        let provinsi = provinsiMatch[0].toLowerCase();

        // Check if it's an alias and expand it (but not if it's already expanded from city)
        if (!expandedProvince && provinceAliasMap[provinsi]) {
            const expanded = provinceAliasMap[provinsi];
            console.log(`🔄 Expanding province alias: "${provinsi}" -> "${expanded}"`);
            provinsi = expanded;
        }

        if (relevantData.length > 0) {
            // Filter keyword matches by province
            const intersected = relevantData.filter(row => {
                const provVal = (row['PROVINSI'] || '').toLowerCase();
                return provVal.includes(provinsi);
            });

            if (intersected.length > 0) {
                relevantData = intersected;
                console.log(`✅ Intersected ${relevantData.length} keyword matches with province ${provinsi}`);
            } else {
                console.log(`⚠️  Keywords "${searchInterfaceQuery}" found results, but none in ${provinsi}. Showing all matching province.`);
                // Fallback: finding all in province if keyword intersection fails (behavioral choice)
                relevantData = csvData.filter(row => {
                    const provVal = (row['PROVINSI'] || '').toLowerCase();
                    return provVal.includes(provinsi);
                });
            }
        } else {
            // No keyword matches or searchInterfaceQuery was empty
            relevantData = csvData.filter(row => {
                const provVal = (row['PROVINSI'] || '').toLowerCase();
                return provVal.includes(provinsi);
            });
            console.log(`📍 Found ${relevantData.length} vendors in province ${provinsi} (no keyword search)`);
        }
    }

    // Jika tidak ada hasil dan tidak ada provinsi, coba pencarian lebih agresif (Partial)
    if (relevantData.length === 0 && !provinsiMatch) {
        // Split query menjadi kata-kata individual dan cari partial match
        // GUNAKAN STOPWORDS untuk menghindari match kata umum seperti "apa", "di"
        // Use SAME stopwords list as above
        const stopWords = new Set([
            'di', 'yang', 'ada', 'dan', 'siapa', 'apa', 'mana', 'itu', 'ini',
            'sebutkan', 'tampilkan', 'berikan', 'daftar', 'list', 'dari', 'ke', 'dengan',
            'total', 'jumlah', 'berapa', 'anda', 'kamu', 'saya', 'yakin', 'hanya', 'kabar', 'gimana', 'woi', 'oy',
            'vendor', 'penyedia', 'sediakan', 'menyediakan', 'ingin', 'mau', 'tahu', 'tolong', 'cari', 'carikan', 'terkait', 'tentang', 'perusahaan', 'pt', 'cv', 'dki', 'daerah', 'istimewa'
        ]);

        const queryWords = queryLower.split(/\s+/).filter(w => w.length > 0 && !stopWords.has(w));

        if (queryWords.length > 0) {
            relevantData = csvData.filter(row => {
                const rowText = row._searchString; // Use cached string
                // Cek apakah minimal satu kata dari query ada di row
                return queryWords.some(word => rowText.includes(word));
            }); // Filter only, do NOT slice yet
        }
    }

    // Jika masih tidak ada, coba cari dengan substring matching (Hanya untuk query panjang > 4 chars)
    if (relevantData.length === 0 && queryLower.length > 4 && !provinsiMatch) { // Added !provinsiMatch to avoid re-doing if province was the only filter
        relevantData = csvData.filter(row => {
            const rowText = row._searchString; // Use cached string
            // Cek substring dari query (minimal 4 karakter untuk mengurangi false positive)
            for (let i = 0; i <= queryLower.length - 4; i++) {
                const substr = queryLower.substring(i, i + 4);
                if (rowText.includes(substr)) {
                    return true;
                }
            }
            return false;
        }); // Filter only, do NOT slice yet
    }

    // Untuk pertanyaan filter spesifik (lokasi, status), cari di kolom tertentu
    // The province filtering logic has been moved up and made more strict.
    // This block now only handles status filtering if it wasn't already handled by province.
    if (isListQuery) {
        // Cek apakah query mengandung status rekanan (mendukung Bahasa Indonesia)
        const statusMap = {
            'terdaftar': 'Rekanan Terdaftar',
            'registered': 'Registered',
            'active': 'Registered',
            'aktif': 'Registered',
            'unverified': 'Unverified',
            'calon': 'Calon Rekanan',
            'seleksi': 'Rekanan Terseleksi',
            'unggul': 'Rekanan Unggul',
            'pending': 'Unverified',
            'approved': 'Registered',
            'rejected': 'Blacklist'
        };

        const statusKeywords = Object.keys(statusMap);
        const statusRegex = new RegExp(`(${statusKeywords.join('|')})`, 'i');
        const statusMatch = queryLower.match(statusRegex);

        if (statusMatch) {
            const matchedKey = statusMatch[0].toLowerCase();
            const targetStatus = statusMap[matchedKey];

            console.log(`📋 Status filter detected: "${matchedKey}" -> Target: "${targetStatus}"`);

            // Apply strict status filter
            const filteredByStatus = (relevantData.length > 0 ? relevantData : csvData).filter(row => {
                const statusValue = (row['STATUS REKANAN'] || '').toLowerCase();
                return statusValue.includes(matchedKey) || statusValue.includes(targetStatus.toLowerCase());
            });

            if (filteredByStatus.length > 0) {
                relevantData = filteredByStatus;
                console.log(`✅ Filtered ${relevantData.length} vendors with status: ${targetStatus}`);
            }
        }
    }

    // Jika masih tidak ada hasil spesifik, jangan return semua data untuk menghindari overload
    if (relevantData.length === 0) {
        console.log(`⚠️  No relevant data found for "${query}"`);
        return [];
    }

    const totalMatches = relevantData.length;
    const limitedRows = relevantData.slice(0, effectiveMaxRows);

    console.log(`✅ Found ${totalMatches} relevant rows for query: "${query}"${isListQuery ? ' (list query)' : ''}. Returning ${limitedRows.length}.`);
    // Log beberapa hasil untuk debugging
    if (limitedRows.length > 0) {
        console.log('   Sample matches:', limitedRows.slice(0, 3).map(r => r['NAMA VENDOR'] || r['Nama Vendor'] || 'N/A'));
    }

    return {
        rows: limitedRows,
        totalMatches: totalMatches
    };
}

// Fungsi untuk memformat data CSV menjadi teks untuk context
function formatDataForContext(data, compact = false) {
    if (!data || data.length === 0) {
        return '';
    }

    if (compact) {
        let formatted = `DAFTAR VENDOR RINGKAS (Total: ${data.length} vendor):\n`;
        formatted += `Mode Ringkas: Hanya menampilkan Nama dan Status untuk menghemat memori.\n\n`;

        data.forEach((row, index) => {
            const nama = row['NAMA VENDOR'] || 'Tanpa Nama';
            const status = row['STATUS REKANAN'] || '-';
            formatted += `${index + 1}. ${nama} (${status})\n`;
        });

        formatted += `\nTotal: ${data.length} vendor.`;
        return formatted;
    }

    let formatted = `DATA VENDOR DARI KNOWLEDGE BASE (Total: ${data.length} vendor):\n\n`;

    data.forEach((row, index) => {
        const parts = [];

        // Format sesuai dengan struktur kolom baru
        if (row['NAMA VENDOR']) {
            const kualifikasi = row['KUALIFIKASI PERUSAHAAN'] || '';
            const nama = row['NAMA VENDOR'];
            // Jika kualifikasi hanya PT/CV, gabungkan menjadi "PT Nama"
            if (kualifikasi.match(/^(PT|CV)$/i)) {
                parts.push(`${kualifikasi} ${nama}`);
            } else {
                parts.push(`${nama}`);
                if (kualifikasi) parts.push(`Kualifikasi: ${kualifikasi}`);
            }
        }
        if (row['STATUS REKANAN']) parts.push(`Status: ${row['STATUS REKANAN']}`);
        if (row['BIDANG USAHA']) parts.push(`Bidang Usaha: ${row['BIDANG USAHA']}`);
        if (row['CQSMS VENDOR']) parts.push(`CQSMS: ${row['CQSMS VENDOR']}`);
        if (row['PROVINSI']) parts.push(`Provinsi: ${row['PROVINSI']}`);
        if (row['INDUSTRY KEY']) parts.push(`Industry Key: ${row['INDUSTRY KEY']}`);
        if (row['KODE SUBKLASIFIKASI SBU']) parts.push(`Kode SBU: ${row['KODE SUBKLASIFIKASI SBU']}`);

        // Fallback untuk kolom lama jika ada
        if (parts.length === 0) {
            const columns = Object.keys(row);
            columns.forEach(col => {
                if (row[col] && row[col].trim()) {
                    parts.push(`${col}: ${row[col]}`);
                }
            });
        }

        formatted += `${index + 1}. ${parts.join(', ')}.\n`;
    });

    formatted += '\nTotal data vendor yang relevan ditemukan: ' + data.length + '.\n';
    formatted += 'INSTRUKSI PENTING:\n';
    formatted += '- Data di atas adalah data vendor yang tersedia. Jika user bertanya tentang vendor tertentu, CARI nama vendor tersebut di data di atas dan berikan semua informasi yang ada.\n';
    formatted += '- Jika user bertanya tentang LIST atau FILTER vendor (misalnya "vendor di Jakarta", "vendor status registered", "apa aja vendor yang..."), SEBUTKAN SEMUA vendor yang relevan dari data di atas, bukan hanya beberapa.\n';
    formatted += '- Gunakan variasi jawaban yang natural dan berbeda setiap kali untuk membuat percakapan lebih menarik.\n';
    formatted += '- JANGAN katakan bahwa Anda tidak memiliki informasi jika vendor tersebut ada di data di atas.\n';
    formatted += '- Untuk pertanyaan list/filter, sebutkan vendor dengan kata sambung yang natural seperti "di antaranya", "selain itu", "kemudian", "ada juga", "termasuk", dan akhiri dengan ringkasan total jumlah vendor.';

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

// NEW: Save CSV data back to file
async function saveCSV(newData) {
    if (!csvFilePath) {
        throw new Error('CSV file path not set');
    }

    return new Promise((resolve, reject) => {
        try {
            const { parse } = require('json2csv');
            const csv = parse(newData);
            fs.writeFileSync(csvFilePath, csv);

            // Reload into memory
            csvData = newData;
            lastModified = fs.statSync(csvFilePath).mtime;

            // Recalculate stats
            provinceStats = {};
            csvData.forEach(row => {
                const prov = (row['PROVINSI'] || 'Tidak Diketahui').toUpperCase().trim();
                provinceStats[prov] = (provinceStats[prov] || 0) + 1;
            });
            const sortedProvinces = Object.entries(provinceStats).sort(([, a], [, b]) => b - a);
            provinceStatsText = sortedProvinces.map(([prov, count]) => `- ${prov}: ${count} vendor`).join('\n');

            // Re-apply search strings
            csvData.forEach(row => {
                row._searchString = Object.values(row).join(' ').toLowerCase();
            });

            console.log(`✅ CSV saved and reloaded: ${csvData.length} rows`);
            resolve(true);
        } catch (err) {
            console.error('❌ Error saving CSV:', err);
            reject(err);
        }
    });
}

// NEW: Clear all data
async function clearData() {
    if (!csvFilePath) throw new Error('CSV file path not set');

    // Save minimal header-only file
    const headers = ['KUALIFIKASI PERUSAHAAN', 'NAMA VENDOR', 'STATUS REKANAN', 'BIDANG USAHA', 'CQSMS VENDOR', 'PROVINSI', 'INDUSTRY KEY', 'KODE SUBKLASIFIKASI SBU'];
    const emptyCsv = headers.join(',') + '\n';
    fs.writeFileSync(csvFilePath, emptyCsv);

    csvData = [];
    provinceStats = {};
    provinceStatsText = '';
    lastModified = fs.statSync(csvFilePath).mtime;
    console.log('🗑️ Data cleared and CSV file reset.');
    return true;
}

module.exports = {
    loadCSV,
    saveCSV,
    clearData,
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
    }),
    getProvinceStats: () => provinceStatsText,
    getDashboardStats: () => {
        if (csvData.length === 0) return null;

        const stats = {
            totalVendors: csvData.length,
            statusCounts: {},
            provinceCounts: {},
            qualificationCounts: {},
            businessFieldCounts: {},
            topBusinessFields: []
        };

        csvData.forEach(row => {
            // Status Rekanan
            const status = (row['STATUS REKANAN'] || 'Tidak Diketahui').trim();
            stats.statusCounts[status] = (stats.statusCounts[status] || 0) + 1;

            // Provinsi
            const prov = (row['PROVINSI'] || 'Tidak Diketahui').trim();
            stats.provinceCounts[prov] = (stats.provinceCounts[prov] || 0) + 1;

            // Kualifikasi
            const kualifikasi = (row['KUALIFIKASI PERUSAHAAN'] || 'Lainnya').trim();
            stats.qualificationCounts[kualifikasi] = (stats.qualificationCounts[kualifikasi] || 0) + 1;

            // Bidang Usaha
            const bidang = (row['BIDANG USAHA'] || 'Lainnya').trim();
            // Split by comma if multiple fields exist (heuristic)
            const fields = bidang.split(/,|;/).map(f => f.trim()).filter(f => f);
            fields.forEach(f => {
                stats.businessFieldCounts[f] = (stats.businessFieldCounts[f] || 0) + 1;
            });
        });

        // Get Top 10 Business Fields
        stats.topBusinessFields = Object.entries(stats.businessFieldCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([label, count]) => ({ label, count }));

        // Clean up full object if too large? No, returning full object is fine for this scale (~400 rows)

        return stats;
    }
};

