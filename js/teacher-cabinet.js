window.TeacherCabinet = (function() {
    const PLATFORM_COMMISSION = 0.21;

    document.addEventListener('DOMContentLoaded', () => {
        initModalEvents();
        initTabSwitching();
        initForms();
        
        // Авторизация абалын текшерүү жана маалыматтарды жүктөө
        if (typeof auth !== 'undefined') {
            auth.onAuthStateChanged((user) => {
                if (user) {
                    loadCabinetData(user.uid);
                }
            });
        }
    });

    function initModalEvents() {
        const modal = document.getElementById('addProductModal');
        const openBtn = document.getElementById('openAddProductModalBtn');
        const closeBtn = document.getElementById('closeAddProductModalBtn');

        if (openBtn && modal) openBtn.addEventListener('click', () => modal.classList.remove('hidden'));
        if (closeBtn && modal) closeBtn.addEventListener('click', () => modal.classList.add('hidden'));

        // Бааны өзгөрткөндө автордун таза кирешесин алдын ала эсептөө
        const priceInput = document.getElementById('prodPrice');
        const calcPreview = document.getElementById('priceCalcPreview');
        if (priceInput && calcPreview) {
            priceInput.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value) || 0;
                const authorEarn = Math.round(val * (1 - PLATFORM_COMMISSION));
                const comm = val - authorEarn;
                calcPreview.innerHTML = 
                    `<span>Платформа комиссиясы (21%): <strong>${comm} сом</strong></span> | <span>Сиздин кирешеңиз: <strong>${authorEarn} сом</strong></span>`;
            });
        }
    }

    function initTabSwitching() {
        const tabs = document.querySelectorAll('.cabinet-tabs .tab-btn');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                const targetTab = tab.getAttribute('data-tab');
                document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
                const selectedContent = document.getElementById(`tab-${targetTab}`);
                if (selectedContent) selectedContent.classList.remove('hidden');
            });
        });
    }

    function initForms() {
        const addProdForm = document.getElementById('addProductForm');
        if (addProdForm) {
            addProdForm.addEventListener('submit', (e) => {
                e.preventDefault();
                if (!auth.currentUser) {
                    alert('Сессия аяктады. Кайрадан системага кириңиз.');
                    return;
                }

                const newProd = {
                    title: document.getElementById('prodTitle').value,
                    subject: document.getElementById('prodSubject').value,
                    grade: parseInt(document.getElementById('prodGrade').value) || 0,
                    category: document.getElementById('prodCategory').value,
                    price: parseFloat(document.getElementById('prodPrice').value) || 0,
                    imageUrl: document.getElementById('prodImageUrl').value || '',
                    previewUrl: document.getElementById('prodPreviewUrl').value || '',
                    fileUrl: document.getElementById('prodFileUrl').value || '',
                    description: document.getElementById('prodDescription').value || '',
                    authorUid: auth.currentUser.uid,
                    authorName: auth.currentUser.displayName || auth.currentUser.email,
                    status: 'APPROVED', // Системага жараша 'PENDING' же 'APPROVED'
                    createdAt: firebase.database.ServerValue.TIMESTAMP
                };

                rtdb.ref('products').push(newProd).then(() => {
                    alert('Материал ийгиликтүү кошулду!');
                    const modal = document.getElementById('addProductModal');
                    if (modal) modal.classList.add('hidden');
                    addProdForm.reset();
                    loadCabinetData(auth.currentUser.uid);
                }).catch(err => {
                    console.error("Материал кошууда ката:", err);
                    alert('Материалды сактоодо ката чыкты.');
                });
            });
        }

        const payoutForm = document.getElementById('payoutDetailsForm');
        if (payoutForm) {
            payoutForm.addEventListener('submit', (e) => {
                e.preventDefault();
                if (!auth.currentUser) return;

                const payoutData = {
                    method: document.getElementById('payoutMethod').value,
                    bankName: document.getElementById('payoutBankName').value,
                    accountIdentifier: document.getElementById('payoutAccountIdentifier').value,
                    recipientName: document.getElementById('payoutRecipientName').value,
                    updatedAt: firebase.database.ServerValue.TIMESTAMP
                };

                rtdb.ref(`users/${auth.currentUser.uid}/payoutDetails`).set(payoutData).then(() => {
                    alert('Төлөм реквизиттери ийгиликтүү сакталды!');
                }).catch(err => {
                    console.error("Реквизит сактоодо ката:", err);
                    alert('Реквизиттерди сактоо мүмкүн болгон жок.');
                });
            });
        }

        const reqWithdrawalBtn = document.getElementById('requestWithdrawalBtn');
        if (reqWithdrawalBtn) {
            reqWithdrawalBtn.addEventListener('click', () => {
                if (!auth.currentUser) return;
                const uid = auth.currentUser.uid;

                rtdb.ref(`users/${uid}`).once('value', (snap) => {
                    const userData = snap.val() || {};
                    const balance = userData.finance?.availableBalance || 0;
                    const payout = userData.payoutDetails;

                    if (!payout || !payout.accountIdentifier) {
                        alert('Алгач "Төлөм реквизиттери" бөлүмүнөн карта же капчык маалыматыңызды толтуруңуз!');
                        return;
                    }

                    if (balance < 100) {
                        alert('Минималдуу чыгаруу суммасы — 100 сом.');
                        return;
                    }

                    if (confirm(`Балансыңыздагы ${balance} сомду чыгарууга арыз бересизби?`)) {
                        const reqRef = rtdb.ref('withdrawals').push();
                        reqRef.set({
                            uid: uid,
                            authorName: userData.displayName || auth.currentUser.email,
                            amount: balance,
                            payoutDetails: payout,
                            status: 'PENDING',
                            timestamp: firebase.database.ServerValue.TIMESTAMP
                        }).then(() => {
                            return rtdb.ref(`users/${uid}/finance/availableBalance`).set(0);
                        }).then(() => {
                            alert('Акча чыгаруу арызы ийгиликтүү жөнөтүлдү!');
                            loadCabinetData(uid);
                        }).catch(err => {
                            console.error("Арыз жөнөтүүдө ката:", err);
                            alert('Арызды жөнөтүүдө ката чыкты.');
                        });
                    }
                });
            });
        }
    }

    function loadCabinetData(uid) {
        if (!uid) return;

        // 1. Финансыны жүктөө
        rtdb.ref(`users/${uid}/finance`).on('value', (snap) => {
            const fin = snap.val() || {};
            const avail = fin.availableBalance || 0;
            
            const availEl = document.getElementById('dashAvailableBalance');
            const totalEarnEl = document.getElementById('dashTotalEarned');
            const salesCountEl = document.getElementById('dashSalesCount');
            const reqBtn = document.getElementById('requestWithdrawalBtn');

            if (availEl) availEl.textContent = `${avail} сом`;
            if (totalEarnEl) totalEarnEl.textContent = `${fin.totalEarned || 0} сом`;
            if (salesCountEl) salesCountEl.textContent = `${fin.salesCount || 0} шт`;
            if (reqBtn) reqBtn.disabled = avail < 100;
        });

        // 2. Реквизиттерди жүктөө
        rtdb.ref(`users/${uid}/payoutDetails`).once('value', (snap) => {
            if (snap.exists()) {
                const data = snap.val();
                if (document.getElementById('payoutMethod')) document.getElementById('payoutMethod').value = data.method || 'BANK_CARD';
                if (document.getElementById('payoutBankName')) document.getElementById('payoutBankName').value = data.bankName || '';
                if (document.getElementById('payoutAccountIdentifier')) document.getElementById('payoutAccountIdentifier').value = data.accountIdentifier || '';
                if (document.getElementById('payoutRecipientName')) document.getElementById('payoutRecipientName').value = data.recipientName || '';
            }
        });

        // 3. Мугалимдин өзүнүн материалдары
        rtdb.ref('products').orderByChild('authorUid').equalTo(uid).once('value', (snap) => {
            const grid = document.getElementById('myProductsList');
            if (!grid) return;
            grid.innerHTML = '';
            
            if (!snap.exists()) {
                grid.innerHTML = '<p class="no-data">Сиз азырынча материал кошо элексиз.</p>';
                return;
            }

            snap.forEach(child => {
                const prod = child.val();
                prod.id = child.key;
                grid.appendChild(createMyProductCard(prod));
            });
        });

        // 4. Сатуулар тарыхы
        rtdb.ref('sales').orderByChild('sellerUid').equalTo(uid).once('value', (snap) => {
            const tbody = document.getElementById('mySalesTableBody');
            if (!tbody) return;
            tbody.innerHTML = '';

            if (!snap.exists()) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Сатуулар табылган жок.</td></tr>';
                return;
            }

            snap.forEach(child => {
                const s = child.val();
                const tr = document.createElement('tr');
                const date = s.timestamp ? new Date(s.timestamp).toLocaleDateString('ky-KG') : '—';
                tr.innerHTML = `
                    <td>${s.productTitle || 'Материал'}</td>
                    <td>${date}</td>
                    <td>${s.totalPrice} сом</td>
                    <td><strong>${s.authorEarnings} сом</strong></td>
                    <td><span class="badge badge-success">${s.status || 'COMPLETED'}</span></td>
                `;
                tbody.appendChild(tr);
            });
        });
    }

    function createMyProductCard(prod) {
        const div = document.createElement('div');
        div.className = 'product-card';
        const img = prod.imageUrl || 'https://via.placeholder.com/300x180?text=Bilimal';
        div.innerHTML = `
            <div class="card-image-wrap">
                <img src="${img}" alt="${prod.title}">
                <span class="badge">${prod.status || 'APPROVED'}</span>
            </div>
            <div class="card-body">
                <h3>${prod.title || 'Аталышы жок'}</h3>
                <p>Баасы: <strong>${prod.price} сом</strong></p>
                <p>Категория: ${prod.category || '—'}</p>
            </div>
        `;
        return div;
    }

    return {
        loadCabinetData: loadCabinetData
    };
})();
