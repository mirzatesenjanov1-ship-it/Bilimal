window.AdminFinance = (function() {
    document.addEventListener('DOMContentLoaded', () => {
        // Эгер админ бетинде болсо панелди жүктөө
        if (document.getElementById('adminWithdrawalsTable')) {
            loadAdminDashboard();
        }
    });

    function loadAdminDashboard() {
        // Жалпы каржылык статистиканы эсептөө
        rtdb.ref('sales').on('value', (snap) => {
            let totalSales = 0;
            let totalComm = 0;
            let totalEarnings = 0;

            if (snap.exists()) {
                snap.forEach(child => {
                    const s = child.val();
                    totalSales += Number(s.totalPrice || 0);
                    totalComm += Number(s.platformCommission || 0);
                    totalEarnings += Number(s.authorEarnings || 0);
                });
            }

            const totalSalesEl = document.getElementById('adminTotalSales');
            const totalCommEl = document.getElementById('adminTotalCommission');
            const totalEarnEl = document.getElementById('adminTotalAuthorEarnings');

            if (totalSalesEl) totalSalesEl.textContent = `${totalSales} сом`;
            if (totalCommEl) totalCommEl.textContent = `${totalComm} сом`;
            if (totalEarnEl) totalEarnEl.textContent = `${totalEarnings} сом`;
        });

        // Акча чыгаруу боюнча арыздарды алуу
        rtdb.ref('withdrawals').on('value', (snap) => {
            const tbody = document.getElementById('adminWithdrawalsTable');
            if (!tbody) return;
            tbody.innerHTML = '';

            if (!snap.exists()) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Арыздар жок.</td></tr>';
                return;
            }

            snap.forEach(child => {
                const w = child.val();
                const key = child.key;
                const tr = document.createElement('tr');
                const date = w.timestamp ? new Date(w.timestamp).toLocaleDateString('ky-KG') : '—';
                const req = w.payoutDetails || {};

                const statusBadge = w.status === 'PAID' 
                    ? '<span class="badge badge-success">Төлөндү</span>' 
                    : '<span class="badge badge-warning">Күтүүдө</span>';

                tr.innerHTML = `
                    <td>${w.authorName || 'Мугалим'}</td>
                    <td><strong>${w.amount} сом</strong></td>
                    <td>${req.bankName || ''} - ${req.accountIdentifier || ''} (${req.recipientName || ''})</td>
                    <td>${date}</td>
                    <td>${statusBadge}</td>
                    <td>
                        ${w.status === 'PENDING' 
                            ? `<button class="btn btn-sm btn-success" onclick="AdminFinance.approveWithdrawal('${key}')">Төлөндү деп белгилөө</button>` 
                            : '—'}
                    </td>
                `;
                tbody.appendChild(tr);
            });
        });
    }

    function approveWithdrawal(key) {
        if (confirm('Бул арыз боюнча акча которулганын тастыктайсызбы?')) {
            rtdb.ref(`withdrawals/${key}`).update({
                status: 'PAID',
                paidAt: firebase.database.ServerValue.TIMESTAMP
            }).then(() => {
                alert('Статус "Төлөндү" деп өзгөртүлдү.');
            }).catch(err => {
                console.error("Статус өзгөртүүдө ката:", err);
                alert('Аракетти аткаруу мүмкүн болгон жок.');
            });
        }
    }

    return {
        loadAdminDashboard: loadAdminDashboard,
        approveWithdrawal: approveWithdrawal
    };
})();
