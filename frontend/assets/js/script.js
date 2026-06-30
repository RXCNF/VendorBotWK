const API_URL = (typeof CONFIG !== 'undefined' && CONFIG.PROXY_URL)
    ? CONFIG.PROXY_URL
    : '/api/chat';

// Base API URL for non-chat endpoints (e.g. auth, profile)
const BASE_API_URL = API_URL.replace(/\/chat$/, '');

// Elemen DOM
const chatContainer = document.getElementById('chatContainer');
const chatScrollWrapper = document.getElementById('chatScrollWrapper');
const chatForm = document.getElementById('chatForm');
const userInput = document.getElementById('userInput');
const sendButton = document.getElementById('sendButton');
const newChatBtn = document.getElementById('newChatBtn');
const chatHistoryList = document.getElementById('chatHistoryList');
const sidebar = document.getElementById('sidebar');
const sidebarToggleBtns = [
    document.getElementById('sidebarToggleBtnLanding'),
    document.getElementById('sidebarToggleBtnChat'),
    // Fallback for mobile or legacy
    document.getElementById('sidebarToggleBtn')
].filter(el => el !== null);
const sidebarResizeHandle = document.getElementById('sidebarResizeHandle');
const welcomeMessage = document.getElementById('welcomeMessage');
const stopButton = document.getElementById('stopButton');
const editHistoryBtn = document.getElementById('editHistoryBtn');
const bulkActions = document.getElementById('bulkActions');
const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
const cancelSelectionBtn = document.getElementById('cancelSelectionBtn');

// Landing Page Elements
const landingPage = document.getElementById('landingPage');
const chatInterface = document.getElementById('chatInterface');
const startChatBtn = document.getElementById('startChatBtn');
const landingUserName = document.getElementById('landingUserName');

// State management
let currentChatId = null;
let chatHistories = [];
let isGenerating = false;
let abortController = null;
let lastUserMessage = '';
let isSelectionMode = false;
let selectedChatIds = new Set();

// Auto-resize textarea
if (userInput) {
    userInput.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        if (this.value === '') {
            this.style.height = 'auto';
        }
    });
}

// Load chat histories dan render sidebar
async function loadChatHistories() {
    // Show Loading Skeleton Immediately
    if (chatHistoryList) {
        chatHistoryList.innerHTML = `
            <li class="p-3 mb-2 rounded-lg bg-gray-800/50 animate-pulse">
                <div class="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
                <div class="h-3 bg-gray-700 rounded w-1/2"></div>
            </li>
            <li class="p-3 mb-2 rounded-lg bg-gray-800/50 animate-pulse">
                <div class="h-4 bg-gray-700 rounded w-2/3 mb-2"></div>
                <div class="h-3 bg-gray-700 rounded w-1/3"></div>
            </li>
            <li class="p-3 mb-2 rounded-lg bg-gray-800/50 animate-pulse">
                <div class="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
                <div class="h-3 bg-gray-700 rounded w-1/2"></div>
            </li>
        `;
    }

    try {
        const email = getCurrentUserEmail();
        if (!email) {
            console.warn('No user logged in, cannot fetch history');
            chatHistoryList.innerHTML = ''; // Clear skeleton
            return;
        }

        const response = await fetch(`${API_URL}/history?email=${encodeURIComponent(email)}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        chatHistories = data.map(chat => ({
            ...chat,
            updatedAt: chat.updated_at || chat.updatedAt,
            createdAt: chat.created_at || chat.createdAt
        }));

        // Slight delay to prevent flickering if response is too fast (optional, but good for UX)
        // renderChatHistory(); 
    } catch (e) {
        console.error('Failed to load chat history:', e);
        // Fallback or empty state
        chatHistories = [];
    } finally {
        renderChatHistory();
    }
}

// Helpers to get current user info (from login.html context)
function getCurrentUserEmail() {
    return sessionStorage.getItem('vendorbot_user_email') || localStorage.getItem('vendorbot_saved_email');
}

// Save chat histories to Backend
async function saveChatHistories() {
    // We only save the current active chat to the backend here, usually.
    // Or we loop through all? For efficiency, let's just save the current one if it exists.
    if (currentChatId) {
        const currentChat = chatHistories.find(c => c.id === currentChatId);
        if (currentChat) {
            await saveChatSession(currentChat);
        }
    }
}

async function saveChatSession(chatSession) {
    try {
        const email = getCurrentUserEmail();
        if (!email) return;

        const payload = {
            email: email,
            chat: {
                id: chatSession.id,
                title: chatSession.title,
                messages: chatSession.messages,
                createdAt: chatSession.createdAt,
                updatedAt: chatSession.updatedAt
            }
        };

        await fetch(`${API_URL}/history`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (e) {
        console.error('Failed to save chat session:', e);
    }
}


function renderChatHistory() {
    chatHistoryList.innerHTML = '';

    // Sort by Date (newest first)
    chatHistories.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    // Sync static header state
    if (editHistoryBtn && bulkActions) {
        if (isSelectionMode) {
            editHistoryBtn.classList.add('hidden');
            bulkActions.classList.remove('hidden');
        } else {
            editHistoryBtn.classList.remove('hidden');
            bulkActions.classList.add('hidden');
        }
    }

    // Update delete button state in bulk
    if (deleteSelectedBtn) {
        deleteSelectedBtn.disabled = selectedChatIds.size === 0;
        deleteSelectedBtn.style.opacity = selectedChatIds.size === 0 ? '0.5' : '1';
    }

    if (isSelectionMode) {
        renderSelectionMode();
    } else {
        renderNormalMode();
    }
}

// Grouping Helper
function getGroupDate(dateStr) {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Reset hours for accurate date comparison
    today.setHours(0, 0, 0, 0);
    yesterday.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);

    if (checkDate.getTime() === today.getTime()) return 'Hari Ini';
    if (checkDate.getTime() === yesterday.getTime()) return 'Kemarin';

    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    if (checkDate >= sevenDaysAgo) return '7 Hari Terakhir';

    return 'Lama';
}

function renderNormalMode() {
    // 1. Group Data
    const groups = {
        'Hari Ini': [],
        'Kemarin': [],
        '7 Hari Terakhir': [],
        'Lama': []
    };

    chatHistories.forEach(chat => {
        const group = getGroupDate(chat.updatedAt || chat.createdAt);
        if (groups[group]) groups[group].push(chat);
        else groups['Lama'].push(chat); // Fallback
    });

    // 2. Render Groups
    Object.keys(groups).forEach(groupName => {
        const chats = groups[groupName];
        if (chats.length === 0) return;

        // Group Header
        const headerId = `group-${groupName.replace(/\s+/g, '-')}`;
        const header = document.createElement('div');
        header.className = 'flex items-center justify-between px-2 py-2 mt-2 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-300 transition-colors group-header';
        header.onclick = () => toggleChatGroup(headerId);
        header.innerHTML = `
            <span>${groupName}</span>
            <svg id="icon-${headerId}" class="w-3 h-3 transform transition-transform duration-200 rotate-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
        `;
        chatHistoryList.appendChild(header);

        // Group Content (List)
        const listDiv = document.createElement('div');
        listDiv.id = headerId;
        listDiv.className = 'space-y-1 mb-2 transition-all duration-200 overflow-hidden group-content';
        // Default: Open
        listDiv.style.maxHeight = '1000px';
        listDiv.style.opacity = '1';

        chats.forEach(chat => {
            const li = document.createElement('div'); // Div instead of li for structure
            li.className = `group relative p-3 rounded-lg cursor-pointer transition-colors duration-200 ${chat.id === currentChatId ? 'bg-gray-800' : 'hover:bg-gray-800/50'}`;
            li.onclick = () => loadChat(chat.id);

            const contentDiv = document.createElement('div');
            contentDiv.className = 'flex items-center gap-3 overflow-hidden';

            // Chat Icon
            const iconDiv = document.createElement('div');
            iconDiv.className = 'flex-shrink-0 text-gray-400';
            iconDiv.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>';

            // Title and Info
            const infoDiv = document.createElement('div');
            infoDiv.className = 'flex-1 min-w-0';

            const titleP = document.createElement('p');
            titleP.className = 'text-sm font-medium text-gray-200 chat-history-title truncate';
            titleP.textContent = chat.title || 'Chat Baru';

            const dateP = document.createElement('p');
            dateP.className = 'text-xs text-gray-500 truncate';
            const date = new Date(chat.createdAt);
            dateP.textContent = date.toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' });

            infoDiv.appendChild(titleP);
            infoDiv.appendChild(dateP);

            // Delete Button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded-md transition-all duration-200 absolute right-2 top-1/2 -translate-y-1/2';
            deleteBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                if (confirm('Hapus chat ini?')) {
                    deleteChat(chat.id);
                }
            };

            contentDiv.appendChild(iconDiv);
            contentDiv.appendChild(infoDiv);
            li.appendChild(contentDiv);
            li.appendChild(deleteBtn);
            listDiv.appendChild(li);
        });

        chatHistoryList.appendChild(listDiv);
    });
}

// Toggle Single Group
window.toggleChatGroup = function (groupId) {
    const list = document.getElementById(groupId);
    const icon = document.getElementById(`icon-${groupId}`);

    if (list.style.maxHeight === '0px') {
        // OPEN
        list.style.maxHeight = '1000px';
        list.style.opacity = '1';
        list.style.marginTop = '0';
        icon.classList.remove('-rotate-90');
        icon.classList.add('rotate-0');
    } else {
        // CLOSE
        list.style.maxHeight = '0px';
        list.style.opacity = '0';
        list.style.marginTop = '-5px'; // Smooth collapse effect
        icon.classList.remove('rotate-0');
        icon.classList.add('-rotate-90');
    }
}

// Expand/Collapse All
window.expandAllChatGroups = function () {
    const groups = document.querySelectorAll('.group-content');
    groups.forEach(list => {
        const id = list.id;
        const icon = document.getElementById(`icon-${id}`);
        list.style.maxHeight = '1000px';
        list.style.opacity = '1';
        if (icon) {
            icon.classList.remove('-rotate-90');
            icon.classList.add('rotate-0');
        }
    });
}

window.collapseAllChatGroups = function () {
    const groups = document.querySelectorAll('.group-content');
    groups.forEach(list => {
        const id = list.id;
        const icon = document.getElementById(`icon-${id}`);
        list.style.maxHeight = '0px';
        list.style.opacity = '0';
        if (icon) {
            icon.classList.remove('rotate-0');
            icon.classList.add('-rotate-90');
        }
    });
}

function renderSelectionMode() {
    // Render list with checkboxes (header is now static in HTML)

    // Render List with Checkboxes
    chatHistories.forEach(chat => {
        const li = document.createElement('li');
        li.className = `p-3 rounded-lg cursor-pointer mb-2 flex items-center gap-3 ${selectedChatIds.has(chat.id) ? 'bg-gray-800 ring-1 ring-blue-500/50' : 'hover:bg-gray-800/50'}`;
        li.onclick = () => {
            if (selectedChatIds.has(chat.id)) {
                selectedChatIds.delete(chat.id);
            } else {
                selectedChatIds.add(chat.id);
            }
            renderChatHistory(); // Re-render to update UI state
        };

        // Checkbox (Custom styled)
        const checkboxDiv = document.createElement('div');
        checkboxDiv.className = `w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedChatIds.has(chat.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-600'}`;
        if (selectedChatIds.has(chat.id)) {
            checkboxDiv.innerHTML = '<svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>';
        }

        const infoDiv = document.createElement('div');
        infoDiv.className = 'flex-1 min-w-0';

        const titleP = document.createElement('p');
        titleP.className = 'text-sm font-medium text-gray-200 chat-history-title truncate';
        titleP.textContent = chat.title || 'Chat Baru';

        const dateP = document.createElement('p');
        dateP.className = 'text-xs text-gray-500';
        const date = new Date(chat.createdAt);
        dateP.textContent = date.toLocaleDateString('id-ID'); // Short date for dense list

        infoDiv.appendChild(titleP);
        infoDiv.appendChild(dateP);

        li.appendChild(checkboxDiv);
        li.appendChild(infoDiv);
        chatHistoryList.appendChild(li);
    });
}

// Bulk Delete
async function bulkDeleteChats() {
    const idsToDelete = Array.from(selectedChatIds);

    // Optimistic UI Update first
    chatHistories = chatHistories.filter(chat => !selectedChatIds.has(chat.id));

    // If current chat is deleted, reset view
    if (selectedChatIds.has(currentChatId)) {
        currentChatId = null;
        chatContainer.innerHTML = '';
        if (welcomeMessage) {
            chatContainer.appendChild(welcomeMessage);
            welcomeMessage.style.display = 'flex';
        }
    }

    isSelectionMode = false;
    selectedChatIds.clear();
    renderChatHistory();

    // Call API for each delete (Parallel)
    // Ideally backend should support bulk delete, but loop is fine for now
    const email = getCurrentUserEmail();
    try {
        await Promise.all(idsToDelete.map(id => fetch(`${API_URL}/history/${id}?email=${encodeURIComponent(email)}`, { method: 'DELETE' })));
    } catch (e) {
        console.error('Error during bulk delete:', e);
        // In a real app, we might revert UI or show error
        alert('Gagal menghapus beberapa item. Silakan refresh.');
        loadChatHistories();
    }
}

function loadChat(chatId) {
    if (isSelectionMode) return; // Prevent loading when selecting

    // Ensure Interface is visible
    showChatInterface();

    currentChatId = chatId;
    const chat = chatHistories.find(c => c.id === chatId);
    if (!chat) return;

    // Clear UI
    chatContainer.innerHTML = '';

    // Render messages
    chat.messages.forEach(msg => {
        addMessage(msg.content, msg.role === 'user', false);
    });

    // Update active class
    renderChatHistory();

    // Close sidebar on mobile
    if (window.innerWidth < 768) {
        toggleSidebar();
    }
}

// Save message to history
function saveMessageToHistory(content, isUser) {
    if (!currentChatId) return;

    const chatIndex = chatHistories.findIndex(c => c.id === currentChatId);
    if (chatIndex === -1) return;

    const newMessage = {
        role: isUser ? 'user' : 'assistant',
        content: content,
        timestamp: new Date().toISOString()
    };

    chatHistories[chatIndex].messages.push(newMessage);
    chatHistories[chatIndex].updatedAt = new Date().toISOString();

    // Old title logic removed in favor of AI auto-title
    // if (chatHistories[chatIndex].messages.length === 1 && isUser) {
    //    chatHistories[chatIndex].title = content.substring(0, 30) + (content.length > 30 ? '...' : '');
    // }

    // Move to top
    const updatedChat = chatHistories.splice(chatIndex, 1)[0];
    chatHistories.unshift(updatedChat);

    saveChatHistories();
    renderChatHistory();
}

// Delete Single Chat
async function deleteChat(chatId) {
    try {
        const email = getCurrentUserEmail();
        await fetch(`${API_URL}/history/${chatId}?email=${encodeURIComponent(email)}`, { method: 'DELETE' });
    } catch (e) {
        console.error('Failed to delete chat:', e);
    }

    chatHistories = chatHistories.filter(c => c.id !== chatId);
    if (currentChatId === chatId) {
        currentChatId = null;
        chatContainer.innerHTML = '';
        if (welcomeMessage) {
            chatContainer.appendChild(welcomeMessage);
            welcomeMessage.style.display = 'flex';
        }
    }
    renderChatHistory();
}

// New Chat Button
if (newChatBtn) {
    newChatBtn.addEventListener('click', () => {
        // Ensure Interface is visible
        showChatInterface();

        currentChatId = null;
        chatContainer.innerHTML = '';
        if (welcomeMessage) {
            chatContainer.appendChild(welcomeMessage);
            welcomeMessage.style.display = 'flex';
        }
        renderChatHistory(); // clear active state
        // Close sidebar on mobile
        if (window.innerWidth < 768) {
            toggleSidebar();
        }
    });
}

// Global function for starting new chat (for compatibility)
window.startNewChat = function () {
    if (typeof showChatInterface === 'function') {
        showChatInterface();
    }

    currentChatId = null;
    currentChatId = null;
    if (chatContainer) chatContainer.innerHTML = '';
    if (welcomeMessage && chatContainer) {
        chatContainer.appendChild(welcomeMessage);
        welcomeMessage.style.display = 'flex';
    }
    renderChatHistory();
};

// Sidebar Toggle Button
sidebarToggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        toggleSidebar();
    });
});

// Edit History Button
if (editHistoryBtn) {
    editHistoryBtn.addEventListener('click', () => {
        isSelectionMode = true;
        selectedChatIds.clear();
        renderChatHistory();
    });
}

// Cancel Selection Button
if (cancelSelectionBtn) {
    cancelSelectionBtn.addEventListener('click', () => {
        isSelectionMode = false;
        selectedChatIds.clear();
        renderChatHistory();
    });
}

// Bulk Delete Button
if (deleteSelectedBtn) {
    deleteSelectedBtn.addEventListener('click', () => {
        if (selectedChatIds.size > 0 && confirm(`Hapus ${selectedChatIds.size} chat terpilih?`)) {
            bulkDeleteChats();
        }
    });
}

// Sidebar Close Button (Mobile)
const closeSidebarBtn = document.getElementById('closeSidebarBtn');
if (closeSidebarBtn) {
    closeSidebarBtn.addEventListener('click', () => {
        if (sidebar.classList.contains('open')) {
            toggleSidebar();
        }
    });
}

// Sidebar Overlay Click (Mobile)
const sidebarOverlay = document.getElementById('sidebarOverlay');
if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', () => {
        if (sidebar.classList.contains('open')) {
            toggleSidebar();
        }
    });
}


// Sidebar functions
let sidebarWidth = 260; // Default width
const minSidebarWidth = 200;
const maxSidebarWidth = 480;

function initializeSidebar() {
    const savedWidth = localStorage.getItem('vendorBot_sidebarWidth');
    if (savedWidth) {
        sidebarWidth = parseInt(savedWidth);
    }

    // Restore state
    const savedSidebarState = localStorage.getItem('vendorBot_sidebarOpen');
    const mainContent = document.getElementById('mainContent');

    if (window.innerWidth >= 769) {
        sidebar.style.width = sidebarWidth + 'px'; // Set initial width

        // Default: sidebar is OPEN
        if (savedSidebarState === 'false') {
            sidebar.classList.add('closed');
            sidebar.classList.remove('open');
            sidebar.style.width = '0';
            sidebar.style.setProperty('width', '0', 'important');
            updateMenuIcon(false);
        } else {
            sidebar.classList.add('open');
            sidebar.classList.remove('closed');
            sidebar.style.width = sidebarWidth + 'px';
            sidebar.style.setProperty('width', sidebarWidth + 'px', 'important');
            localStorage.setItem('vendorBot_sidebarOpen', 'true');
            updateMenuIcon(true);
        }
    } else {
        // Mobile: ensure sidebar is closed by default
        sidebar.classList.remove('open', 'closed');
        const sidebarOverlay = document.getElementById('sidebarOverlay');
        if (sidebarOverlay) sidebarOverlay.classList.add('hidden');
        updateMenuIcon(false);
    }
}

window.addEventListener('DOMContentLoaded', initializeSidebar);

// Sidebar toggle function with resize support
window.toggleSidebar = function () {
    if (window.innerWidth >= 769) {
        // Desktop: toggle between open and closed with saved width
        const isOpen = sidebar.classList.contains('open');
        const mainContent = document.getElementById('mainContent');

        if (isOpen) {
            sidebar.classList.remove('open');
            sidebar.classList.add('closed');
            sidebar.style.width = '0';
            sidebar.style.setProperty('width', '0', 'important');
            localStorage.setItem('vendorBot_sidebarOpen', 'false');
            updateMenuIcon(false);
        } else {
            sidebar.classList.remove('closed');
            sidebar.classList.add('open');
            sidebar.style.width = sidebarWidth + 'px';
            sidebar.style.setProperty('width', sidebarWidth + 'px', 'important');
            localStorage.setItem('vendorBot_sidebarOpen', 'true');
            updateMenuIcon(true);
        }
    } else {
        // Mobile: toggle open class
        const isOpen = sidebar.classList.contains('open');
        sidebar.classList.toggle('open');
        const sidebarOverlay = document.getElementById('sidebarOverlay');
        if (sidebarOverlay) {
            sidebarOverlay.classList.toggle('hidden');
        }
        updateMenuIcon(!isOpen);
    }
};

// Fungsi untuk update icon menu (hamburger vs close/arrow)
function updateMenuIcon(isOpen) {
    sidebarToggleBtns.forEach(btn => {
        if (window.innerWidth < 768) {
            // Mobile icons
            btn.innerHTML = isOpen
                ? '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>'
                : '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>';
        } else {
            // Desktop icons
            btn.innerHTML = isOpen
                ? '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7"></path></svg>'
                : '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>';
        }
    });
}

// Resizing Logic
if (sidebarResizeHandle) {
    let isResizing = false;

    sidebarResizeHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        document.body.style.cursor = 'col-resize';
        document.body.classList.add('select-none'); // Disable text selection
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        if (e.clientX >= minSidebarWidth && e.clientX <= maxSidebarWidth) {
            sidebarWidth = e.clientX;
            sidebar.style.width = sidebarWidth + 'px';
            sidebar.style.setProperty('width', sidebarWidth + 'px', 'important');
        }
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = 'default';
            document.body.classList.remove('select-none');
            localStorage.setItem('vendorBot_sidebarWidth', sidebarWidth);
        }
    });
}

// Load Chat Histories on Start
loadChatHistories();

// Initialize Landing Page
initializeLandingPage();

function initializeLandingPage() {
    if (landingUserName) {
        const name = sessionStorage.getItem('vendorbot_user_name') || 'User';
        // Simple capitalization check or just display as is
        landingUserName.textContent = name;
    }

    if (startChatBtn) {
        startChatBtn.addEventListener('click', () => {
            showChatInterface();
        });
    }
}

function showChatInterface() {
    if (!landingPage || !chatInterface) return;

    // Check if already visible
    if (landingPage.classList.contains('hidden')) return;

    // Fade out landing page
    landingPage.classList.add('opacity-0');

    setTimeout(() => {
        landingPage.classList.add('hidden');
        chatInterface.classList.remove('hidden');

        // Trigger reflow/next frame for fade in
        requestAnimationFrame(() => {
            chatInterface.classList.remove('opacity-0');
        });
    }, 300); // Match duration-300
}

// Fungsi untuk menambahkan pesan ke chat
function addMessage(content, isUser = false, saveToHistory = true) {
    // Hide welcome message on first message
    if (welcomeMessage && welcomeMessage.style.display !== 'none') {
        welcomeMessage.style.display = 'none';
    }

    // CSS for message actions
    if (!document.getElementById('message-actions-style')) {
        const style = document.createElement('style');
        style.id = 'message-actions-style';
        style.textContent = `
            .message-actions {
                opacity: 0;
                transition: opacity 0.2s ease-in-out;
            }
            .chat-message:hover .message-actions {
                opacity: 1;
            }
            @media (max-width: 768px) {
                .message-actions {
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message flex items-end gap-2 md:gap-3 ' + (isUser ? 'justify-end' : 'justify-start');

    // Avatar
    const avatarDiv = document.createElement('div');
    avatarDiv.className = `flex-shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center ${isUser
        ? 'bg-[#01036f] order-2'
        : 'bg-gray-800 order-1'
        }`;

    if (isUser) {
        // User avatar icon
        const customAvatar = sessionStorage.getItem('vendorbot_user_avatar');

        if (customAvatar && customAvatar !== 'null' && customAvatar !== 'undefined') {
            avatarDiv.innerHTML = `<img src="${customAvatar}" class="w-full h-full object-cover rounded-full">`;
        } else {
            avatarDiv.innerHTML = `
                <svg class="w-5 h-5 md:w-6 md:h-6 text-white force-text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                </svg>
            `;
        }
    } else {
        // AI avatar - Robot with construction helmet
        avatarDiv.innerHTML = `
            <svg class="w-5 h-5 md:w-6 md:h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7z"/>
                <path d="M12 11c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" fill="#ffffff" opacity="0.3"/>
                <circle cx="10" cy="9" r="1" fill="#ffffff"/>
                <circle cx="14" cy="9" r="1" fill="#ffffff"/>
                <path d="M9 12h6" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
        `;
    }

    // Message bubble
    const messageContent = document.createElement('div');
    messageContent.className = `rounded-2xl px-3 md:px-4 py-2 md:py-2.5 ${isUser
        ? 'user-message-blue order-1 max-w-[85%] md:max-w-xl'
        : 'ai-message-bubble bg-gray-900 border border-gray-800 text-gray-100 max-w-[85%] md:max-w-xl'
        }`;

    // Unified Rendering Logic
    const renderedHTML = renderMarkdown(content);
    messageContent.innerHTML = renderedHTML;

    // Append avatar and message
    if (isUser) {
        messageDiv.appendChild(messageContent);
        messageDiv.appendChild(avatarDiv);
    } else {
        // Wrapper for AI message + Actions
        const wrapperDiv = document.createElement('div');
        wrapperDiv.className = 'flex flex-col max-w-[85%] md:max-w-xl order-2';

        wrapperDiv.appendChild(messageContent);

        // Action Buttons
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'message-actions flex items-center gap-2 mt-1 ml-1';

        // Copy Button
        const copyBtn = document.createElement('button');
        copyBtn.className = 'p-1 text-gray-400 hover:text-white transition-colors rounded hover:bg-gray-800';
        copyBtn.title = 'Salin pesan';
        copyBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>';
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(content).then(() => {
                const originalIcon = copyBtn.innerHTML;
                copyBtn.innerHTML = '<svg class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
                setTimeout(() => copyBtn.innerHTML = originalIcon, 2000);
            });
        };

        // Regenerate Button
        const regenBtn = document.createElement('button');
        regenBtn.className = 'p-1 text-gray-400 hover:text-white transition-colors rounded hover:bg-gray-800';
        regenBtn.title = 'Ulangi jawaban';
        regenBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>';
        regenBtn.onclick = async () => {
            if (lastUserMessage && !isGenerating) {
                // Remove this AI message
                messageDiv.remove();
                // Call send message again
                userInput.disabled = true;
                sendButton.disabled = true;
                await sendMessage(lastUserMessage);
            }
        };

        actionsDiv.appendChild(copyBtn);
        actionsDiv.appendChild(regenBtn);
        wrapperDiv.appendChild(actionsDiv);

        messageDiv.appendChild(avatarDiv);
        messageDiv.appendChild(wrapperDiv);
    }

    chatContainer.appendChild(messageDiv);

    // Scroll ke bawah
    // Scroll ke bawah
    if (chatScrollWrapper) {
        chatScrollWrapper.scrollTop = chatScrollWrapper.scrollHeight;
    } else {
        // Fallback for older layout
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // Save to history
    if (saveToHistory) {
        saveMessageToHistory(content, isUser);
    }

    return messageDiv;
}

// Fungsi untuk menampilkan typing indicator
function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'chat-message flex items-end gap-2 md:gap-3 justify-start';
    typingDiv.id = 'typingIndicator';

    // Avatar for typing indicator
    const typingAvatar = document.createElement('div');
    typingAvatar.className = 'flex-shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full bg-gray-800 flex items-center justify-center order-1';
    typingAvatar.innerHTML = `
        <svg class="w-5 h-5 md:w-6 md:h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7z"/>
            <path d="M12 11c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" fill="#ffffff" opacity="0.3"/>
            <circle cx="10" cy="9" r="1" fill="#ffffff"/>
            <circle cx="14" cy="9" r="1" fill="#ffffff"/>
            <path d="M9 12h6" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
    `;

    const typingContent = document.createElement('div');
    typingContent.className = 'bg-gray-900 border border-gray-800 text-gray-100 rounded-2xl px-3 md:px-4 py-2 md:py-2.5 max-w-[85%] md:max-w-xl order-2';
    typingContent.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';

    typingDiv.appendChild(typingAvatar);
    typingDiv.appendChild(typingContent);
    chatContainer.appendChild(typingDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    return typingDiv;
}

// Unified Markdown Renderer
function renderMarkdown(text) {
    let htmlContent = '';

    // Try external library first
    if (typeof marked !== 'undefined') {
        try {
            htmlContent = marked.parse(text);
        } catch (e) {
            console.warn('Marked.js failed, using fallback', e);
            htmlContent = parseMarkdownSimple(text);
        }
    } else {
        htmlContent = parseMarkdownSimple(text);
    }

    // Wrap in prose for consistent styling
    // Added 'leading-snug' for tighter line height
    return `<div class="prose max-w-none text-sm leading-snug">${htmlContent}</div>`;
}

// Internal Simple Markdown Parser (Backup if CDN fails)
// REWRITTEN: Now groups lists correctly to fix spacing issues
function parseMarkdownSimple(text) {
    if (!text) return '';

    // Split by lines
    const lines = text.split('\n');
    let html = '';
    let currentListType = null; // 'ul' or 'ol'

    lines.forEach((line, index) => {
        const trimmed = line.trim();

        // 1. Headers (###, ##, #)
        const h3Match = line.match(/^###\s+(.*$)/);
        const h2Match = line.match(/^##\s+(.*$)/);
        const h1Match = line.match(/^#\s+(.*$)/);

        // 2. Lists
        const ulMatch = line.match(/^\s*[-*]\s+(.*$)/);
        const olMatch = line.match(/^\s*(\d+)\.\s+(.*$)/);

        // Handle closing lists if not a list item
        if (currentListType && !ulMatch && !olMatch && trimmed !== '') {
            html += `</${currentListType}>`;
            currentListType = null;
        }

        // Processing
        if (h3Match) {
            html += `<h3 class="font-bold text-lg mt-4 mb-2">${processInline(h3Match[1])}</h3>`;
        } else if (h2Match) {
            html += `<h2 class="font-bold text-xl mt-5 mb-3 border-b border-gray-300 pb-1">${processInline(h2Match[1])}</h2>`;
        } else if (h1Match) {
            html += `<h1 class="font-bold text-2xl mt-6 mb-4">${processInline(h1Match[1])}</h1>`;
        } else if (ulMatch) {
            if (currentListType !== 'ul') {
                if (currentListType) html += `</${currentListType}>`;
                html += '<ul>';
                currentListType = 'ul';
            }
            html += `<li>${processInline(ulMatch[1])}</li>`;
        } else if (olMatch) {
            if (currentListType !== 'ol') {
                if (currentListType) html += `</${currentListType}>`;
                html += '<ol>';
                currentListType = 'ol';
            }
            html += `<li value="${olMatch[1]}">${processInline(olMatch[2])}</li>`;
        } else if (trimmed === '') {
            // Empty line: just ignore or add tiny spacer if needed, but for tightness we ignore multiple newlines
            // Unless we want paragraph separation.
        } else {
            // Plain paragraph
            html += `<p>${processInline(line)}</p>`;
        }
    });

    // Close any open list
    if (currentListType) {
        html += `</${currentListType}>`;
    }

    return html;
}

// Helper for bold/italic in fallback
function processInline(text) {
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}

// Fungsi untuk menghapus typing indicator
function removeTypingIndicator() {
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

// Fungsi untuk mengirim pesan ke AI
async function sendMessage(message) {
    if (isGenerating) return;

    try {
        isGenerating = true;
        lastUserMessage = message;

        // UI State: Show Stop, Hide others
        stopButton.style.display = 'flex';
        sendButton.style.display = 'none';

        // Initialize AbortController for cancelation
        abortController = new AbortController();

        // Tampilkan typing indicator
        showTypingIndicator();

        // Create initial empty message bubble for streaming
        let currentAiMessageDiv = null;
        let accumulatedText = '';

        // Kirim request melalui proxy server
        const response = await fetch(API_URL, {
            method: 'POST',
            signal: abortController.signal,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: message,
                email: sessionStorage.getItem('vendorbot_user_email'),
                model: (typeof CONFIG !== 'undefined' && CONFIG.MODEL) ? CONFIG.MODEL : 'openai/gpt-4o-mini',
                temperature: (typeof CONFIG !== 'undefined' && CONFIG.TEMPERATURE) ? CONFIG.TEMPERATURE : 0.7,
                max_completion_tokens: 16000,
                history: (() => {
                    // Get last 10 messages from current chat for context
                    if (!currentChatId) return [];
                    const currentChat = chatHistories.find(c => c.id === currentChatId);
                    if (!currentChat || !currentChat.messages) return [];
                    // Return last 10 messages, excluding the one we just added (if any) or duplicates
                    // Actually, we haven't added the new user message to 'chatHistories' yet in this function flow?
                    // Check logic: addMessage(message, true) is called BEFORE sendMessage in 'submit' listener.
                    // So chatHistories HAS the latest user message. We should exclude it to avoid double sending or rely on server to handle?
                    // Server appends 'userMessage' separately. So we should Exclude the very last message if it matches 'message'.
                    const historyMsgs = currentChat.messages.slice(-5, -1); // user msg is last. take previous 4.
                    return historyMsgs.map(m => ({ role: m.role, content: m.content }));
                })()
            })
        });

        // Hapus typing indicator once connection established
        removeTypingIndicator();

        if (!response.ok) {
            if (response.status === 429) {
                throw new Error('Terlalu banyak permintaan (Rate Limit). Mohon tunggu beberapa saat sebelum mencoba lagi.');
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Handle Streaming Response
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');

        // Buat bubble pesan AI kosong
        currentAiMessageDiv = addMessage('', false, false); // false = jangan simpan ke history dulu
        const messageContentDiv = currentAiMessageDiv.querySelector('.text-sm'); // Target inner div

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.slice(6);
                    if (dataStr === '[DONE]') continue;

                    try {
                        const parsed = JSON.parse(dataStr);
                        const content = parsed.content;
                        if (content) {
                            accumulatedText += content;

                            // Simple incremental render (re-render markdown occasionally or just text)
                            // Untuk performa terbaik, kita update innerHTML
                            // Note: Re-rendering full markdown on every char is heavy, but usually fine for text chats.
                            // If laggy, we can optimize to update every N chars.

                            // Use existing format logic from addMessage but applied dynamically
                            // We need to replicate the formatting logic or extract it.
                            // For now, simpler approach: update content.

                            // MARKDOWN RENDERING (Robust Fallback)
                            const rendered = renderMarkdown(accumulatedText);
                            messageContentDiv.innerHTML = rendered;

                            // Scroll to bottom
                            // Scroll to bottom
                            if (chatScrollWrapper) {
                                chatScrollWrapper.scrollTop = chatScrollWrapper.scrollHeight;
                            } else {
                                chatContainer.scrollTop = chatContainer.scrollHeight;
                            }
                        }
                    } catch (e) {
                        // ignore parse errors for partial chunks
                    }
                }
            }
        }

        // Final save to history
        saveMessageToHistory(accumulatedText, false);

        // EXTRA: Trigger Auto Title Generation after first turn
        const currentChat = chatHistories.find(c => c.id === currentChatId);
        // messages.length should be 2 (User + AI) for the first turn. 
        // Sometimes it might be slightly more if there are system messages, but typically 2.
        if (currentChat && currentChat.messages.length === 2 && currentChat.title === 'Chat Baru') {
            generateChatTitle(currentChatId);
        }

    } catch (error) {
        removeTypingIndicator();

        if (error.name === 'AbortError') {
            console.log('🛑 Generation stopped by user');
            addMessage('_Proses dihentikan oleh pengguna._', false);
        } else {
            console.error('Error details:', error);
            let errorMessage = error.message || 'Terjadi kesalahan. Silakan coba lagi.';
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                errorMessage = 'Tidak dapat terhubung ke server. Pastikan server proxy berjalan di http://localhost:3000';
            }
            addMessage(`❌ Error: ${errorMessage}`, false);
        }
    } finally {
        isGenerating = false;
        abortController = null;
        stopButton.style.display = 'none';
        sendButton.style.display = 'flex';
        sendButton.disabled = false;
        userInput.disabled = false;
    }
}

// Autogenerate Title Function
async function generateChatTitle(chatId) {
    try {
        const chat = chatHistories.find(c => c.id === chatId);
        if (!chat) return;

        const email = getCurrentUserEmail();
        // Use separate endpoint
        const response = await fetch(`${API_URL}/generate-title`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: chat.messages,
                email: email
            })
        });

        if (response.ok) {
            const data = await response.json();
            if (data.title) {
                // Update local state
                chat.title = data.title;
                // Update UI
                renderChatHistory();
                // Save to backend
                saveChatSession(chat);
            }
        }
    } catch (e) {
        console.warn('Silent fail: Auto title generation', e);
    }
}

// Handle form submission
if (chatForm) {
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const message = userInput.value.trim();
    if (!message) return;

    // Ensure we have a chat ID before adding message
    if (!currentChatId) {
        const chatId = 'chat_' + Date.now();
        const newChat = {
            id: chatId,
            title: 'Chat Baru',
            messages: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        chatHistories.unshift(newChat);
        currentChatId = chatId;
        saveChatHistories();
        renderChatHistory();

        // Hide welcome message
        if (welcomeMessage) {
            welcomeMessage.style.display = 'none';
        }
    }

    // Tampilkan pesan user
    addMessage(message, true);

    // Clear input
    userInput.value = '';
    userInput.style.height = 'auto';

    // Disable button dan input saat processing
    sendButton.disabled = true;
    userInput.disabled = true;

    // Kirim ke AI
    await sendMessage(message);
});
}

// Theme Toggle
const themeToggles = [
    document.getElementById('themeToggleLanding'),
    document.getElementById('themeToggleChat')
].filter(el => el !== null);

// Icons inside toggles
const themeIcons = [
    document.getElementById('themeIconLanding'),
    document.getElementById('themeIconChat')
].filter(el => el !== null);

// Load theme preference
function loadTheme() {
    let savedTheme = localStorage.getItem('vendorBot_theme');

    // Default to dark
    if (!savedTheme) {
        savedTheme = 'dark';
        localStorage.setItem('vendorBot_theme', 'dark');
    }

    const isLight = savedTheme === 'light';
    document.body.classList.toggle('light-mode', isLight);

    // Also sync to documentElement for absolute consistency with head script
    document.documentElement.classList.toggle('light-mode', isLight);

    updateThemeIcon(savedTheme);
}

// Update theme icon
function updateThemeIcon(theme) {
    themeIcons.forEach(icon => {
        if (theme === 'light') {
            icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>';
        } else {
            icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>';
        }
    });
}

// Toggle theme
themeToggles.forEach(toggle => {
    toggle.addEventListener('click', () => {
        const isLightMode = document.body.classList.contains('light-mode');
        const newTheme = isLightMode ? 'dark' : 'light';

        document.body.classList.toggle('light-mode');
        localStorage.setItem('vendorBot_theme', newTheme);
        updateThemeIcon(newTheme);
    });
});

// Initialize theme
loadTheme();

// Handle Enter key (Shift+Enter untuk new line)
if (userInput) {
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (chatForm) chatForm.dispatchEvent(new Event('submit'));
        }
    });
}

// Stop Generating
if (stopButton) {
    stopButton.addEventListener('click', () => {
        if (abortController) {
            abortController.abort();
        }
    });
}


// --- PROFILE SETTINGS LOGIC ---

const profileModal = document.getElementById('profileModal');
const profileModalContent = document.getElementById('profileModalContent');
const profileModalBackdrop = document.getElementById('profileModalBackdrop');
const settingsBtn = document.getElementById('settingsBtn');
const closeProfileModalBtn = document.getElementById('closeProfileModal');
const profileForm = document.getElementById('profileForm');
const avatarInput = document.getElementById('avatarInput');
const profilePreview = document.getElementById('profilePreview');
const defaultProfileIcon = document.getElementById('defaultProfileIcon');
const saveProfileBtn = document.getElementById('saveProfileBtn');
const saveStatus = document.getElementById('saveStatus');
const logoutBtn = document.getElementById('logoutBtn');

// Tabs
const tabUmumBtn = document.getElementById('tabUmumBtn');
const tabAkunBtn = document.getElementById('tabAkunBtn');
const tabUmum = document.getElementById('tabUmum');
const tabAkun = document.getElementById('tabAkun');

// Sidebar Profile Sync
function updateSidebarProfile() {
    const userName = sessionStorage.getItem('vendorbot_user_name') || sessionStorage.getItem('vendorbot_user_fullname') || 'User';
    const userAvatar = sessionStorage.getItem('vendorbot_user_avatar');

    const nameDisplay = document.getElementById('userNameDisplay');
    const initialDisplay = document.getElementById('userInitial');
    const initialContainer = document.getElementById('sidebarInitialContainer');
    const avatarImg = document.getElementById('sidebarAvatar');

    if (nameDisplay) nameDisplay.textContent = userName;
    if (initialDisplay) initialDisplay.textContent = userName.charAt(0).toUpperCase();

    // Also update Landing Page Greeting
    if (landingUserName) landingUserName.textContent = userName;

    if (userAvatar && avatarImg) {
        avatarImg.src = userAvatar;
        avatarImg.classList.remove('hidden');
        if (initialContainer) initialContainer.classList.add('hidden');
    } else {
        if (avatarImg) avatarImg.classList.add('hidden');
        if (initialContainer) initialContainer.classList.remove('hidden');
    }
}

// Logout Handler
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        if (confirm('Apakah Anda yakin ingin keluar?')) {
            // Clear Session
            sessionStorage.clear();
            // Clear Persistent Login (Remember Me)
            localStorage.removeItem('vendorbot_logged_in');
            // Redirect
            window.location.href = 'login.html';
        }
    });
}

// Tab Navigation
function switchTab(target) {
    if (!tabUmum || !tabAkun || !tabUmumBtn || !tabAkunBtn) return;

    const activeClasses = ['bg-blue-600/10', 'text-blue-400', 'border', 'border-blue-500/20', 'shadow-[0_0_15px_rgba(59,130,246,0.1)]'];
    const inactiveClasses = ['text-gray-400', 'hover:text-white', 'hover:bg-white/5'];

    if (target === 'umum') {
        tabUmum.classList.remove('hidden');
        tabAkun.classList.add('hidden');
        tabUmumBtn.classList.add(...activeClasses);
        tabUmumBtn.classList.remove(...inactiveClasses);
        tabAkunBtn.classList.remove(...activeClasses);
        tabAkunBtn.classList.add(...inactiveClasses);
    } else {
        tabAkun.classList.remove('hidden');
        tabUmum.classList.add('hidden');
        tabAkunBtn.classList.add(...activeClasses);
        tabAkunBtn.classList.remove(...inactiveClasses);
        tabUmumBtn.classList.remove(...activeClasses);
        tabUmumBtn.classList.add(...inactiveClasses);
    }
}

if (tabUmumBtn) tabUmumBtn.addEventListener('click', () => switchTab('umum'));
if (tabAkunBtn) tabAkunBtn.addEventListener('click', () => switchTab('akun'));

// Settings Toggles
const modalThemeToggle = document.getElementById('modalThemeToggle');
const compactModeToggle = document.getElementById('compactModeToggle');

// Sync Theme Function
function syncThemeUI(theme) {
    const themeIcons = [
        document.getElementById('themeIconLanding'),
        document.getElementById('themeIconChat')
    ].filter(el => el !== null);

    const modalThemeIcon = modalThemeToggle.querySelector('svg');

    if (theme === 'light') {
        themeIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z"></path>';
        if (modalThemeIcon) modalThemeIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z"></path>';
    } else {
        themeIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>';
        if (modalThemeIcon) modalThemeIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>';
    }
}

modalThemeToggle.addEventListener('click', () => {
    if (themeToggles.length > 0) themeToggles[0].click(); // Simulate click on main toggle
    const currentTheme = document.body.classList.contains('light-mode') ? 'light' : 'dark';
    syncThemeUI(currentTheme);
});

// Compact Mode
if (compactModeToggle) {
    const isCompact = localStorage.getItem('vendorBot_compact') === 'true';
    compactModeToggle.checked = isCompact;
    if (isCompact) document.body.classList.add('compact-mode');

    compactModeToggle.addEventListener('change', (e) => {
        const checked = e.target.checked;
        if (checked) {
            document.body.classList.add('compact-mode');
        } else {
            document.body.classList.remove('compact-mode');
        }
        localStorage.setItem('vendorBot_compact', checked);
    });
}

// Open Modal Function
async function openProfileModal() {
    if (!profileModal) return;
    profileModal.classList.add('active');
    await fetchUserProfile();
}

// Close Modal Function
function closeProfileModal() {
    if (!profileModal) return;
    profileModal.classList.remove('active');
    if (saveStatus) saveStatus.textContent = '';
}

// Helper to safely attach settings listener
function attachSettingsListener() {
    const btn = document.getElementById('settingsBtn');
    if (btn) {
        // Remove old listener to avoid duplicates if called multiple times (though anonymous func makes it hard, cloneNode is overkill)
        // ideally we just set onclick for simplicity in this specific "fix-it" scenario, or check if already handled.
        // For now, standard addEventListener is fine but let's wrap it to be safe.
        btn.onclick = (e) => {
            e.preventDefault();
            openProfileModal();
        };
    }
}

// Try attaching immediately and on DOMContentLoaded
attachSettingsListener();
document.addEventListener('DOMContentLoaded', attachSettingsListener);
if (closeProfileModalBtn) closeProfileModalBtn.addEventListener('click', closeProfileModal);
if (profileModalBackdrop) profileModalBackdrop.addEventListener('click', closeProfileModal);

// Avatar Preview
if (avatarInput) {
    avatarInput.addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (file) {
            // Validate size (1MB)
            if (file.size > 1024 * 1024) {
                alert('Ukuran file maksimal 1MB');
                this.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = function (e) {
                profilePreview.src = e.target.result;
                profilePreview.classList.remove('hidden');
                defaultProfileIcon.classList.add('hidden');
            }
            reader.readAsDataURL(file);
        }
    });
}

// Fetch Profile
async function fetchUserProfile() {
    const email = getCurrentUserEmail();
    if (!email) return;

    try {
        const response = await fetch(`${BASE_API_URL}/chat/profile?email=${encodeURIComponent(email)}`);
        if (response.ok) {
            const user = await response.json();

            document.getElementById('profileName').value = user.fullname || '';
            document.getElementById('profileEmail').value = user.email || '';
            document.getElementById('profileRole').value = user.role || '';

            if (user.fullname) {
                // UPDATE SESSION FIRST
                sessionStorage.setItem('vendorbot_user_fullname', user.fullname);
                sessionStorage.setItem('vendorbot_user_name', user.fullname);
            }
            if (user.role) {
                sessionStorage.setItem('vendorbot_user_role', user.role);
            }

            // Handle Avatar Display
            if (user.profile_picture) {
                // Ensure URL is absolute or handled correctly
                const avatarUrl = user.profile_picture;
                profilePreview.src = avatarUrl;
                profilePreview.classList.remove('hidden');
                defaultProfileIcon.classList.add('hidden');

                // Sync session
                sessionStorage.setItem('vendorbot_user_avatar', avatarUrl);
            } else {
                profilePreview.src = '';
                profilePreview.classList.add('hidden');
                defaultProfileIcon.classList.remove('hidden');
                sessionStorage.removeItem('vendorbot_user_avatar');
            }
        }
    } catch (e) {
        console.error('Failed to fetch profile:', e);
    } finally {
        updateSidebarProfile();
    }
}

// Submit Profile
if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = getCurrentUserEmail();
        const fullname = document.getElementById('profileName').value;
        const file = avatarInput.files[0];

        const formData = new FormData();
        formData.append('email', email);
        formData.append('fullname', fullname);
        if (file) {
            formData.append('avatar', file);
        }

        // Show loading state
        const originalBtnText = saveProfileBtn.innerHTML;
        saveProfileBtn.disabled = true;
        saveProfileBtn.innerHTML = '<span class="auth-guard-spinner w-5 h-5 border-2"></span> Menyimpan...';
        saveStatus.textContent = '';
        saveStatus.className = 'flex items-center justify-center mt-2 h-6 text-sm font-medium';

        try {
            const response = await fetch(`${BASE_API_URL}/chat/profile`, {
                method: 'POST',
                body: formData // No Content-Type header needed for FormData
            });

            const result = await response.json();

            if (response.ok) {
                saveStatus.textContent = 'Berhasil disimpan!';
                saveStatus.classList.add('text-green-500');

                // Update session
                sessionStorage.setItem('vendorbot_user_fullname', result.user.fullname);
                sessionStorage.setItem('vendorbot_user_name', result.user.fullname); // Sync name
                if (result.user.profile_picture) {
                    sessionStorage.setItem('vendorbot_user_avatar', result.user.profile_picture);
                }

                updateSidebarProfile(); // Update sidebar immediately

                setTimeout(closeProfileModal, 1500);
            } else {
                saveStatus.textContent = result.error || 'Gagal menyimpan.';
                saveStatus.classList.add('text-red-500');
            }
        } catch (e) {
            console.error(e);
            saveStatus.textContent = 'Terjadi kesalahan jaringan.';
            saveStatus.classList.add('text-red-500');
        } finally {
            saveProfileBtn.disabled = false;
            saveProfileBtn.innerHTML = originalBtnText;
        }
    });
}
// Initialize Profile on Load (Silent Sync)
fetchUserProfile();

// --- RESET PASSWORD LOGIC ---
document.addEventListener('DOMContentLoaded', () => {
    const startResetBtn = document.getElementById('startResetBtn');
    const resetPasswordForm = document.getElementById('resetPasswordForm');
    const currentPasswordStep = document.getElementById('currentPasswordStep');
    const newPasswordStep = document.getElementById('newPasswordStep');

    const verifyPasswordBtn = document.getElementById('verifyPasswordBtn');
    const saveNewPasswordBtn = document.getElementById('saveNewPasswordBtn');
    const cancelResetBtn = document.getElementById('cancelResetBtn');

    const currentPasswordInput = document.getElementById('currentPassword');
    const newPasswordInput = document.getElementById('newPassword');
    const confirmNewPasswordInput = document.getElementById('confirmNewPassword');
    const resetFeedback = document.getElementById('resetFeedback');

    if (!startResetBtn) return; // Guard clause if elements don't exist

    // Helper to show feedback
    const showFeedback = (message, type = 'error') => {
        resetFeedback.textContent = message;
        resetFeedback.className = `text-xs text-center min-h-[1.5em] font-medium ${type === 'success' ? 'text-green-500' : 'text-red-500'}`;
    };

    // 1. Start Reset Flow
    startResetBtn.addEventListener('click', () => {
        startResetBtn.classList.add('hidden');
        resetPasswordForm.classList.remove('hidden');
        currentPasswordStep.classList.remove('hidden');
        newPasswordStep.classList.add('hidden');
        resetFeedback.textContent = '';
        currentPasswordInput.value = '';
    });

    // 2. Verify Current Password
    verifyPasswordBtn.addEventListener('click', async () => {
        const password = currentPasswordInput.value;
        if (!password) {
            showFeedback('Masukkan password saat ini');
            return;
        }

        verifyPasswordBtn.disabled = true;
        verifyPasswordBtn.textContent = 'Memverifikasi...';

        try {
            const email = getCurrentUserEmail();
            const response = await fetch(`${BASE_API_URL}/auth/verify-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const result = await response.json();

            if (response.ok && result.valid) {
                // Success: Move to next step
                currentPasswordStep.classList.add('hidden');
                newPasswordStep.classList.remove('hidden');
                resetFeedback.textContent = '';
            } else {
                showFeedback(result.error || result.message || 'Password salah');
            }
        } catch (error) {
            showFeedback('Terjadi kesalahan jaringan');
        } finally {
            verifyPasswordBtn.disabled = false;
            verifyPasswordBtn.textContent = 'Lanjut';
        }
    });

    // 3. Save New Password
    saveNewPasswordBtn.addEventListener('click', async () => {
        const newPass = newPasswordInput.value;
        const confirmPass = confirmNewPasswordInput.value;

        if (newPass.length < 6) {
            showFeedback('Password minimal 6 karakter');
            return;
        }

        if (newPass !== confirmPass) {
            showFeedback('Password tidak cocok');
            return;
        }

        saveNewPasswordBtn.disabled = true;
        saveNewPasswordBtn.textContent = 'Menyimpan...';

        try {
            const email = getCurrentUserEmail();
            const response = await fetch(`${BASE_API_URL}/auth/update-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, newPassword: newPass })
            });

            const result = await response.json();

            if (response.ok) {
                showFeedback('Password berhasil diubah!', 'success');
                setTimeout(() => {
                    // Reset UI
                    startResetBtn.classList.remove('hidden');
                    resetPasswordForm.classList.add('hidden');
                    newPasswordStep.classList.add('hidden');
                    currentPasswordInput.value = '';
                    newPasswordInput.value = '';
                    confirmNewPasswordInput.value = '';
                    resetFeedback.textContent = '';
                }, 1500);
            } else {
                showFeedback(result.error || 'Gagal mengubah password');
            }
        } catch (error) {
            showFeedback('Terjadi kesalahan jaringan');
        } finally {
            saveNewPasswordBtn.disabled = false;
            saveNewPasswordBtn.textContent = 'Simpan';
        }
    });

    // Cancel Button
    cancelResetBtn.addEventListener('click', () => {
        startResetBtn.classList.remove('hidden');
        resetPasswordForm.classList.add('hidden');
        currentPasswordInput.value = '';
        newPasswordInput.value = '';
        confirmNewPasswordInput.value = '';
        resetFeedback.textContent = '';
    });
});
