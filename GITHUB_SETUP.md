# Setup GitHub Repository

## ✅ Status
Repository Git sudah di-initialize dan semua file sudah di-commit.

## 📝 Langkah-langkah Push ke GitHub

### 1. Buat Repository di GitHub
1. Buka [github.com](https://github.com)
2. Klik **New** atau **+** → **New repository**
3. Isi:
   - **Repository name**: `VendorBot` (atau nama lain)
   - **Description**: "AI Chat Assistant dengan RAG untuk Pencarian Vendor Waskita"
   - **Visibility**: Public atau Private (sesuai kebutuhan)
   - **JANGAN** centang "Initialize with README" (karena sudah ada)
4. Klik **Create repository**

### 2. Connect Local Repository ke GitHub

Setelah repository dibuat, GitHub akan menampilkan instruksi. Jalankan perintah berikut:

```bash
# Tambahkan remote repository (ganti YOUR_USERNAME dengan username GitHub Anda)
git remote add origin https://github.com/YOUR_USERNAME/VendorBot.git

# Atau jika menggunakan SSH:
git remote add origin git@github.com:YOUR_USERNAME/VendorBot.git

# Push ke GitHub
git branch -M main
git push -u origin main
```

### 3. Update Git Config (Opsional)

Jika ingin menggunakan identitas GitHub Anda:

```bash
git config user.name "Your Name"
git config user.email "your.email@example.com"
```

## ⚠️ PENTING: Security Checklist

### File yang Sudah Di-Commit:
- ✅ `config.js` - **PERHATIAN**: File ini mungkin berisi API key!
- ✅ `embeddings_store.json` - File embeddings (bisa di-regenerate)

### Rekomendasi:

1. **Jika `config.js` berisi API key**:
   - Jangan push ke public repository
   - Atau hapus API key dari `config.js` sebelum push
   - Gunakan `config.example.js` sebagai template
   - Set API key via environment variables di hosting platform

2. **Update `.gitignore` jika perlu**:
   ```bash
   # Tambahkan ke .gitignore jika ingin ignore config.js
   echo "config.js" >> .gitignore
   
   # Remove dari staging
   git rm --cached config.js
   
   # Commit perubahan
   git commit -m "Remove config.js from repository"
   ```

3. **Set Environment Variables di GitHub**:
   - GitHub → Repository → Settings → Secrets and variables → Actions
   - Atau set di hosting platform (Vercel, Railway, dll)

## 🔄 Workflow Setelah Push

### Update Repository:
```bash
# Setelah membuat perubahan
git add .
git commit -m "Update: deskripsi perubahan"
git push
```

### Pull Changes:
```bash
git pull
```

## 📦 File yang Sudah Di-Commit

✅ **26 files** sudah di-commit:
- Konfigurasi deployment (Dockerfile, vercel.json, dll)
- Source code (server.js, script.js, dll)
- Dokumentasi (README.md, DEPLOY.md, dll)
- Assets (logo, CSV files)
- Dependencies (package.json, package-lock.json)

## 🚀 Next Steps

Setelah push ke GitHub, Anda bisa:

1. **Deploy ke Vercel/Railway/Render**:
   - Connect GitHub repository
   - Set environment variables
   - Auto-deploy

2. **Update Git Config**:
   ```bash
   git config --global user.name "Your Name"
   git config --global user.email "your.email@example.com"
   ```

3. **Add .env to .gitignore** (sudah ada):
   - File `.env` sudah di-ignore
   - Jangan commit file `.env` yang berisi API key

## 📝 Catatan

- Repository sudah di-initialize dengan branch `master`
- GitHub default menggunakan `main`, jadi kita rename dengan `git branch -M main`
- Semua file penting sudah di-commit
- File `.env` sudah di-ignore (aman)

---

**Selamat! Repository siap untuk di-push ke GitHub! 🎉**

