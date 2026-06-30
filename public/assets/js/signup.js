/**
 * Signup functionality for VendorBot
 */

document.addEventListener('DOMContentLoaded', function () {
    const signupForm = document.getElementById('signupForm');
    const passwordInput = document.getElementById('password');
    const strengthBar = document.getElementById('strengthBar');
    const strengthText = document.getElementById('strengthText');
    const togglePassword = document.getElementById('togglePassword');
    const eyeIcon = document.getElementById('eyeIcon');

    // Toggle password visibility
    togglePassword.addEventListener('click', function () {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);

        // Change icon
        if (type === 'text') {
            eyeIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"></path>`;
        } else {
            eyeIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>`;
        }
    });

    // Toggle Access Code visibility based on Role
    const roleSelect = document.getElementById('role');
    const accessCodeContainer = document.getElementById('accessCodeContainer');

    roleSelect.addEventListener('change', function () {
        if (this.value === 'admin' || this.value === 'manager') {
            accessCodeContainer.classList.remove('hidden');
        } else {
            accessCodeContainer.classList.add('hidden');
        }
    });

    // Password strength indicator
    passwordInput.addEventListener('input', function () {
        const password = this.value;
        let strength = 0;

        if (password.length >= 8) strength += 25;
        if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength += 25;
        if (password.match(/\d/)) strength += 25;
        if (password.match(/[^a-zA-Z\d]/)) strength += 25;

        strengthBar.style.width = strength + '%';

        if (strength <= 25) {
            strengthBar.className = 'h-full transition-all duration-300 bg-red-500';
            strengthText.textContent = 'Lemah';
        } else if (strength <= 50) {
            strengthBar.className = 'h-full transition-all duration-300 bg-yellow-500';
            strengthText.textContent = 'Cukup';
        } else if (strength <= 75) {
            strengthBar.className = 'h-full transition-all duration-300 bg-blue-500';
            strengthText.textContent = 'Kuat';
        } else {
            strengthBar.className = 'h-full transition-all duration-300 bg-green-500';
            strengthText.textContent = 'Sangat Kuat';
        }
    });

    // Handle signup form
    signupForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const fullname = document.getElementById('fullname').value.trim();
        const email = document.getElementById('email').value.trim().toLowerCase();
        const role = document.getElementById('role').value;
        const accessCode = document.getElementById('accessCode').value.trim();
        const password = passwordInput.value.trim();

        // Validasi: Nama tidak boleh berbentuk email
        if (fullname.includes('@')) {
            showNotification('Nama lengkap tidak boleh berbentuk email!', 'error');
            return;
        }

        // Simple validations
        if (password.length < 8) {
            showNotification('Password minimal 8 karakter!', 'error');
            return;
        }

        try {
            const signupButton = signupForm.querySelector('button[type="submit"]');
            signupButton.disabled = true;
            signupButton.textContent = 'Mendaftarkan...';

            const response = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ fullname, email, password, role, accessCode })
            });

            const data = await response.json();

            if (response.ok) {
                showNotification('Pendaftaran berhasil! Mengalihkan ke halaman login...', 'success');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);
            } else {
                showNotification(data.error || 'Pendaftaran gagal', 'error');
                signupButton.disabled = false;
                signupButton.textContent = 'Daftar Sekarang';
            }
        } catch (error) {
            console.error('Signup error:', error);
            showNotification('Terjadi kesalahan koneksi ke server', 'error');
            signupForm.querySelector('button[type="submit"]').disabled = false;
            signupForm.querySelector('button[type="submit"]').textContent = 'Daftar Sekarang';
        }
    });

    function showNotification(message, type) {
        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.notification-toast');
        existingNotifications.forEach(notif => notif.remove());

        const notification = document.createElement('div');
        notification.className = `notification-toast fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg transition-all duration-300 transform translate-x-full ${type === 'success' ? 'bg-green-600' : 'bg-red-600'
            } text-white font-medium`;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        setTimeout(() => {
            notification.style.transform = 'translateX(400px)';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }
});
