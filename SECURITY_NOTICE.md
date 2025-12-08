# ⚠️ PENTING: Security Notice

## API Key Ter-Expose

File `config.js` yang berisi API key **sudah ter-commit ke repository public** sebelum repository diubah menjadi private.

## 🚨 Tindakan yang HARUS Dilakukan:

### 1. **REGENERATE API KEY SEGERA!**

API key yang sudah ter-expose di repository public **TIDAK AMAN** dan harus di-regenerate:

1. Login ke [Maia Dashboard](https://docs.getmaia.ai) atau hubungi info@prodlane.io
2. **Revoke/Delete** API key yang ter-expose (cek di commit history untuk melihat key yang ter-expose)
3. **Generate API key baru**
4. Update di file `config.js` lokal (tidak akan di-commit lagi)

### 2. Ubah Repository Menjadi Private

**Cara mengubah repository menjadi Private di GitHub:**

1. Buka repository: https://github.com/RXCNF/VendorBot
2. Klik **Settings** (di menu atas repository)
3. Scroll ke bawah ke bagian **Danger Zone**
4. Klik **Change visibility** → **Change to private**
5. Konfirmasi dengan mengetik nama repository: `RXCNF/VendorBot`
6. Klik **I understand, change repository visibility**

### 3. File `config.js` Sudah Dihapus dari Repository

File `config.js` sudah:
- ✅ Ditambahkan ke `.gitignore`
- ✅ Dihapus dari git tracking
- ✅ Akan dihapus dari repository setelah push

**File tetap ada di local** untuk development, tapi tidak akan ter-commit lagi.

### 4. Gunakan Environment Variables

Untuk production/deployment, gunakan environment variables:

```env
MAIA_API_KEY=your_new_api_key_here
```

Jangan hardcode API key di file yang di-commit!

## ✅ Checklist Keamanan

- [ ] Regenerate API key yang ter-expose
- [ ] Ubah repository menjadi private
- [ ] Update API key baru di `config.js` lokal
- [ ] Set environment variables di hosting platform
- [ ] Verifikasi `.gitignore` sudah include `config.js`
- [ ] Jangan commit file dengan API key lagi

## 📝 Best Practices

1. **Jangan commit file dengan API key**
   - Gunakan `config.example.js` sebagai template
   - File `config.js` harus di-ignore

2. **Gunakan Environment Variables**
   - Set di hosting platform (Vercel, Railway, dll)
   - Jangan hardcode di source code

3. **Repository Private untuk Sensitive Data**
   - Private repository lebih aman
   - Public repository = semua orang bisa lihat

4. **Rotate API Keys Secara Berkala**
   - Regenerate API key jika ter-expose
   - Monitor penggunaan API key

## 🔒 Setelah Repository Private

Setelah repository diubah menjadi private:
- Hanya Anda dan collaborator yang bisa akses
- API key tidak akan terlihat oleh publik
- Tetap aman untuk development

---

**PENTING**: Regenerate API key yang ter-expose **SEGERA** sebelum ada yang menyalahgunakannya!

