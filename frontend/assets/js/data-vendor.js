// Data Vendor Dashboard Logic

let vendorData = [];
let filteredData = [];
let currentPage = 1;
let rowsPerPage = 10;
let currentSort = { column: 1, direction: 'asc' }; // Default sort by Name
const userEmail = sessionStorage.getItem('vendorbot_user_email');
const API_BASE = '/api';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Basic Auth Check
    if (!userEmail) {
        // Just warning or redirect if strictly needed. 
        // Logic in HTML handles redirect if not logged in.
    }

    // Load Data
    fetchData();

    // Setup Search & Filter Listeners
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.addEventListener('input', handleSearch);

    const filterStatus = document.getElementById('filterStatus');
    if (filterStatus) filterStatus.addEventListener('change', handleSearch);

    // Check for Pending Requests (Async)
    checkPendingRequests();

    // Initialize UI Handlers
    initUIHandlers();

    // Initial Sidebar Sync from Session
    if (typeof updateSidebarProfile === 'function') {
        updateSidebarProfile();
    }

    // Rows Per Page Listener
    const rowsPerPageSelect = document.getElementById('rowsPerPage');
    if (rowsPerPageSelect) {
        rowsPerPageSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            if (val === 'all') {
                rowsPerPage = 999999; // Effectively 'All'
            } else {
                rowsPerPage = parseInt(val);
            }
            currentPage = 1;
            updateDashboard();
        });
    }
});

// CHECK REQUESTS (Admin/Manager only)
async function checkPendingRequests() {
    try {
        const response = await fetch(`${API_BASE}/vendors/requests`, {
            headers: { 'email': userEmail }
        });
        if (response.status === 403) return; // Not authorized

        const requests = await response.json();

        // Remove existing button if any
        const existingBtn = document.getElementById('requestNotificationBtn');
        if (existingBtn) existingBtn.remove();

        if (requests.length > 0) {
            // Inject Notification Button
            const container = document.querySelector('.flex.gap-2'); // Should match the container with filter & export
            if (container) {
                const btn = document.createElement('button');
                btn.id = 'requestNotificationBtn';
                // Style: Premium glass style with pulse
                btn.className = 'btn-premium bg-red-600/20 text-red-500 border-red-500/30 hover:bg-red-600/30 shadow-lg shadow-red-500/20 animate-pulse h-full';
                btn.onclick = () => showRequestsModal(requests);
                btn.innerHTML = `
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    <span>Requests (${requests.length})</span>
                `;
                container.insertBefore(btn, container.firstChild);
            }
        }
    } catch (e) {
        console.error('Error checking requests:', e);
    }
}

// SHOW REQUESTS MODAL
function showRequestsModal(requests) {
    const modalContent = document.getElementById('analyticsContent'); // Reuse analytics modal container or create new? Reuse analytics for simplicity as it has a wide layout
    let html = '<div class="space-y-4">';

    requests.forEach(req => {
        let payload;
        try {
            payload = typeof req.payload === 'string' ? JSON.parse(req.payload) : req.payload;
        } catch (e) {
            console.error('Error parsing payload:', e);
            payload = {};
        }

        const typeColor = req.action_type === 'DELETE' ? 'text-red-400' : (req.action_type === 'UPDATE' ? 'text-yellow-400' : 'text-green-400');

        let details = '';
        if (req.action_type === 'DELETE') details = `Menghapus vendor: ${payload.id}`;
        else details = `<strong>${payload.name}</strong> (${payload.kualifikasi})`;

        html += `
            <div class="glass-panel p-5 rounded-xl border border-white/5 flex justify-between items-center transition-all hover:border-white/10">
                <div class="flex items-center gap-4">
                     <div class="p-3 ${req.action_type === 'DELETE' ? 'bg-red-500/10 text-red-500' : (req.action_type === 'UPDATE' ? 'text-yellow-500 bg-yellow-500/10' : 'text-green-500 bg-green-500/10')} rounded-lg border border-current/20">
                         <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                             ${req.action_type === 'DELETE' ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />' : (req.action_type === 'UPDATE' ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />' : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />')}
                         </svg>
                     </div>
                    <div>
                        <p class="text-xs text-gray-500 mb-0.5 uppercase tracking-wider font-bold">
                            <span class="${typeColor}">${req.action_type}</span> 
                            by <span class="text-gray-300">${req.requested_by}</span>
                        </p>
                        <div class="text-white font-medium">${details}</div>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button onclick="handleRequest(${req.id}, 'reject')" class="px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg border border-red-500/20 text-sm font-bold transition-all">Reject</button>
                    <button onclick="handleRequest(${req.id}, 'approve')" class="btn-premium py-2 px-4 text-sm">Approve</button>
                </div>
            </div>
        `;
    });
    html += '</div>';

    modalContent.innerHTML = `
        <div class="space-y-6">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-2xl font-bold text-white">Approval Requests</h3>
                <span class="px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full text-xs font-bold border border-blue-500/20">${requests.length} Pending</span>
            </div>
            <div class="grid gap-4">
                ${html}
            </div>
        </div>
    `;

    document.getElementById('analyticsModal').classList.add('active');
}

// HANDLE REQUEST ACTION
async function handleRequest(id, action) {
    if (!confirm(`Apakah Anda yakin ingin ${action.toUpperCase()} permintaan ini?`)) return;

    try {
        const response = await fetch(`${API_BASE}/vendors/requests/${id}/${action}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail })
        });

        const result = await response.json();

        if (response.ok) {
            alert('✅ ' + result.message);
            // Refresh requests and data
            document.getElementById('analyticsModal').classList.remove('active');
            checkPendingRequests();
            fetchData();
        } else {
            alert('❌ Gagal: ' + result.error);
        }
    } catch (e) {
        alert('❌ Error: ' + e.message);
    }
}



// Fetch Data from API
async function fetchData() {
    try {
        const response = await fetch(`${API_BASE}/vendors?limit=1000`);
        const result = await response.json();

        if (result.data) {
            vendorData = result.data.map(item => ({
                id: item.id,
                kualifikasi: item.kualifikasi || item['KUALIFIKASI PERUSAHAAN'] || '',
                name: item.nama_vendor || item['NAMA VENDOR'] || 'Unknown',
                status: item.status_rekanan || item['STATUS REKANAN'] || 'Registered',
                bidang: item.bidang_usaha || item['BIDANG USAHA'] || '-',
                cqsms: item.cqsms_vendor || item['CQSMS VENDOR'] || '-',
                provinsi: item.provinsi || item['PROVINSI'] || '-',
                industry: item.industry_key || item['INDUSTRY KEY'] || '-',
                sbu: item.kode_sbu || item['KODE SUBKLASIFIKASI SBU'] || '-'
            }));

            filteredData = [...vendorData];
            updateDashboard();
        }
    } catch (error) {
        console.error('Error fetching data:', error);
        // Fallback or Alert
    }
}

// File Upload Handler (Still supported for Bulk Import)
// Helper for Loading Overlay
function showLoading(message = 'Memproses data...') {
    const overlay = document.getElementById('loadingOverlay');
    const text = document.getElementById('loadingText');
    if (overlay && text) {
        text.textContent = message;
        overlay.classList.remove('hidden');
    }
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.add('hidden');
    }
}

// File Upload Handler (Still supported for Bulk Import)
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!confirm('Apakah Anda yakin ingin mengimpor data ini? Ini akan ditambahkan ke database.')) {
        event.target.value = '';
        return;
    }

    showLoading('Membaca file CSV...');

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            // Improved CSV Parsing with Header Mapping
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];

            // sheet_to_json with defval handles empty cells and gives us objects with header keys
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

            if (jsonData.length === 0) {
                hideLoading();
                alert('File CSV kosong atau format salah.');
                return;
            }

            showLoading(`Mengupload ${jsonData.length} data vendor...`);

            // Map headers to internal keys (Flexible)
            const formattedRows = jsonData.map(row => ({
                kualifikasi: row['KUALIFIKASI PERUSAHAAN'] || row['Kualifikasi'] || '',
                name: row['NAMA VENDOR'] || row['Nama Vendor'] || 'Unknown',
                status: row['STATUS REKANAN'] || row['Status'] || 'Registered',
                bidang: row['BIDANG USAHA'] || row['Bidang Usaha'] || '-',
                cqsms: row['CQSMS VENDOR'] || row['CQSMS'] || '-',
                provinsi: row['PROVINSI'] || row['Provinsi'] || '-',
                industry: row['INDUSTRY KEY'] || row['Industry Key'] || '-',
                sbu: row['KODE SUBKLASIFIKASI SBU'] || row['Kode SBU'] || '-'
            }));

            // Send to Backend
            fetch(`${API_BASE}/vendors/bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vendors: formattedRows, email: userEmail })
            })
                .then(async res => {
                    const result = await res.json();
                    hideLoading();
                    if (res.ok) {
                        alert(result.message);
                        fetchData(); // Reload Table
                    } else {
                        alert('Gagal import: ' + (result.error || 'Server error'));
                    }
                })
                .catch(err => {
                    hideLoading();
                    alert('Error: ' + err.message);
                });
        } catch (error) {
            hideLoading();
            alert('Gagal memproses file: ' + error.message);
        } finally {
            event.target.value = '';
        }
    };

    // Handle reader errors
    reader.onerror = function () {
        hideLoading();
        alert('Gagal membaca file.');
        event.target.value = '';
    };

    reader.readAsArrayBuffer(file);
}

// Search & Filter
function handleSearch() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const statusFilter = document.getElementById('filterStatus').value;

    filteredData = vendorData.filter(item => {
        const queryLower = query.toLowerCase();
        const matchQuery = item.name.toLowerCase().includes(queryLower) ||
            item.bidang.toLowerCase().includes(queryLower) ||
            item.provinsi.toLowerCase().includes(queryLower) ||
            item.cqsms.toLowerCase().includes(queryLower) ||
            item.industry.toLowerCase().includes(queryLower) ||
            item.sbu.toLowerCase().includes(queryLower) ||
            item.kualifikasi.toString().toLowerCase().includes(queryLower);

        const matchStatus = statusFilter ? item.status.toLowerCase().includes(statusFilter.toLowerCase()) : true;
        return matchQuery && matchStatus;
    });

    currentPage = 1;
    updateDashboard();
}

// Core Update Function
function updateDashboard() {
    // Update Total Records
    const totalRecordsEl = document.getElementById('totalRecords');
    if (totalRecordsEl) {
        totalRecordsEl.textContent = filteredData.length;
    }
    renderTable();
    renderPagination();
}



// Table Rendering
function renderTable() {
    const tbody = document.getElementById('vendorTableBody');
    tbody.innerHTML = '';

    // If rowsPerPage is 'all' or larger than data, show all
    const safeRows = rowsPerPage === 'all' ? filteredData.length : rowsPerPage;
    const start = (currentPage - 1) * safeRows;
    const end = rowsPerPage === 'all' ? filteredData.length : start + safeRows;
    const paginatedData = filteredData.slice(start, end);

    document.getElementById('showingFrom').textContent = filteredData.length > 0 ? start + 1 : 0;
    document.getElementById('showingTo').textContent = Math.min(end, filteredData.length);

    paginatedData.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = 'border-b border-gray-800 hover:bg-gray-800/50 transition-colors';

        let statusLower = item.status.toLowerCase();
        let badgeClass = 'badge-terdaftar';
        if (statusLower.includes('unggul')) badgeClass = 'badge-unggul';
        else if (statusLower.includes('terseleksi')) badgeClass = 'badge-terseleksi';
        else if (statusLower.includes('inactive') || statusLower.includes('unverified')) badgeClass = 'badge-inactive';

        // Helper to format SBU if too long
        const sbuShort = item.sbu.length > 20 ? item.sbu.substring(0, 20) + '...' : item.sbu;

        tr.innerHTML = `
            <td class="px-4 py-3 text-sm text-gray-400 font-bold" data-label="Kualifikasi">${item.kualifikasi}</td>
            <td class="px-4 py-3 text-sm font-medium text-white" data-label="Nama Vendor">${item.name}</td>
            <td class="px-4 py-3" data-label="Status Rekanan">
                <span class="badge ${badgeClass}">${item.status}</span>
            </td>
            <td class="px-4 py-3 text-sm text-gray-300" data-label="Bidang Usaha">
                <span class="px-2 py-1 rounded bg-gray-700 text-xs">${item.bidang}</span>
            </td>
            <td class="px-4 py-3 text-sm text-gray-300" data-label="CQSMS">${item.cqsms}</td>
            <td class="px-4 py-3 text-sm text-gray-300" data-label="Provinsi">${item.provinsi}</td>
            <td class="px-4 py-3 text-sm text-gray-300" data-label="Industry Key">${item.industry}</td>
            <td class="px-4 py-3 text-sm text-gray-300" title="${item.sbu}" data-label="Kode SBU">${sbuShort}</td>
            <td class="px-4 py-3" data-label="Aksi">
                <div class="flex gap-2 justify-end md:justify-start">
                    <button onclick="editVendor(${item.id})" class="p-1 text-blue-400 hover:text-blue-300 hover:bg-blue-900/30 rounded transition-colors" title="Edit">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                    <button onclick="deleteVendor(${item.id}, '${item.name}')" class="p-1 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded transition-colors" title="Hapus">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (paginatedData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-gray-500">Tidak ada data ditemukan</td></tr>`;
    }
}

// Pagination
function renderPagination() {
    const pagination = document.getElementById('pagination');
    pagination.innerHTML = '';
    const totalPages = Math.ceil(filteredData.length / rowsPerPage);

    if (totalPages <= 1) return;

    // Prev
    const prevBtn = document.createElement('button');
    prevBtn.innerHTML = '&laquo;';
    prevBtn.className = `px-3 py-1 rounded ${currentPage === 1 ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-gray-800 text-white hover:bg-gray-700'}`;
    prevBtn.onclick = () => { if (currentPage > 1) { currentPage--; updateDashboard(); } };
    pagination.appendChild(prevBtn);

    // Pages
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            const pageBtn = document.createElement('button');
            pageBtn.textContent = i;
            pageBtn.className = `px-3 py-1 rounded ${currentPage === i ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`;
            pageBtn.onclick = () => { currentPage = i; updateDashboard(); };
            pagination.appendChild(pageBtn);
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            const dots = document.createElement('span');
            dots.textContent = '...';
            dots.className = 'px-2 py-1 text-gray-500';
            pagination.appendChild(dots);
        }
    }

    // Next
    const nextBtn = document.createElement('button');
    nextBtn.innerHTML = '&raquo;';
    nextBtn.className = `px-3 py-1 rounded ${currentPage === totalPages ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-gray-800 text-white hover:bg-gray-700'}`;
    nextBtn.onclick = () => { if (currentPage < totalPages) { currentPage++; updateDashboard(); } };
    pagination.appendChild(nextBtn);
}

// Sort Handler
function sortTable(columnIndex) {
    const keys = ['kualifikasi', 'name', 'status', 'bidang', 'cqsms', 'provinsi', 'industry', 'sbu'];
    const key = keys[columnIndex];

    if (currentSort.column === columnIndex) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.column = columnIndex;
        currentSort.direction = 'asc';
    }

    // Update Icon UI
    document.querySelectorAll('.sort-icon').forEach((icon, idx) => {
        icon.textContent = '↕';
        if (idx === columnIndex) icon.textContent = currentSort.direction === 'asc' ? '↑' : '↓';
    });

    filteredData.sort((a, b) => {
        let valA = a[key] || '';
        let valB = b[key] || '';

        if (key === 'id') {
            valA = parseInt(valA);
            valB = parseInt(valB);
        }

        if (valA < valB) return currentSort.direction === 'asc' ? -1 : 1;
        if (valA > valB) return currentSort.direction === 'asc' ? 1 : -1;
        return 0;
    });

    updateDashboard();
}

// EDIT VENDOR
function editVendor(id) {
    const vendor = vendorData.find(v => v.id == id);
    if (!vendor) return;

    const modalContent = document.getElementById('modalContent');
    modalContent.innerHTML = `
        <form id="editForm" onsubmit="saveVendor(event, ${id})" class="space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="md:col-span-2">
                    <label class="block text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Nama Vendor</label>
                    <input type="text" name="name" value="${vendor.name}" class="w-full glass-input rounded-xl px-4 py-3 text-white border-none focus:ring-2 focus:ring-blue-500/50" required>
                </div>
                <div>
                    <label class="block text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Kualifikasi</label>
                    <input type="text" name="kualifikasi" value="${vendor.kualifikasi}" class="w-full glass-input rounded-xl px-4 py-3 text-white border-none focus:ring-2 focus:ring-blue-500/50">
                </div>
                <div>
                    <label class="block text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Status Rekanan</label>
                    <select name="status" class="w-full glass-input rounded-xl px-4 py-3 text-white border-none focus:ring-2 focus:ring-blue-500/50">
                        <option value="Rekanan Unggul" ${vendor.status.includes('Unggul') ? 'selected' : ''}>Rekanan Unggul</option>
                        <option value="Rekanan Terseleksi" ${vendor.status.includes('Terseleksi') ? 'selected' : ''}>Rekanan Terseleksi</option>
                        <option value="Registered" ${vendor.status.includes('Registered') ? 'selected' : ''}>Registered</option>
                        <option value="Inactive" ${vendor.status.includes('Inactive') ? 'selected' : ''}>Inactive</option>
                    </select>
                </div>
                <div>
                    <label class="block text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">CQSMS</label>
                    <input type="text" name="cqsms" value="${vendor.cqsms}" class="w-full glass-input rounded-xl px-4 py-3 text-white border-none focus:ring-2 focus:ring-blue-500/50">
                </div>
                <div>
                    <label class="block text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Provinsi</label>
                    <input type="text" name="provinsi" value="${vendor.provinsi}" class="w-full glass-input rounded-xl px-4 py-3 text-white border-none focus:ring-2 focus:ring-blue-500/50">
                </div>
                <div class="md:col-span-2">
                    <label class="block text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Bidang Usaha</label>
                    <input type="text" name="bidang" value="${vendor.bidang}" class="w-full glass-input rounded-xl px-4 py-3 text-white border-none focus:ring-2 focus:ring-blue-500/50">
                </div>
                <div class="md:col-span-2">
                    <label class="block text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Industry Key</label>
                    <input type="text" name="industry" value="${vendor.industry}" class="w-full glass-input rounded-xl px-4 py-3 text-white border-none focus:ring-2 focus:ring-blue-500/50">
                </div>
                <div class="md:col-span-2">
                    <label class="block text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Kode SBU</label>
                    <textarea name="sbu" class="w-full glass-input rounded-xl px-4 py-3 text-white border-none focus:ring-2 focus:ring-blue-500/50 h-32 resize-none">${vendor.sbu}</textarea>
                </div>
            </div>
            <div class="mt-8 flex justify-end gap-3 pt-6 border-t border-white/5">
                <button type="button" onclick="closeModal()" class="px-6 py-3 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl font-bold transition-all">Batal</button>
                <button type="submit" class="btn-premium px-8">Simpan Perubahan</button>
            </div>
        </form>
    `;
    document.getElementById('vendorModal').classList.add('active');
}

// SAVE VENDOR
async function saveVendor(event, id) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const updatedData = Object.fromEntries(formData.entries());
    const userRole = sessionStorage.getItem('vendorbot_user_role');

    // Determine Action
    const isStaff = userRole !== 'admin' && userRole !== 'manager';
    const endpoint = isStaff ? `${API_BASE}/vendors/requests` : `${API_BASE}/vendors/${id}`;
    const method = isStaff ? 'POST' : 'PUT';

    // Prepare Payload
    const body = isStaff ? {
        vendor_id: id,
        action_type: 'UPDATE',
        payload: updatedData,
        email: userEmail
    } : {
        vendor: updatedData,
        email: userEmail
    };

    try {
        const response = await fetch(endpoint, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const result = await response.json();

        closeModal();

        if (response.ok) {
            if (isStaff) alert('ℹ️ Permintaan perubahan dikirim ke Admin.');
            else {
                alert('✅ Data berhasil diperbarui.');
                fetchData();
            }
        } else {
            alert('❌ Gagal: ' + (result.error || 'Terjadi kesalahan'));
        }
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}

// DELETE VENDOR
async function deleteVendor(id, name) {
    if (!confirm(`Apakah Anda yakin ingin menghapus data "${name}"?`)) return;

    const userRole = sessionStorage.getItem('vendorbot_user_role');
    const isStaff = userRole !== 'admin' && userRole !== 'manager';

    if (isStaff) {
        // Submit Delete Request
        try {
            const response = await fetch(`${API_BASE}/vendors/requests`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    vendor_id: id,
                    action_type: 'DELETE',
                    payload: { id, name }, // Minimal payload for context
                    email: userEmail
                })
            });
            const result = await response.json();
            if (response.ok) alert('ℹ️ Permintaan penghapusan dikirim ke Admin.');
            else alert('❌ Gagal: ' + result.error);
        } catch (e) {
            alert('❌ Error: ' + e.message);
        }
        return;
    }

    // Admin Direct Delete
    try {
        const response = await fetch(`${API_BASE}/vendors/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail })
        });
        const result = await response.json();

        if (response.ok) {
            alert('✅ Data terhapus.');
            fetchData();
        } else {
            alert('❌ Gagal: ' + (result.error || 'Terjadi kesalahan'));
        }
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}

// Export to Excel (Client-side from loaded data)
function exportToExcel() {
    if (filteredData.length === 0) {
        alert('Tidak ada data untuk diexport');
        return;
    }
    const ws = XLSX.utils.json_to_sheet(filteredData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data Vendor");
    XLSX.writeFile(wb, "data_vendor_export.xlsx");
}



// Reset Data Handler
async function resetData() {
    const userRole = sessionStorage.getItem('vendorbot_user_role');
    if (userRole !== 'admin' && userRole !== 'manager') {
        alert('Maaf, hanya Admin atau Manager yang dapat menghapus seluruh data.');
        return;
    }

    if (!confirm('PENTING: Anda akan menghapus SELURUH data vendor di database. Tindakan ini tidak dapat dibatalkan. Lanjutkan?')) {
        return;
    }

    try {
        showLoading('Menghapus seluruh data...');
        const response = await fetch(`${API_BASE}/vendors/reset`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail })
        });
        const result = await response.json();
        hideLoading();

        if (response.ok) {
            alert('✅ ' + result.message);
            fetchData(); // Clear the UI
        } else {
            alert('❌ Gagal reset: ' + (result.error || 'Terjadi kesalahan'));
        }
    } catch (e) {
        hideLoading();
        alert('❌ Error: ' + e.message);
    }
}

// --- UI HANDLERS ---
function initUIHandlers() {
    // 1. Sidebar Toggle
    window.toggleSidebar = function () {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        const isDesktop = window.innerWidth >= 769;

        if (isDesktop) {
            const isOpen = sidebar.classList.contains('open');
            if (isOpen) {
                sidebar.classList.remove('open');
                sidebar.classList.add('closed');
                sidebar.style.width = '0';
            } else {
                sidebar.classList.remove('closed');
                sidebar.classList.add('open');
                sidebar.style.width = '256px';
            }
        } else {
            // Mobile
            if (sidebar) sidebar.classList.toggle('open');
            if (overlay) overlay.classList.toggle('hidden');
        }
    };

    const closeSidebarBtn = document.getElementById('closeSidebarBtn');
    if (closeSidebarBtn) {
        closeSidebarBtn.onclick = window.toggleSidebar;
    }

    // Modal and Theme handlers are now managed by script.js
    console.log('UI Handlers initialized (Modal/Theme managed by script.js)');
}
