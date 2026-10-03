window.TeacherCabinet = (function() {
  const API_BASE = 'http://localhost:5000/api';

  document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initAddProductModal();
    initPayoutForm();
    initPricePreviewCalculator();
  });

  function loadCabinetData(userId) {
    listenToBalance(userId);
    listenToSales(userId);
    listenToPurchases(userId);
  }

  function listenToBalance(userId) {
    rtdb.ref(`marketplace/authorBalances/${userId}`).on('value', (snap) => {
      const availableEl = document.getElementById('dashAvailableBalance');
      const pendingEl = document.getElementById('dashPendingBalance');
      const totalEarnedEl = document.getElementById('dashTotalEarned');
      const salesCountEl = document.getElementById('dashSalesCount');
      const withdrawBtn = document.getElementById('requestWithdrawalBtn');

      if (snap.exists()) {
        const val = snap.val();
        const avail = val.availableBalance || 0;
        availableEl.textContent = `${avail} сом`;
        pendingEl.textContent = `${val.pendingBalance || 0} сом`;
        totalEarnedEl.textContent = `${val.totalEarned || 0} сом`;
        salesCountEl.textContent = `${val.salesCount || 0} шт`;

        if (avail >= 100) {
          withdrawBtn.disabled = false;
        } else {
          withdrawBtn.disabled = true;
        }
      } else {
        availableEl.textContent = '0 сом';
        pendingEl.textContent = '0 сом';
        totalEarnedEl.textContent = '0 сом';
        salesCountEl.textContent = '0 шт';
        withdrawBtn.disabled = true;
      }
    });

    document.getElementById('requestWithdrawalBtn').addEventListener('click', handleWithdrawalRequest);
  }

  async function handleWithdrawalRequest() {
    if (!currentUser) return;
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`${API_BASE}/payout/request-withdrawal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      alert(data.message);
    } catch (e) {
      alert('Арыз жөнөтүүдө ката чыкты');
    }
  }

  function listenToSales(userId) {
    rtdb.ref('marketplace/orders').orderByChild('authorId').equalTo(userId).on('value', (snap) => {
      const tbody = document.getElementById('mySalesTableBody');
      tbody.innerHTML = '';
      if (!snap.exists()) return;

      snap.forEach((child) => {
        const order = child.val();
        if (order.status !== 'PAID') return;

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${order.productTitle}</td>
          <td>${new Date(order.paidAt).toLocaleDateString()}</td>
          <td>${order.amount} сом</td>
          <td><strong>${order.authorAmount} сом</strong></td>
          <td><span class="badge badge-success">Сатылды</span></td>
        `;
        tbody.appendChild(tr);
      });
    });
  }

  function listenToPurchases(userId) {
    rtdb.ref(`purchases/${userId}`).on('value', async (snap) => {
      const container = document.getElementById('myPurchasesList');
      container.innerHTML = '';
      if (!snap.exists()) {
        container.innerHTML = '<p>Сиз азырынча эч нерсе сатып ала элексиз.</p>';
        return;
      }

      snap.forEach(async (child) => {
        const prodId = child.key;
        const pSnap = await rtdb.ref(`marketplace/products/${prodId}`).once('value');
        if (pSnap.exists()) {
          const prod = pSnap.val();
          const card = document.createElement('div');
          card.className = 'product-card';
          card.innerHTML = `
            <div class="product-card-body">
              <h3 class="product-title">${prod.title}</h3>
              <a href="${prod.fileUrl}" target="_blank" class="btn btn-block btn-success">Толук файлды ачуу</a>
            </div>
          `;
          container.appendChild(card);
        }
      });
    });
  }

  function initPricePreviewCalculator() {
    const priceInput = document.getElementById('prodPrice');
    const previewDiv = document.getElementById('priceCalcPreview');

    priceInput.addEventListener('input', () => {
      const price = parseFloat(priceInput.value) || 0;
      const commission = (price * 0.21).toFixed(2);
      const earning = (price - commission).toFixed(2);
      previewDiv.innerHTML = `Платформа комиссиясы: 21% (${commission} сом) | Сиздин кирешеңиз: <strong>${earning} сом</strong>`;
    });
  }

  function initAddProductModal() {
    const modal = document.getElementById('addProductModal');
    document.getElementById('openAddProductModalBtn').addEventListener('click', () => modal.classList.remove('hidden'));
    document.getElementById('closeAddProductModalBtn').addEventListener('click', () => modal.classList.add('hidden'));

    document.getElementById('addProductForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentUser) return;

      const pRef = rtdb.ref('marketplace/products').push();
      const productData = {
        productId: pRef.key,
        authorId: currentUser.uid,
        authorName: currentUser.displayName || currentUser.email,
        title: document.getElementById('prodTitle').value,
        subject: document.getElementById('prodSubject').value,
        grade: parseInt(document.getElementById('prodGrade').value),
        category: document.getElementById('prodCategory').value,
        price: parseFloat(document.getElementById('prodPrice').value),
        imageUrl: document.getElementById('prodImageUrl').value,
        previewUrl: document.getElementById('prodPreviewUrl').value,
        fileUrl: document.getElementById('prodFileUrl').value,
        description: document.getElementById('prodDescription').value,
        status: 'approved', // Кийинки кадамда 'pending' кылып, модерациядан өткөрсө болот
        createdAt: firebase.database.ServerValue.TIMESTAMP
      };

      await pRef.set(productData);
      alert('Материал ийгиликтүү кошулду жана сатууга даяр!');
      modal.classList.add('hidden');
      document.getElementById('addProductForm').reset();
    });
  }

  function initPayoutForm() {
    document.getElementById('payoutDetailsForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentUser) return;

      const token = await currentUser.getIdToken();
      const body = {
        payoutMethod: document.getElementById('payoutMethod').value,
        bankName: document.getElementById('payoutBankName').value,
        accountIdentifier: document.getElementById('payoutAccountIdentifier').value,
        recipientName: document.getElementById('payoutRecipientName').value
      };

      const res = await fetch(`${API_BASE}/payout/save-details`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      alert(data.message);
    });
  }

  function initTabs() {
    const tabs = document.querySelectorAll('.cabinet-tabs .tab-btn');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const tabName = tab.getAttribute('data-tab');
        document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
        document.getElementById(`tab-${tabName}`).classList.remove('hidden');
      });
    });
  }

  return { loadCabinetData };
})();
