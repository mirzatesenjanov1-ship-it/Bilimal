/**
 * Файлдын тиби жана өлчөмү туура келерин текшерүү
 */
export function validateImageFile(file) {
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        return { valid: false, error: "Жүктөлгөн файлдын форматы туура эмес! (Мүмкүн болгон форматтар: JPG, PNG, WebP)" };
    }
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
        return { valid: false, error: "Файлдын өлчөмү 2MBдан ашпоого тийиш!" };
    }
    return { valid: true };
}

/**
 * Сүрөттү localStorage'га батыруу үчүн автоматтык түрдө оптималдаштыруу жана кысуу
 */
export function compressImage(file, maxWidth = 300, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Оптималдуу WebP же JPEG форматында кысуу
                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(dataUrl);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}
