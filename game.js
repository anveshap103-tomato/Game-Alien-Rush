class SolarFlareManager {
    constructor(game) {
        this.game = game;
        this.isActive = false;
        this.hasSpawned = false;
        this.duration = 8000; // 8 seconds in milliseconds
        this.startTime = 0;
        this.waveX = -200;
        this.particles = [];
        this.screenShake = 0;
    }
    
    canSpawn() {
        return this.game.score >= 2000 && !this.hasSpawned && !this.isActive;
    }
    
    trySpawn() {
        if (this.canSpawn() && Math.random() < 0.002) { // 0.2% chance per frame after score 2000
            this.activateSolarFlare();
        }
    }
    
    activateSolarFlare() {
        this.isActive = true;
        this.hasSpawned = true;
        this.startTime = Date.now();
        this.waveX = -200;
        this.screenShake = 10;
        this.createWaveParticles();
    }
    
    deactivateSolarFlare() {
        this.isActive = false;
        this.waveX = -200;
        this.particles = [];
        this.screenShake = 0;
    }
    
    update() {
        if (!this.isActive) return;
        
        const elapsed = Date.now() - this.startTime;
        if (elapsed >= this.duration) {
            this.deactivateSolarFlare();
            return;
        }
        
        // Move wave across screen
        this.waveX += 8;
        
        // Update screen shake
        if (this.screenShake > 0) {
            this.screenShake *= 0.95;
        }
        
        // Update particles
        this.updateParticles();
        
        // Auto-collect items and destroy obstacles
        this.processWaveEffects();
    }
    
    createWaveParticles() {
        for (let i = 0; i < 50; i++) {
            this.particles.push({
                x: this.waveX + Math.random() * 100,
                y: Math.random() * this.game.height,
                vx: Math.random() * 4 + 2,
                vy: (Math.random() - 0.5) * 2,
                life: 60,
                maxLife: 60
            });
        }
    }
    
    updateParticles() {
        // Add new particles at wave front
        if (Math.random() < 0.3) {
            this.particles.push({
                x: this.waveX + Math.random() * 50,
                y: Math.random() * this.game.height,
                vx: Math.random() * 3 + 1,
                vy: (Math.random() - 0.5) * 2,
                life: 40,
                maxLife: 40
            });
        }
        
        this.particles = this.particles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.life--;
            return p.life > 0;
        });
    }
    
    processWaveEffects() {
        // Destroy obstacles in wave path
        this.game.obstacles = this.game.obstacles.filter(obstacle => {
            if (obstacle.x < this.waveX + 100 && obstacle.x > this.waveX - 50) {
                this.game.createExplosion(obstacle.x, obstacle.y);
                return false;
            }
            return true;
        });
        
        // Auto-collect collectibles
        this.game.collectibles = this.game.collectibles.filter(collectible => {
            if (collectible.x < this.waveX + 100 && collectible.x > this.waveX - 50) {
                if (collectible.type === 'astronaut') {
                    this.game.aliens.push(new Alien(this.game.aliens[0]?.x - 30 || 100, this.game.height - 80));
                    this.game.score += 100; // Award points for astronaut
                    this.game.createInfectionEffect(collectible.x, collectible.y);
                } else if (collectible.type === 'crystal') {
                    this.game.crystals += 10;
                    this.game.score += 50; // Award points for crystal
                    this.game.createSparkles(collectible.x, collectible.y);
                }
                return false;
            }
            return true;
        });
    }
    
    getRemainingTime() {
        if (!this.isActive) return 0;
        const elapsed = Date.now() - this.startTime;
        return Math.max(0, Math.ceil((this.duration - elapsed) / 1000));
    }
    
    draw(ctx) {
        if (!this.isActive) return;
        
        // Draw main wave
        const gradient = ctx.createLinearGradient(this.waveX, 0, this.waveX + 200, 0);
        gradient.addColorStop(0, 'rgba(255, 165, 0, 0)');
        gradient.addColorStop(0.3, 'rgba(255, 140, 0, 0.8)');
        gradient.addColorStop(0.7, 'rgba(255, 69, 0, 0.6)');
        gradient.addColorStop(1, 'rgba(255, 165, 0, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(this.waveX, 0, 200, this.game.height);
        
        // Draw particles
        this.particles.forEach(p => {
            const alpha = p.life / p.maxLife;
            ctx.fillStyle = `rgba(255, 140, 0, ${alpha})`;
            ctx.shadowColor = '#ff8c00';
            ctx.shadowBlur = 5;
            ctx.fillRect(p.x, p.y, 3, 3);
        });
        
        ctx.shadowBlur = 0;
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        
        this.aliens = [];
        this.obstacles = [];
        this.collectibles = [];
        this.powerUps = [];
        this.particles = [];
        
        this.score = 0;
        this.crystals = 0;
        this.gameSpeed = 2;
        this.isGameOver = false;
        this.isJumping = false;
        this.jumpPower = 0;
        
        this.spawnTimer = 0;
        this.powerUpTimer = 0;
        this.backgroundOffset = 0;
        
        this.solarFlare = new SolarFlareManager(this);
        
        this.init();
        this.bindEvents();
        this.gameLoop();
    }
    
    init() {
        // Initialize alien pack with 3 aliens
        for (let i = 0; i < 3; i++) {
            this.aliens.push(new Alien(100 + i * 30, this.height - 80));
        }
    }
    
    bindEvents() {
        // Touch and click controls
        this.canvas.addEventListener('mousedown', () => this.jump());
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.jump();
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                this.jump();
            }
        });
    }
    
    jump() {
        if (!this.isGameOver && !this.isJumping) {
            this.isJumping = true;
            this.jumpPower = 15;
        }
    }
    
    update() {
        if (this.isGameOver) return;
        
        this.score += 1;
        this.gameSpeed += 0.001;
        this.spawnTimer++;
        this.powerUpTimer++;
        
        // Update Solar Flare
        this.solarFlare.trySpawn();
        this.solarFlare.update();
        
        // Update alien physics
        this.updateAliens();
        
        // Spawn obstacles and collectibles
        if (this.spawnTimer > 120) {
            this.spawnObstacle();
            this.spawnTimer = 0;
        }
        
        if (Math.random() < 0.01) {
            this.spawnCollectible();
        }
        
        if (this.powerUpTimer > 600 && Math.random() < 0.005) {
            this.spawnPowerUp();
            this.powerUpTimer = 0;
        }
        
        // Update game objects
        this.updateObstacles();
        this.updateCollectibles();
        this.updatePowerUps();
        this.updateParticles();
        
        // Check collisions (skip if solar flare active for invincibility)
        if (!this.solarFlare.isActive) {
            this.checkCollisions();
        }
        
        // Game over condition
        if (this.aliens.length === 0) {
            this.gameOver();
        }
        
        this.updateUI();
    }
    
    updateAliens() {
        // Handle jumping physics
        if (this.isJumping) {
            this.jumpPower -= 0.8;
            if (this.jumpPower <= 0) {
                this.isJumping = false;
                this.jumpPower = 0;
            }
        }
        
        // Update each alien in pack
        this.aliens.forEach((alien, index) => {
            alien.update();
            
            // Apply jump to all aliens
            if (this.isJumping) {
                alien.y -= this.jumpPower;
            } else {
                // Gravity
                if (alien.y < this.height - 80) {
                    alien.y += 8;
                } else {
                    alien.y = this.height - 80;
                }
            }
            
            // Formation movement
            alien.targetX = 100 + index * 25;
            alien.x += (alien.targetX - alien.x) * 0.1;
        });
    }
    
    spawnObstacle() {
        const types = ['laser', 'mine', 'barrier'];
        const type = types[Math.floor(Math.random() * types.length)];
        this.obstacles.push(new Obstacle(this.width, this.height - 80, type));
    }
    
    spawnCollectible() {
        if (Math.random() < 0.7) {
            // Spawn astronaut to infect
            this.collectibles.push(new Astronaut(this.width, this.height - 80));
        } else {
            // Spawn crystal
            this.collectibles.push(new Crystal(this.width, this.height - 100));
        }
    }
    
    spawnPowerUp() {
        const types = ['shield', 'clone', 'phase'];
        const type = types[Math.floor(Math.random() * types.length)];
        this.powerUps.push(new PowerUp(this.width, this.height - 100, type));
    }
    
    updateObstacles() {
        this.obstacles = this.obstacles.filter(obstacle => {
            obstacle.x -= this.gameSpeed;
            return obstacle.x > -50;
        });
    }
    
    updateCollectibles() {
        this.collectibles = this.collectibles.filter(collectible => {
            collectible.x -= this.gameSpeed;
            return collectible.x > -50;
        });
    }
    
    updatePowerUps() {
        this.powerUps = this.powerUps.filter(powerUp => {
            powerUp.x -= this.gameSpeed;
            return powerUp.x > -50;
        });
    }
    
    updateParticles() {
        this.particles = this.particles.filter(particle => {
            particle.update();
            return particle.life > 0;
        });
    }
    
    checkCollisions() {
        // Check obstacle collisions
        this.obstacles.forEach(obstacle => {
            this.aliens.forEach((alien, index) => {
                if (this.isColliding(alien, obstacle)) {
                    this.aliens.splice(index, 1);
                    this.createExplosion(alien.x, alien.y);
                }
            });
        });
        
        // Check collectible collisions
        this.collectibles.forEach((collectible, cIndex) => {
            this.aliens.forEach(alien => {
                if (this.isColliding(alien, collectible)) {
                    if (collectible.type === 'astronaut') {
                        this.aliens.push(new Alien(alien.x - 30, alien.y));
                        this.createInfectionEffect(collectible.x, collectible.y);
                    } else if (collectible.type === 'crystal') {
                        this.crystals += 10;
                        this.createSparkles(collectible.x, collectible.y);
                    }
                    this.collectibles.splice(cIndex, 1);
                }
            });
        });
        
        // Check power-up collisions
        this.powerUps.forEach((powerUp, pIndex) => {
            this.aliens.forEach(alien => {
                if (this.isColliding(alien, powerUp)) {
                    this.activatePowerUp(powerUp.type);
                    this.powerUps.splice(pIndex, 1);
                }
            });
        });
    }
    
    isColliding(obj1, obj2) {
        return obj1.x < obj2.x + obj2.width &&
               obj1.x + obj1.width > obj2.x &&
               obj1.y < obj2.y + obj2.height &&
               obj1.y + obj1.height > obj2.y;
    }
    
    activatePowerUp(type) {
        switch(type) {
            case 'shield':
                // Temporary invincibility
                break;
            case 'clone':
                if (this.aliens.length > 0) {
                    this.aliens.push(new Alien(this.aliens[0].x - 30, this.aliens[0].y));
                }
                break;
            case 'phase':
                // Temporary phase through obstacles
                break;
        }
    }
    
    createExplosion(x, y) {
        for (let i = 0; i < 8; i++) {
            this.particles.push(new Particle(x, y, '#ff0066', 'explosion'));
        }
    }
    
    createInfectionEffect(x, y) {
        for (let i = 0; i < 5; i++) {
            this.particles.push(new Particle(x, y, '#00ff00', 'infection'));
        }
    }
    
    createSparkles(x, y) {
        for (let i = 0; i < 6; i++) {
            this.particles.push(new Particle(x, y, '#00ffff', 'sparkle'));
        }
    }
    
    render() {
        // Apply screen shake if solar flare active
        this.ctx.save();
        if (this.solarFlare.screenShake > 0) {
            const shakeX = (Math.random() - 0.5) * this.solarFlare.screenShake;
            const shakeY = (Math.random() - 0.5) * this.solarFlare.screenShake;
            this.ctx.translate(shakeX, shakeY);
        }
        
        // Clear canvas
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Draw scrolling background
        this.drawBackground();
        
        // Draw game objects
        this.aliens.forEach(alien => alien.draw(this.ctx));
        this.obstacles.forEach(obstacle => obstacle.draw(this.ctx));
        this.collectibles.forEach(collectible => collectible.draw(this.ctx));
        this.powerUps.forEach(powerUp => powerUp.draw(this.ctx));
        this.particles.forEach(particle => particle.draw(this.ctx));
        
        // Draw solar flare effect
        this.solarFlare.draw(this.ctx);
        
        this.ctx.restore();
        
        // Draw UI (not affected by screen shake)
        this.drawSolarFlareUI();
    }
    
    drawBackground() {
        this.backgroundOffset -= this.gameSpeed * 0.5;
        
        // Draw stars
        this.ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 50; i++) {
            const x = (i * 37 + this.backgroundOffset) % this.width;
            const y = (i * 23) % this.height;
            this.ctx.fillRect(x, y, 1, 1);
        }
        
        // Draw distant planets
        this.ctx.fillStyle = '#4400ff';
        this.ctx.beginPath();
        this.ctx.arc((200 + this.backgroundOffset * 0.3) % (this.width + 100), 100, 30, 0, Math.PI * 2);
        this.ctx.fill();
    }
    
    updateUI() {
        document.getElementById('swarmSize').textContent = this.aliens.length;
        document.getElementById('score').textContent = Math.floor(this.score);
        document.getElementById('crystals').textContent = this.crystals;
    }
    
    gameOver() {
        this.isGameOver = true;
        document.getElementById('finalScore').textContent = Math.floor(this.score);
        document.getElementById('gameOver').style.display = 'block';
    }
    
    drawSolarFlareUI() {
        if (this.solarFlare.isActive) {
            const remaining = this.solarFlare.getRemainingTime();
            this.ctx.fillStyle = '#ff8c00';
            this.ctx.font = 'bold 20px Arial';
            this.ctx.shadowColor = '#ff8c00';
            this.ctx.shadowBlur = 10;
            this.ctx.fillText(`SOLAR FLARE ACTIVE - ${remaining}s`, this.width / 2 - 120, 50);
            this.ctx.shadowBlur = 0;
        }
    }
    
    restart() {
        this.aliens = [];
        this.obstacles = [];
        this.collectibles = [];
        this.powerUps = [];
        this.particles = [];
        this.score = 0;
        this.gameSpeed = 2;
        this.isGameOver = false;
        this.isJumping = false;
        this.jumpPower = 0;
        
        this.solarFlare = new SolarFlareManager(this);
        
        document.getElementById('gameOver').style.display = 'none';
        this.init();
    }
    
    gameLoop() {
        this.update();
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }
}

class Alien {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 20;
        this.height = 30;
        this.targetX = x;
        this.glowPhase = Math.random() * Math.PI * 2;
    }
    
    update() {
        this.glowPhase += 0.1;
    }
    
    draw(ctx) {
        // Glowing effect
        const glow = Math.sin(this.glowPhase) * 0.3 + 0.7;
        ctx.shadowColor = '#00ff00';
        ctx.shadowBlur = 10 * glow;
        
        // Body
        ctx.fillStyle = '#004400';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Glowing eyes
        ctx.fillStyle = `rgba(0, 255, 0, ${glow})`;
        ctx.fillRect(this.x + 3, this.y + 5, 3, 3);
        ctx.fillRect(this.x + 14, this.y + 5, 3, 3);
        
        // Tentacles
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.x + 10, this.y + this.height);
        ctx.lineTo(this.x + 5, this.y + this.height + 10);
        ctx.moveTo(this.x + 10, this.y + this.height);
        ctx.lineTo(this.x + 15, this.y + this.height + 10);
        ctx.stroke();
        
        ctx.shadowBlur = 0;
    }
}

class Obstacle {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.width = 30;
        this.height = 40;
        this.animPhase = 0;
    }
    
    draw(ctx) {
        this.animPhase += 0.2;
        
        switch(this.type) {
            case 'laser':
                ctx.strokeStyle = '#ff0066';
                ctx.lineWidth = 4;
                ctx.shadowColor = '#ff0066';
                ctx.shadowBlur = 15;
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(this.x, this.y - 100);
                ctx.stroke();
                ctx.shadowBlur = 0;
                break;
                
            case 'mine':
                const pulse = Math.sin(this.animPhase) * 0.3 + 0.7;
                ctx.fillStyle = `rgba(255, 102, 0, ${pulse})`;
                ctx.shadowColor = '#ff6600';
                ctx.shadowBlur = 10;
                ctx.beginPath();
                ctx.arc(this.x + 15, this.y - 15, 15, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
                break;
                
            case 'barrier':
                ctx.fillStyle = '#0066ff';
                ctx.shadowColor = '#0066ff';
                ctx.shadowBlur = 8;
                ctx.fillRect(this.x, this.y - this.height, this.width, this.height);
                ctx.shadowBlur = 0;
                break;
        }
    }
}

class Astronaut {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 20;
        this.height = 30;
        this.type = 'astronaut';
    }
    
    draw(ctx) {
        // White spacesuit
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Helmet
        ctx.strokeStyle = '#cccccc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x + 10, this.y + 8, 8, 0, Math.PI * 2);
        ctx.stroke();
        
        // Face
        ctx.fillStyle = '#ffddaa';
        ctx.beginPath();
        ctx.arc(this.x + 10, this.y + 8, 6, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Crystal {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 15;
        this.height = 15;
        this.type = 'crystal';
        this.rotation = 0;
    }
    
    draw(ctx) {
        this.rotation += 0.1;
        
        ctx.save();
        ctx.translate(this.x + 7.5, this.y + 7.5);
        ctx.rotate(this.rotation);
        
        ctx.fillStyle = '#00ffff';
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 10;
        ctx.fillRect(-7.5, -7.5, 15, 15);
        
        ctx.shadowBlur = 0;
        ctx.restore();
    }
}

class PowerUp {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.width = 25;
        this.height = 25;
        this.type = type;
        this.pulse = 0;
    }
    
    draw(ctx) {
        this.pulse += 0.15;
        const scale = Math.sin(this.pulse) * 0.2 + 1;
        
        ctx.save();
        ctx.translate(this.x + 12.5, this.y + 12.5);
        ctx.scale(scale, scale);
        
        switch(this.type) {
            case 'shield':
                ctx.strokeStyle = '#ffff00';
                ctx.lineWidth = 3;
                ctx.shadowColor = '#ffff00';
                ctx.shadowBlur = 15;
                ctx.beginPath();
                ctx.arc(0, 0, 12, 0, Math.PI * 2);
                ctx.stroke();
                break;
                
            case 'clone':
                ctx.fillStyle = '#ff00ff';
                ctx.shadowColor = '#ff00ff';
                ctx.shadowBlur = 10;
                ctx.fillRect(-10, -10, 20, 20);
                break;
                
            case 'phase':
                ctx.strokeStyle = '#00ffff';
                ctx.lineWidth = 2;
                ctx.shadowColor = '#00ffff';
                ctx.shadowBlur = 12;
                ctx.strokeRect(-10, -10, 20, 20);
                break;
        }
        
        ctx.shadowBlur = 0;
        ctx.restore();
    }
}

class Particle {
    constructor(x, y, color, type) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 8;
        this.vy = (Math.random() - 0.5) * 8;
        this.color = color;
        this.type = type;
        this.life = 30;
        this.maxLife = 30;
    }
    
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.2; // gravity
        this.life--;
    }
    
    draw(ctx) {
        const alpha = this.life / this.maxLife;
        ctx.fillStyle = this.color.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
        ctx.fillRect(this.x, this.y, 3, 3);
    }
}

// Start the game
const game = new Game();