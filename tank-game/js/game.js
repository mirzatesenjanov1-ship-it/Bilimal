const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let player = new Tank(380, 500, 2, 3, 'player');
let enemies = [new FastEnemy(100, 50), new HeavyEnemy(600, 50)];
let powerups = [];

// Картанын дизайны (0: бош, 1: кирпич, 2: темир, 3: суу, 4: токой)
const mapGrid = [
    [0,0,1,1,0,0,2,2,0,0],
    [0,3,3,0,0,4,4,0,0,1],
    // ... (толук карта массиви жазылат)
];

function drawMap() {
    // Массивдеги сандарга жараша картаны тартуу
    const tileSize = 40;
    for(let row = 0; row < mapGrid.length; row++) {
        for(let col = 0; col < mapGrid[row].length; col++) {
            let tile = mapGrid[row][col];
            let x = col * tileSize;
            let y = row * tileSize;

            if(tile === 1) { ctx.fillStyle = '#8B4513'; ctx.fillRect(x,y,tileSize,tileSize); } // Кирпич
            if(tile === 2) { ctx.fillStyle = '#808080'; ctx.fillRect(x,y,tileSize,tileSize); } // Темир
            if(tile === 3) { ctx.fillStyle = '#1E90FF'; ctx.fillRect(x,y,tileSize,tileSize); } // Суу
            if(tile === 4) { ctx.fillStyle = '#228B22'; ctx.fillRect(x,y,tileSize,tileSize); } // Токой (бадал)
        }
    }
}

// Негизги оюн цикли (Game Loop)
function gameLoop() {
    // 1. Кадрды тазалоо
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 2. Картаны тартуу
    drawMap();

    // 3. Объекттерди жаңыртуу жана тартуу
    player.draw(ctx);
    
    enemies.forEach(enemy => {
        enemy.update();
        enemy.draw(ctx);
    });

    // Бул жерге кыймыл жана кагылышуу (collision) коддору кошулат

    requestAnimationFrame(gameLoop);
}

function startGame() {
    gameLoop();
}
