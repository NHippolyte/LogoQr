// Fichier : public/script.js

document.addEventListener('DOMContentLoaded', () => {
    const logoInput = document.getElementById('logo');
    const qrInput = document.getElementById('qr');
    const errorMessage = document.getElementById('error-message');
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];

    function validateFile(fileInput) {
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            if (!allowedTypes.includes(file.type)) {
                errorMessage.textContent = 'Erreur : Type de fichier non supporté. Seules les images sont autorisées.';
                errorMessage.style.display = 'block';
                fileInput.classList.add('input-error');
                return false;
            }
        }
        return true;
    }

    function hideError() {
        errorMessage.style.display = 'none';
        logoInput.classList.remove('input-error');
        qrInput.classList.remove('input-error');
    }

    logoInput.addEventListener('change', () => {
        hideError();
        validateFile(logoInput);
    });

    qrInput.addEventListener('change', () => {
        hideError();
        validateFile(qrInput);
    });

    // Ajoute une validation finale avant la soumission
    document.querySelector('form').addEventListener('submit', (e) => {
        if (!validateFile(logoInput) || !validateFile(qrInput)) {
            e.preventDefault(); // Empêche l'envoi du formulaire
        }
    });
});