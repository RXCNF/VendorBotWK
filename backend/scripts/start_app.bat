@echo off
echo Memulai VendorBot Server...
echo Menunggu server siap...

:: Buka browser otomatis di localhost:3000 (jeda 2 detik agar server sempat loading)
timeout /t 2 /nobreak >nul
start "" "http://localhost:3000"

:: Jalankan server Node.js
npm start

pause
