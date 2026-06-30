document.addEventListener('DOMContentLoaded', async () => {
    // Check Auth
    const isLoggedIn = sessionStorage.getItem('vendorbot_logged_in');
    if (isLoggedIn !== 'true') {
        window.location.href = 'login.html';
        return;
    }

    // Initialize Charts
    await loadDashboardData();
    loadUserProfile();
});

function loadUserProfile() {
    const name = sessionStorage.getItem('vendorbot_user_name') || 'User';
    const role = sessionStorage.getItem('vendorbot_user_role') || 'Role';
    const avatar = sessionStorage.getItem('vendorbot_user_avatar');

    // Update Text
    const nameDisplay = document.getElementById('userNameDisplay');
    const roleDisplay = document.getElementById('userRoleDisplay');

    if (nameDisplay) nameDisplay.textContent = name;
    if (roleDisplay) roleDisplay.textContent = role;

    // Avatar Logic
    const avatarImg = document.getElementById('sidebarAvatar');
    const initialContainer = document.getElementById('sidebarInitialContainer');
    const userInitial = document.getElementById('userInitial');

    if (avatar && avatar !== 'null' && avatar !== 'undefined') {
        if (avatarImg) {
            avatarImg.src = avatar;
            avatarImg.classList.remove('hidden');
        }
        if (initialContainer) initialContainer.classList.add('hidden');
    } else {
        if (avatarImg) avatarImg.classList.add('hidden');
        if (initialContainer) initialContainer.classList.remove('hidden');
        if (userInitial) userInitial.textContent = name.charAt(0).toUpperCase();
    }
}

async function loadDashboardData() {
    try {
        const response = await fetch('/api/dashboard/stats');
        const data = await response.json();

        if (data.error) {
            console.error('Error fetching dashboard data:', data.error);
            return;
        }

        updateKPICards(data);
        renderCharts(data);
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
    }
}

function updateKPICards(data) {
    document.getElementById('totalVendors').textContent = data.totalVendors || 0;

    // Calculate Registered (Termasuk Unggul, Terseleksi)
    const statusCounts = data.statusCounts || {};
    const registered = (statusCounts['Registered'] || 0) +
        (statusCounts['Rekanan Terdaftar'] || 0) +
        (statusCounts['Rekanan Unggul'] || 0) +
        (statusCounts['Rekanan Terseleksi'] || 0) +
        (statusCounts['Rekanan Terseleksi Waskita'] || 0);

    const elite = (statusCounts['Rekanan Unggul'] || 0) + (statusCounts['Rekanan Unggul Waskita'] || 0);

    // Specific Status Counts
    const rekananTerdaftar = statusCounts['Rekanan Terdaftar'] || 0;
    const calonRekanan = (statusCounts['Calon Rekanan Waskita'] || 0) + (statusCounts['Calon Rekanan'] || 0);
    const rekananTerseleksi = (statusCounts['Rekanan Terseleksi Waskita'] || 0) + (statusCounts['Rekanan Terseleksi'] || 0);


    document.getElementById('eliteVendors').textContent = elite;
    document.getElementById('provinceCount').textContent = Object.keys(data.provinceCounts || {}).length;

    // Update New Cards
    document.getElementById('rekananTerdaftarCount').textContent = rekananTerdaftar;
    document.getElementById('calonRekananCount').textContent = calonRekanan;
    document.getElementById('rekananTerseleksiCount').textContent = rekananTerseleksi;
}

function renderCharts(data) {
    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: { color: '#9ca3af' }
            }
        },
        scales: {
            y: {
                grid: { color: 'rgba(75, 85, 99, 0.2)' },
                ticks: { color: '#9ca3af' }
            },
            x: {
                grid: { color: 'rgba(75, 85, 99, 0.2)' },
                ticks: { color: '#9ca3af' }
            }
        }
    };

    // Pie Chart Options (No scales)
    const pieOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'right',
                labels: { color: '#9ca3af' }
            }
        }
    };

    // Expanded Color Palette (20 Distinct Colors)
    const colorPalette = [
        '#3b82f6', // Blue
        '#10b981', // Emerald
        '#f59e0b', // Amber
        '#ef4444', // Red
        '#8b5cf6', // Violet
        '#ec4899', // Pink
        '#06b6d4', // Cyan
        '#84cc16', // Lime
        '#f97316', // Orange
        '#6366f1', // Indigo
        '#14b8a6', // Teal
        '#e11d48', // Rose
        '#eab308', // Yellow
        '#a855f7', // Purple
        '#22c55e', // Green
        '#3b82f6', // Sky
        '#f43f5e', // Rose Red
        '#64748b', // Slate
        '#d946ef', // Fuchsia
        '#0ea5e9'  // Light Blue
    ];

    // 1. Status Distribution (Doughnut)
    const statusCtx = document.getElementById('statusChart').getContext('2d');
    const statusLabels = Object.keys(data.statusCounts);
    const statusValues = Object.values(data.statusCounts);

    new Chart(statusCtx, {
        type: 'doughnut',
        data: {
            labels: statusLabels,
            datasets: [{
                data: statusValues,
                backgroundColor: colorPalette,
                borderWidth: 0
            }]
        },
        options: pieOptions
    });

    // 2. Qualification (Pie)
    const qualCtx = document.getElementById('qualificationChart').getContext('2d');
    const qualLabels = Object.keys(data.qualificationCounts);
    const qualValues = Object.values(data.qualificationCounts);

    new Chart(qualCtx, {
        type: 'pie',
        data: {
            labels: qualLabels,
            datasets: [{
                data: qualValues,
                backgroundColor: colorPalette,
                borderWidth: 0
            }]
        },
        options: pieOptions
    });

    // 3. Top Provinces (Bar)
    const provCtx = document.getElementById('provinceChart').getContext('2d');
    const sortedProvinces = Object.entries(data.provinceCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10);

    new Chart(provCtx, {
        type: 'bar',
        data: {
            labels: sortedProvinces.map(p => p[0]),
            datasets: [{
                label: 'Jumlah Vendor',
                data: sortedProvinces.map(p => p[1]),
                backgroundColor: '#3b82f6',
                borderRadius: 4
            }]
        },
        options: {
            ...commonOptions,
            indexAxis: 'y' // Horizontal bar
        }
    });

    // 4. Top Business Fields (Bar)
    const bizCtx = document.getElementById('businessFieldChart').getContext('2d');

    new Chart(bizCtx, {
        type: 'bar',
        data: {
            labels: data.topBusinessFields.map(f => f.label.substring(0, 20) + '...'), // Truncate long labels
            datasets: [{
                label: 'Jumlah Vendor',
                data: data.topBusinessFields.map(f => f.count),
                backgroundColor: '#8b5cf6',
                borderRadius: 4
            }]
        },
        options: {
            ...commonOptions,
            indexAxis: 'y'
        }
    });

    // Dark/Light Mode Listener for Charts
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'class') {
                const isLight = document.body.classList.contains('light-mode');
                const textColor = isLight ? '#374151' : '#9ca3af';
                const gridColor = isLight ? 'rgba(0, 0, 0, 0.1)' : 'rgba(75, 85, 99, 0.2)';

                Chart.instances.forEach(chart => {
                    if (chart.options.plugins.legend) {
                        chart.options.plugins.legend.labels.color = textColor;
                    }
                    if (chart.options.scales.x) {
                        chart.options.scales.x.ticks.color = textColor;
                        chart.options.scales.x.grid.color = gridColor;
                    }
                    if (chart.options.scales.y) {
                        chart.options.scales.y.ticks.color = textColor;
                        chart.options.scales.y.grid.color = gridColor;
                    }
                    chart.update();
                });
            }
        });
    });

    observer.observe(document.body, { attributes: true });
}
