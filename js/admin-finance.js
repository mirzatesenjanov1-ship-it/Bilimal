window.AdminFinance = (function() {
  const API_BASE = 'http://localhost:5000/api';

  function loadAdminDashboard() {
    listenToFinanceStats();
    listenToWithdrawals();
  }

  function listenToFinanceStats() {
    rtdb.ref('marketplace/orders').on('value', (snap) => {
      let totalSales = 0;
      let totalCommission = 0;
      let totalEarnings = 0;

      if (snap.exists()) {
        snap.forEach(child => {
          const order = child.val();
          if (order.status === 'PAID') {
            totalSales += order.amount || 0;
            totalCommission += order.commissionAmount || 0;
            totalEarnings += order.authorAmount || 0;
          }
        });
      }

      document.getElementById('adminTotalSales').textContent = `${totalSales.toFixed(2)} сом`;
      document.getElementById('adminTotalCommission').textContent = `${totalCommission.toFixed(2)} сом`;
      document.getElementById('adminTotalAuthorEarnings').textContent = `${totalEarnings.toFixed(2)} сом`;
    });
  }

  function listenToWithdrawals() {
    rtdb.ref('marketplace/withdrawals').on('value', (snap) => {
      const tbody = document.getElementById('adminWithdrawalsTable');
      tbody.innerHTML = '';
      if (!snap.exists()) return;

      snap.forEach(child => {
        const w = child.val();
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${w.authorName}</td>
          <td><strong>${w.amount} сом</strong></td>
          <td>${w.payoutDetails ? `${w.payoutDetails.bankName} (${w.payoutDetails.accountIdentifier})` : 'Көрсөтүлгөн эмес'}</td>
          <td>${new Date(w.requestedAt).toLocaleDateString()}</td>
          <td><span class="badge">${w.status}</span></td>
          <td>
            ${w.status === 'PENDING' ? `<button class="btn btn-sm btn-success approve-btn" data-id="${w.withdrawalId}">Төлөдүм</button>` : 'Аткарылды'}
          </td>
        `;

        if (w.status === 'PENDING') {
          tr.querySelector('.approve-btn').addEventListener('click', () => handleApprovePayout(w.withdrawalId));
        }

        tbody.appendChild(tr);
      });
    });
  }

  async function handleApprovePayout(withdrawalId) {
    if (!currentUser) return;
    if (!confirm('Акча чынында эле которулдубу? Статусту ырастайсызбы?')) return;

    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`${API_BASE}/admin/approve-payout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ withdrawalId })
      });
      const data = await res.json();
      alert(data.message);
    } catch (e) {
      alert('Ырастоодо ката чыкты');
    }
  }

  return { loadAdminDashboard };
})();
