window.Marketplace = (function() {
    const PLATFORM_COMMISSION = 0.21; // Платформанын комиссиясы: 21%

    document.addEventListener('DOMContentLoaded', () => {
        initFilters();
        loadMarketplaceProducts();
    });

    function initFilters() {
        const searchBtn = document.getElementById('mpSearchBtn');
        const searchInput = document.getElementById('mpSearchInput');
        const subjectFilter = document.getElementById('mpSubjectFilter');
        const gradeFilter = document.getElementById('mpGradeFilter');
        const categoryFilter = document.getElementById('mpCategoryFilter');

        if (searchBtn) searchBtn.addEventListener('click', loadMarketplaceProducts);
        if (searchInput) {
            searchInput.addEventListener('keyup', (e) => {
                if (e.key === 'Enter') loadMarketplaceProducts();
            });
        }
        if (subjectFilter) subjectFilter.addEventListener('change', loadMarketplaceProducts);
        if (gradeFilter) gradeFilter.addEventListener('change', loadMarketplaceProducts);
        if (categoryFilter) categoryFilter.addEventListener('change', loadMarketplaceProducts);
    }

    function loadMarketplaceProducts() {
        const grid = document.getElementById('mpProductGrid');
        if (!grid) return;

        grid.innerHTML = '<div class="loading-spinner">Материалдар жүктөлүүдө...</div>';

        const subjectEl = document.getElementById('mpSubjectFilter');
        const gradeEl = document.getElementById('mpGradeFilter');
        const categoryEl = document.getElementById('mpCategoryFilter');
        const searchEl = document.getElementById('mpSearchInput');

        const subject = subjectEl ? subjectEl.value : 'ALL';
        const grade = gradeEl ? gradeEl.value : 'ALL';
        const category = categoryEl ? categoryEl.value : 'ALL';
        const search = searchEl ? searchEl.value.toLowerCase().trim() : '';

        rtdb.ref('products').orderByChild('status').equalTo('APPROVED').once('value', (snapshot) => {
            grid.innerHTML = '';
            if (!snapshot.exists()) {
                grid.innerHTML = '<p class="no-data">Азырынча эч кандай материал табылган жок.</p>';
                return;
            }

            let products = [];
            snapshot.forEach((child) => {
                let prod = child.val();
                prod.id = child.key;
                products.push(prod);
            });

            // Клиенттик чыпкалоо (фильтрация)
            const filtered = products.filter(p => {
                const matchSubject = subject === 'ALL' || p.subject === subject;
                const matchGrade = grade === 'ALL' || (p.grade && p.grade.toString() === grade);
                const matchCategory = category === 'ALL' || p.category === category;
                const matchSearch = !search || 
                    (p.title && p.title.toLowerCase().includes(search)) || 
                    (p.description && p.description.toLowerCase().includes(search));

                return matchSubject && matchGrade && matchCategory && matchSearch;
            });

            if (filtered.length === 0) {
                grid.innerHTML = '<p class="no-data">Сиздин сурооңузга ылайык материалдар табылган жок.</p>';
                return;
            }

            filtered.forEach(p => {
                grid.appendChild(createProductCard(p));
            });
        }).catch((error) => {
            console.error("Материалдарды жүктөөдө ката чыкты:", error);
            grid.innerHTML = '<p class="error-msg">Маалыматтарды жүктөөдө ката орун алды.</p>';
        });
    }

    function createProductCard(prod) {
        const card = document.createElement('div');
        card.className = 'product-card';
        
        const imageUrl = prod.imageUrl || 'https://via.placeholder.com/300x180?text=Bilimal+Material';
        const authorName = prod.authorName || 'Мугалим';
        const priceText = prod.price > 0 ? `${prod.price} сом` : 'Бекер';

        card.innerHTML = `
            <div class="card-image-wrap">
                <img src="${imageUrl}" alt="${prod.title}">
                <span class="badge badge-category">${prod.category || 'Материал'}</span>
            </div>
            <div class="card-body">
                <div class="card-tags">
                    <span class="tag">${prod.subject || 'Жалпы'}</span>
                    <span class="tag">${prod.grade ? prod.grade + '-класс' : ''}</span>
                </div>
                <h3 class="card-title">${prod.title || 'Аталышы жок'}</h3>
                <p class="card-author">Автор: <strong>${authorName}</strong></p>
                <div class="card-footer">
                    <div class="card-price">${priceText}</div>
                    <div class="card-actions">
                        ${prod.previewUrl ? `<a href="${prod.previewUrl}" target="_blank" class="btn btn-sm btn-outline">Демо</a>` : ''}
                        <button class="btn btn-sm btn-primary" onclick="Marketplace.buyProduct('${prod.id}', ${prod.price || 0})">
                            ${prod.price > 0 ? 'Сатып алуу' : 'Жүктөө'}
                        </button>
                    </div>
                </div>
            </div>
        `;
        return card;
    }

    function buyProduct(productId, price) {
        if (!auth.currentUser) {
            alert('Материалды сатып алуу же жүктөө үчүн алгач системага кириңиз!');
            return;
        }

        const confirmMsg = price > 0 
            ? `Бул материалды ${price} сомго сатып алууну ырастайсызбы?` 
            : 'Бул материалды жүктөөгө уруксат бересизби?';

        if (confirm(confirmMsg)) {
            const authorEarning = Math.round(price * (1 - PLATFORM_COMMISSION));
            const commission = price - authorEarning;
            const buyerUid = auth.currentUser.uid;

            rtdb.ref(`products/${productId}`).once('value', (snap) => {
                if (!snap.exists()) {
                    alert('Материал табылган жок!');
                    return;
                }
                const prod = snap.val();

                const saleRef = rtdb.ref('sales').push();
                const saleData = {
                    productId: productId,
                    productTitle: prod.title || 'Материал',
                    sellerUid: prod.authorUid,
                    buyerUid: buyerUid,
                    totalPrice: price,
                    authorEarnings: authorEarning,
                    platformCommission: commission,
                    timestamp: firebase.database.ServerValue.TIMESTAMP,
                    status: 'COMPLETED'
                };

                saleRef.set(saleData).then(() => {
                    // Сатып алынгандардын тизмесине кошуу
                    return rtdb.ref(`users/${buyerUid}/purchases/${productId}`).set(true);
                }).then(() => {
                    // Автордун балансын жана статистикасын жаңылоо
                    if (price > 0 && prod.authorUid) {
                        return rtdb.ref(`users/${prod.authorUid}/finance`).transaction((fin) => {
                            if (!fin) {
                                fin = { availableBalance: 0, totalEarned: 0, salesCount: 0 };
                            }
                            fin.availableBalance = (fin.availableBalance || 0) + authorEarning;
                            fin.totalEarned = (fin.totalEarned || 0) + authorEarning;
                            fin.salesCount = (fin.salesCount || 0) + 1;
                            return fin;
                        });
                    }
                }).then(() => {
                    alert('Ийгиликтүү! Файлга шилтеме же жүктөө уруксаты жеке кабинетиңизге кошулду.');
                    if (prod.fileUrl) {
                        window.open(prod.fileUrl, '_blank');
                    }
                }).catch(err => {
                    console.error("Төлөм иштеп чыгууда ката:", err);
                    alert('Транзакцияда ката чыкты. Кайра аракет кылып көрүңүз.');
                });
            });
        }
    }

    return {
        loadMarketplaceProducts: loadMarketplaceProducts,
        buyProduct: buyProduct
    };
})();
