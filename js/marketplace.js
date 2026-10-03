window.Marketplace = (function() {
  const API_BASE = 'http://localhost:5000/api';

  document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
    initSearchAndFilters();
  });

  function loadProducts() {
    const grid = document.getElementById('mpProductGrid');
    rtdb.ref('marketplace/products').orderByChild('status').equalTo('approved').on('value', (snapshot) => {
      grid.innerHTML = '';
      if (!snapshot.exists()) {
        grid.innerHTML = '<p>Сатууда азырынча материалдар жок.</p>';
        return;
      }

      snapshot.forEach((child) => {
        const prod = child.val();
        grid.appendChild(createProductCard(prod));
      });
    });
  }

  function createProductCard(prod) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <img src="${prod.imageUrl || 'https://via.placeholder.com/300x160'}" class="product-card-img" alt="${prod.title}">
      <div class="product-card-body">
        <span class="product-tag">${prod.subject} • ${prod.grade}-класс</span>
        <h3 class="product-title">${prod.title}</h3>
        <p class="product-author">Автор: ${prod.authorName || 'Мугалим'}</p>
        <div class="product-card-footer">
          <span class="product-price">${prod.price} сом</span>
          <div>
            <a href="${prod.previewUrl}" target="_blank" class="btn btn-sm btn-outline">Көрүү</a>
            <button class="btn btn-sm btn-primary buy-btn" data-id="${prod.productId}">Сатып алуу</button>
          </div>
        </div>
      </div>
    `;

    card.querySelector('.buy-btn').addEventListener('click', () => handleBuyProduct(prod));
    return card;
  }

  async function handleBuyProduct(prod) {
    if (!currentUser) {
      alert('Материалды сатып алуу үчүн алгач системага кириңиз.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/payment/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyerId: currentUser.uid, productId: prod.productId })
      });
      const data = await res.json();

      if (data.success) {
        if (confirm(`Заказ түзүлдү! Баасы: ${prod.price} сом. Төлөм баракчасына өтөсүзбү?`)) {
          window.location.href = data.paymentUrl;
        }
      } else {
        alert(data.message || 'Ката чыкты');
      }
    } catch (e) {
      alert('Сервер менен байланышууда ката чыкты.');
    }
  }

  function initSearchAndFilters() {
    const searchBtn = document.getElementById('mpSearchBtn');
    searchBtn.addEventListener('click', () => {
      const searchText = document.getElementById('mpSearchInput').value.toLowerCase();
      const subject = document.getElementById('mpSubjectFilter').value;
      const grade = document.getElementById('mpGradeFilter').value;

      rtdb.ref('marketplace/products').once('value', (snap) => {
        const grid = document.getElementById('mpProductGrid');
        grid.innerHTML = '';
        snap.forEach((child) => {
          const prod = child.val();
          if (prod.status !== 'approved') return;

          const matchSearch = prod.title.toLowerCase().includes(searchText);
          const matchSubject = subject === 'ALL' || prod.subject === subject;
          const matchGrade = grade === 'ALL' || String(prod.grade) === grade;

          if (matchSearch && matchSubject && matchGrade) {
            grid.appendChild(createProductCard(prod));
          }
        });
      });
    });
  }

  return { loadProducts };
})();
