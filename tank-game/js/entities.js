// Аудио жана Спрайттарды жүктөө
const sounds = {
    shoot: new Audio('assets/sounds/shoot.mp3'),
    explosion: new Audio('assets/sounds/explosion.mp3')
};

const images = {
    tankPlayer: new Image(),
    tankEnemyHeavy: new Image(),
    tankEnemyFast: new Image(),
    powerupShield: new Image()
};
images.tankPlayer.src = 'assets/sprites/player_tank.png';
// Калган сүрөттөрдүн жолдорун да ушинтип көрсөтөсүз

// Негизги Танк классы
class Tank {
    constructor(x, y, speed, hp, type) {
        this.x = x;
        this.y = y;
        this.speed = speed;
        this.hp = hp;
        this.type = type;
        this.isShielded = false;
    }

    draw(ctx) {
        // Жөнөкөй төрт бурчтуктун ордуна спрайт (сүрөт) колдонобуз
        let img = this.type === 'player' ? images.tankPlayer : images.tankEnemyHeavy;
        if(img.complete) {
            ctx.drawImage(img, this.x, this.y, 40, 40);
        } else {
            // Сүрөт жүктөлгүчө убактылуу төрт бурчтук
            ctx.fillStyle = this.type === 'player' ? 'blue' : 'red';
            ctx.fillRect(this.x, this.y, 40, 40);
        }

        // Калкан эффектиси
        if(this.isShielded) {
            ctx.strokeStyle = 'cyan';
            ctx.lineWidth = 3;
            ctx.strokeRect(this.x - 2, this.y - 2, 44, 44);
        }
    }

    shoot() {
        sounds.shoot.play();
        // Ок чыгаруу логикасы (бул жерге Bullet классы кошулат)
    }
}

// AI Боттордун түрлөрү
class FastEnemy extends Tank {
    constructor(x, y) {
        super(x, y, 3, 1, 'enemy_fast'); // Ылдамдыгы: 3, HP: 1
    }
    update(playerPos) {
        // Түз эле базага же туш келди басуу логикасы
        this.y += this.speed; 
    }
}

class HeavyEnemy extends Tank {
    constructor(x, y) {
        super(x, y, 1, 4, 'enemy_heavy'); // Ылдамдыгы: 1, HP: 4 (Оор танк)
    }
    // ... кыймыл логикасы
}

// Бонустар (Power-ups)
class PowerUp {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; // 'shield', 'freeze', 'bomb'
    }

    applyEffect(player) {
        if (this.type === 'shield') {
            player.isShielded = true;
            setTimeout(() => player.isShielded = false, 10000); // 10 секунд
        }
    }
}
