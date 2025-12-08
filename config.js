// Konfigurasi API Maia
// Maia adalah platform pembayaran untuk akses OpenAI API
// Untuk mendapatkan API Key, hubungi info@prodlane.io atau perwakilan Maia
// Dokumentasi: https://docs.getmaia.ai

const CONFIG = {
    // Masukkan API Key Maia Anda di sini
    // Format: Api-Key YOUR_API_KEY_HERE
    MAIA_API_KEY: 'sk-ZfjQ4VwUsYsGbXfZ0ceBog',
    
    // URL Proxy Server (gunakan server proxy untuk menghindari CORS)
    // Jika server proxy berjalan di localhost:3000, biarkan seperti ini
    PROXY_URL: 'http://localhost:3000/api/chat',
    
    // Konfigurasi model (opsional)
    // Model Maia: venice-uncensored, openai/gpt-4o-mini, atau model lainnya
    MODEL: 'openai/gpt-4o-mini',
    
    // Konfigurasi lainnya (opsional)
    TEMPERATURE: 0.7,
    MAX_COMPLETION_TOKENS: 2048,  // Maia menggunakan max_completion_tokens
    TOP_P: 1,
    FREQUENCY_PENALTY: 0,
    PRESENCE_PENALTY: 0
};

