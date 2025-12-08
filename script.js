// Konfigurasi API
// Gunakan proxy server untuk menghindari masalah CORS
const API_URL = (typeof CONFIG !== 'undefined' && CONFIG.PROXY_URL) 
    ? CONFIG.PROXY_URL 
    : 'http://localhost:3000/api/chat';

// Elemen DOM
const chatContainer = document.getElementById('chatContainer');
const chatForm = document.getElementById('chatForm');
const userInput = document.getElementById('userInput');
const sendButton = document.getElementById('sendButton');
const newChatBtn = document.getElementById('newChatBtn');
const chatHistoryList = document.getElementById('chatHistoryList');
const sidebarToggle = document.getElementById('sidebarToggle');
const sidebar = document.getElementById('sidebar');
const welcomeMessage = document.getElementById('welcomeMessage');

// State management
let currentChatId = null;
let chatHistories = [];

// Auto-resize textarea
userInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

// Chat History Management
function loadChatHistories() {
    const saved = localStorage.getItem('vendorBot_chatHistories');
    if (saved) {
        chatHistories = JSON.parse(saved);
    } else {
        chatHistories = [];
    }
    renderChatHistory();
}

function saveChatHistories() {
    localStorage.setItem('vendorBot_chatHistories', JSON.stringify(chatHistories));
}

function createNewChat() {
    const chatId = 'chat_' + Date.now();
    const newChat = {
        id: chatId,
        title: 'Chat Baru',
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    chatHistories.unshift(newChat);
    saveChatHistories();
    renderChatHistory();
    
    // Set current chat ID without clearing container if it's empty
    currentChatId = chatId;
    
    // Only clear and reload if there are existing messages
    // For new chat, keep the current container content
    if (chatContainer.children.length > 0) {
        loadChat(chatId);
    } else {
        // Just update the current chat ID and hide welcome message if needed
        if (welcomeMessage) {
            welcomeMessage.style.display = 'none';
        }
    }
}

function loadChat(chatId) {
    const chat = chatHistories.find(c => c.id === chatId);
    if (!chat) return;
    
    currentChatId = chatId;
    
    // Clear chat container
    chatContainer.innerHTML = '';
    
    // Hide welcome message if there are messages
    if (chat.messages.length > 0) {
        welcomeMessage.style.display = 'none';
    } else {
        welcomeMessage.style.display = 'flex';
    }
    
    // Load messages
    chat.messages.forEach(msg => {
        addMessage(msg.content, msg.isUser, false);
    });
    
    // Update chat title if needed
    updateChatTitle();
    
    // Update active state in sidebar
    renderChatHistory();
    
    // Close sidebar on mobile
    if (window.innerWidth < 768) {
        sidebar.classList.remove('open');
    }
}

function updateChatTitle() {
    if (!currentChatId) return;
    
    const chat = chatHistories.find(c => c.id === currentChatId);
    if (!chat) return;
    
    // Get first user message as title
    const firstUserMessage = chat.messages.find(m => m.isUser);
    if (firstUserMessage) {
        const title = firstUserMessage.content.substring(0, 30) + (firstUserMessage.content.length > 30 ? '...' : '');
        chat.title = title;
        chat.updatedAt = new Date().toISOString();
        saveChatHistories();
        renderChatHistory();
    }
}

function renderChatHistory() {
    chatHistoryList.innerHTML = '';
    
    if (chatHistories.length === 0) {
        chatHistoryList.innerHTML = '<div class="text-gray-500 text-sm px-3 py-2 text-center">Belum ada riwayat chat</div>';
        return;
    }
    
    chatHistories.forEach(chat => {
        const item = document.createElement('div');
        item.className = `chat-history-item px-3 py-2 rounded-lg cursor-pointer group ${
            currentChatId === chat.id ? 'active' : ''
        }`;
        item.innerHTML = `
            <div class="flex items-center space-x-2">
                <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                </svg>
                <span class="text-gray-300 text-sm truncate flex-1">${chat.title}</span>
                <button class="chat-history-delete text-gray-400 hover:text-red-400 transition-colors duration-200 p-1 rounded hover:bg-gray-800" 
                        onclick="event.stopPropagation(); deleteChat('${chat.id}')"
                        title="Hapus chat">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                </button>
            </div>
        `;
        item.addEventListener('click', () => loadChat(chat.id));
        chatHistoryList.appendChild(item);
    });
}

// Fungsi untuk menghapus chat (global untuk onclick)
window.deleteChat = function(chatId) {
    if (confirm('Apakah Anda yakin ingin menghapus chat ini?')) {
        chatHistories = chatHistories.filter(c => c.id !== chatId);
        saveChatHistories();
        
        // Jika chat yang dihapus adalah chat aktif, clear chat container
        if (currentChatId === chatId) {
            chatContainer.innerHTML = '';
            welcomeMessage.style.display = 'flex';
            currentChatId = null;
        }
        
        renderChatHistory();
    }
};

function saveMessageToHistory(content, isUser) {
    // Ensure we have a current chat ID before saving
    if (!currentChatId) {
        // Create new chat but don't clear the container
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
    }
    
    const chat = chatHistories.find(c => c.id === currentChatId);
    if (chat) {
        chat.messages.push({
            content: content,
            isUser: isUser,
            timestamp: new Date().toISOString()
        });
        chat.updatedAt = new Date().toISOString();
        saveChatHistories();
        updateChatTitle();
    }
}

// Initialize
loadChatHistories();

// Event Listeners
newChatBtn.addEventListener('click', () => {
    createNewChat();
});

const sidebarOverlay = document.getElementById('sidebarOverlay');

sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    if (window.innerWidth < 768) {
        sidebarOverlay.classList.toggle('hidden');
    }
});

// Close sidebar when clicking overlay
sidebarOverlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.add('hidden');
});

// Close sidebar when clicking outside on mobile
document.addEventListener('click', (e) => {
    if (window.innerWidth < 768) {
        if (!sidebar.contains(e.target) && !sidebarToggle.contains(e.target) && !sidebarOverlay.contains(e.target)) {
            sidebar.classList.remove('open');
            sidebarOverlay.classList.add('hidden');
        }
    }
});

// Handle window resize
window.addEventListener('resize', () => {
    if (window.innerWidth >= 768) {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.add('hidden');
    }
});

// Fungsi untuk mendapatkan API key
// Prioritas: 1. File config.js, 2. localStorage, 3. Prompt user
async function getApiKey() {
    // 1. Cek dari file config.js terlebih dahulu
    if (typeof CONFIG !== 'undefined' && CONFIG.MAIA_API_KEY && CONFIG.MAIA_API_KEY !== 'your_maia_api_key_here') {
        const key = CONFIG.MAIA_API_KEY.trim();
        if (key) {
            console.log('✅ Using API key from config.js');
            return key;
        }
    }
    
    // 2. Cek localStorage
    let apiKey = localStorage.getItem('maia_api_key');
    
    if (apiKey && apiKey.trim()) {
        console.log('✅ Using API key from localStorage');
        return apiKey.trim();
    }
    
    // 3. Prompt user untuk memasukkan API key jika belum ada
    apiKey = prompt('Masukkan API Key Maia Anda:\n\n(API Key akan disimpan di localStorage browser Anda)\n\nUntuk mendapatkan API Key, hubungi info@prodlane.io');
    if (apiKey && apiKey.trim()) {
        localStorage.setItem('maia_api_key', apiKey.trim());
        console.log('✅ API key saved to localStorage');
        return apiKey.trim();
    } else {
        alert('API Key diperlukan untuk menggunakan aplikasi ini.\n\nSilakan edit file config.js dan masukkan API Key Maia Anda, atau masukkan melalui prompt ini.\n\nHubungi info@prodlane.io untuk mendapatkan API Key.');
        return null;
    }
}

// Fungsi untuk menambahkan pesan ke chat
function addMessage(content, isUser = false, saveToHistory = true) {
    // Hide welcome message on first message
    if (welcomeMessage && welcomeMessage.style.display !== 'none') {
        welcomeMessage.style.display = 'none';
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message flex items-end gap-2 md:gap-3 ' + (isUser ? 'justify-end' : 'justify-start');
    
    // Avatar
    const avatarDiv = document.createElement('div');
    avatarDiv.className = `flex-shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center ${
        isUser 
            ? 'bg-[#01036f] order-2' 
            : 'bg-gray-800 order-1'
    }`;
    
    if (isUser) {
        // User avatar icon
        avatarDiv.innerHTML = `
            <svg class="w-5 h-5 md:w-6 md:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
            </svg>
        `;
    } else {
        // AI avatar - Robot with construction helmet
        avatarDiv.innerHTML = `
            <svg class="w-5 h-5 md:w-6 md:h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <!-- Construction Helmet Base -->
                <path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7z"/>
                <!-- Helmet Visor -->
                <path d="M12 11c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" fill="#ffffff" opacity="0.3"/>
                <!-- Robot Eyes -->
                <circle cx="10" cy="9" r="1" fill="#ffffff"/>
                <circle cx="14" cy="9" r="1" fill="#ffffff"/>
                <!-- Robot Mouth -->
                <path d="M9 12h6" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
        `;
    }
    
    // Message bubble - More fit with better padding
    const messageContent = document.createElement('div');
    messageContent.className = `rounded-2xl px-3 md:px-4 py-2 md:py-2.5 max-w-[80%] md:max-w-xl ${
        isUser 
            ? 'user-message-blue order-1' 
            : 'bg-gray-900 border border-gray-800 text-gray-100 order-2'
    }`;
    
    // Format pesan dengan markdown support (bold)
    let formattedContent = content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Convert **text** to <strong>text</strong>
        .replace(/\n/g, '<br>'); // Convert line breaks
    
    messageContent.innerHTML = `<p class="text-sm md:text-base whitespace-pre-wrap break-words leading-relaxed m-0">${formattedContent}</p>`;
    
    // Append avatar and message
    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(messageContent);
    chatContainer.appendChild(messageDiv);
    
    // Scroll ke bawah
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
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
            <!-- Construction Helmet Base -->
            <path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7z"/>
            <!-- Helmet Visor -->
            <path d="M12 11c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" fill="#ffffff" opacity="0.3"/>
            <!-- Robot Eyes -->
            <circle cx="10" cy="9" r="1" fill="#ffffff"/>
            <circle cx="14" cy="9" r="1" fill="#ffffff"/>
            <!-- Robot Mouth -->
            <path d="M9 12h6" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
    `;
    
    const typingContent = document.createElement('div');
    typingContent.className = 'bg-gray-900 border border-gray-800 rounded-2xl px-3 md:px-4 py-2 md:py-2.5 max-w-[80%] md:max-w-xl order-2';
    typingContent.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    
    typingDiv.appendChild(typingAvatar);
    typingDiv.appendChild(typingContent);
    chatContainer.appendChild(typingDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    return typingDiv;
}

// Fungsi untuk menghapus typing indicator
function removeTypingIndicator() {
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

// Fungsi untuk mengirim pesan ke OpenAI
async function sendMessage(message) {
    try {
        const apiKey = await getApiKey();
        if (!apiKey) {
            return;
        }
        
        // Tampilkan typing indicator
        showTypingIndicator();
        
        // Kirim request melalui proxy server
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                apiKey: apiKey, // Kirim API key melalui body (proxy akan handle)
                message: message,
                model: (typeof CONFIG !== 'undefined' && CONFIG.MODEL) ? CONFIG.MODEL : 'openai/gpt-4o-mini',
                temperature: (typeof CONFIG !== 'undefined' && CONFIG.TEMPERATURE) ? CONFIG.TEMPERATURE : 0.7,
                max_completion_tokens: (typeof CONFIG !== 'undefined' && CONFIG.MAX_COMPLETION_TOKENS) ? CONFIG.MAX_COMPLETION_TOKENS : 2048,
                top_p: (typeof CONFIG !== 'undefined' && CONFIG.TOP_P !== undefined) ? CONFIG.TOP_P : 1,
                frequency_penalty: (typeof CONFIG !== 'undefined' && CONFIG.FREQUENCY_PENALTY !== undefined) ? CONFIG.FREQUENCY_PENALTY : 0,
                presence_penalty: (typeof CONFIG !== 'undefined' && CONFIG.PRESENCE_PENALTY !== undefined) ? CONFIG.PRESENCE_PENALTY : 0
            })
        });
        
        // Hapus typing indicator
        removeTypingIndicator();
        
        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            } catch (e) {
                errorData = { error: { message: `HTTP ${response.status}: ${response.statusText}` } };
            }
            
            const errorMessage = errorData.error?.message || errorData.message || 'Terjadi kesalahan saat memproses permintaan';
            throw new Error(errorMessage);
        }
        
        const data = await response.json();
        
        // Validasi response
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('Format response tidak valid dari server');
        }
        
        const aiMessage = data.choices[0].message.content;
        
        // Tampilkan respons AI
        addMessage(aiMessage, false);
        
    } catch (error) {
        removeTypingIndicator();
        console.error('Error details:', error);
        
        // Tampilkan pesan error yang lebih informatif
        let errorMessage = error.message || 'Terjadi kesalahan. Silakan coba lagi.';
        
        // Handle network errors
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            errorMessage = 'Tidak dapat terhubung ke server. Pastikan server proxy berjalan di http://localhost:3000';
        }
        
        addMessage(`❌ Error: ${errorMessage}`, false);
    } finally {
        sendButton.disabled = false;
        userInput.disabled = false;
    }
}

// Handle form submission
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

// Theme Toggle
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');

// Load theme preference
function loadTheme() {
    const savedTheme = localStorage.getItem('vendorBot_theme') || 'dark';
    document.body.classList.toggle('light-mode', savedTheme === 'light');
    updateThemeIcon(savedTheme);
}

// Update theme icon
function updateThemeIcon(theme) {
    if (theme === 'light') {
        themeIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>';
    } else {
        themeIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>';
    }
}

// Toggle theme
themeToggle.addEventListener('click', () => {
    const isLightMode = document.body.classList.contains('light-mode');
    const newTheme = isLightMode ? 'dark' : 'light';
    
    document.body.classList.toggle('light-mode');
    localStorage.setItem('vendorBot_theme', newTheme);
    updateThemeIcon(newTheme);
});

// Initialize theme
loadTheme();

// Handle Enter key (Shift+Enter untuk new line)
userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        chatForm.dispatchEvent(new Event('submit'));
    }
});

// Knowledge Base akan dihandle sepenuhnya di backend
// Tidak ada UI untuk upload CSV di frontend

