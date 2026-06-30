// Менюларды которуу функциясы
function showTab(tabName) {
    // Бардык табдарды жашыруу
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.add('hidden');
        tab.classList.remove('active');
    });
    
    // Тандалган табды көрсөтүү
    const activeTab = document.getElementById(`tab-${tabName}`);
    activeTab.classList.remove('hidden');
    activeTab.classList.add('active');
}

// Оюн менен Клан борборун которуу
document.getElementById('btn-battle').addEventListener('click', () => {
    document.getElementById('clan-section').classList.add('hidden');
    document.getElementById('battle-section').classList.remove('hidden');
    startGame(); // Оюнду баштоо
});

document.getElementById('btn-clan').addEventListener('click', () => {
    document.getElementById('battle-section').classList.add('hidden');
    document.getElementById('clan-section').classList.remove('hidden');
});

// Магазин логикасы
let playerCrystals = 1000; // Баштапкы кристалл

function buyItem(itemType, price) {
    if (playerCrystals >= price) {
        playerCrystals -= price;
        alert(`${itemType} ийгиликтүү сатылып алынды! Калган кристалл: ${playerCrystals}`);
        // Бул жерде серверге маалымат жөнөтүлөт
        // socket.emit('buyItem', { type: itemType });
    } else {
        alert("Кристалл жетишсиз!");
    }
}
