(function () {
  'use strict';

  // --- Configuration & Constants ---
  const CANVAS_SIZE = 440;
  const GRID_COUNT = 22;
  const CELL_SIZE = CANVAS_SIZE / GRID_COUNT; // 20px

  const SPEED_CONFIG = {
    easy: 130,
    normal: 90,
    hard: 60,
  };

  // --- Sound Effects with Web Audio API ---
  class SoundController {
    constructor() {
      this.ctx = null;
      this.muted = localStorage.getItem('cybersnake_muted') === 'true';
    }

    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    toggleMute() {
      this.muted = !this.muted;
      localStorage.setItem('cybersnake_muted', this.muted);
      return this.muted;
    }

    playEat() {
      if (this.muted || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const now = this.ctx.currentTime;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.1);
      } catch (e) {
        console.warn('Audio error:', e);
      }
    }

    playBonus() {
      if (this.muted || !this.ctx) return;
      try {
        const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          const start = this.ctx.currentTime + idx * 0.06;

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, start);

          gain.gain.setValueAtTime(0.2, start);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.08);

          osc.connect(gain);
          gain.connect(this.ctx.destination);

          osc.start(start);
          osc.stop(start + 0.08);
        });
      } catch (e) {
        console.warn('Audio error:', e);
      }
    }

    playGameOver() {
      if (this.muted || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const now = this.ctx.currentTime;

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.35);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.35);
      } catch (e) {
        console.warn('Audio error:', e);
      }
    }

    playTurn() {
      if (this.muted || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const now = this.ctx.currentTime;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.03);
      } catch (e) {
        console.warn('Audio error:', e);
      }
    }
  }

  // --- Game Engine Class ---
  class SnakeGame {
    constructor() {
      this.canvas = document.getElementById('game-canvas');
      this.ctx = this.canvas.getContext('2d');
      this.sound = new SoundController();

      // DOM UI Elements
      this.currentScoreEl = document.getElementById('current-score');
      this.highScoreEl = document.getElementById('high-score');
      this.lengthEl = document.getElementById('snake-length');
      this.overlay = document.getElementById('game-overlay');
      this.overlayTitle = document.getElementById('overlay-title');
      this.overlaySubtitle = document.getElementById('overlay-subtitle');
      this.finalStats = document.getElementById('final-stats');
      this.finalScoreEl = document.getElementById('final-score');
      this.newHighScoreBanner = document.getElementById('new-high-score-banner');
      this.startBtn = document.getElementById('start-btn');
      this.pauseBtn = document.getElementById('pause-btn');
      this.soundToggleBtn = document.getElementById('sound-toggle');
      this.soundIcon = document.getElementById('sound-icon');
      this.diffButtons = document.querySelectorAll('.diff-btn');

      // State variables
      this.score = 0;
      this.highScore = parseInt(localStorage.getItem('cybersnake_highscore'), 10) || 0;
      this.highScoreEl.textContent = this.highScore;

      this.currentDifficulty = 'normal';
      this.stepInterval = SPEED_CONFIG[this.currentDifficulty];
      this.gameState = 'IDLE'; // 'IDLE', 'RUNNING', 'PAUSED', 'GAME_OVER'

      this.snake = [];
      this.direction = { x: 1, y: 0 };
      this.inputQueue = [];

      this.food = { x: 0, y: 0 };
      this.bonusFood = null; // { x, y, timeLeft, maxTime }
      this.foodEatenCount = 0;

      this.lastTickTime = 0;
      this.animationFrameId = null;

      this.initSoundUI();
      this.bindEvents();
      this.resetGame();
      this.render();
    }

    initSoundUI() {
      this.soundIcon.textContent = this.sound.muted ? '🔇' : '🔊';
    }

    bindEvents() {
      // Keyboard input
      window.addEventListener('keydown', (e) => this.handleKeyDown(e));

      // Start / Restart Button
      this.startBtn.addEventListener('click', () => {
        this.sound.init();
        if (this.gameState === 'PAUSED') {
          this.resumeGame();
        } else {
          this.startGame();
        }
      });

      // Pause Button
      this.pauseBtn.addEventListener('click', () => {
        this.sound.init();
        this.togglePause();
      });

      // Sound Toggle
      this.soundToggleBtn.addEventListener('click', () => {
        const isMuted = this.sound.toggleMute();
        this.soundIcon.textContent = isMuted ? '🔇' : '🔊';
      });

      // Difficulty Buttons
      this.diffButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
          const speed = btn.dataset.speed;
          if (SPEED_CONFIG[speed]) {
            this.currentDifficulty = speed;
            this.stepInterval = SPEED_CONFIG[speed];
            this.diffButtons.forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
          }
        });
      });

      // D-Pad Controls
      const dpadUp = document.getElementById('dpad-up');
      const dpadDown = document.getElementById('dpad-down');
      const dpadLeft = document.getElementById('dpad-left');
      const dpadRight = document.getElementById('dpad-right');

      const handleDpad = (dir) => {
        this.sound.init();
        if (this.gameState === 'IDLE' || this.gameState === 'GAME_OVER') {
          this.startGame();
        }
        this.queueDirection(dir);
      };

      dpadUp.addEventListener('click', () => handleDpad({ x: 0, y: -1 }));
      dpadDown.addEventListener('click', () => handleDpad({ x: 0, y: 1 }));
      dpadLeft.addEventListener('click', () => handleDpad({ x: -1, y: 0 }));
      dpadRight.addEventListener('click', () => handleDpad({ x: 1, y: 0 }));
    }

    handleKeyDown(e) {
      // Avoid scrolling on arrow keys and space
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      this.sound.init();

      // Spacebar controls
      if (e.code === 'Space') {
        if (this.gameState === 'RUNNING') {
          this.pauseGame();
        } else if (this.gameState === 'PAUSED') {
          this.resumeGame();
        } else if (this.gameState === 'IDLE' || this.gameState === 'GAME_OVER') {
          this.startGame();
        }
        return;
      }

      // R key for immediate restart
      if (e.key === 'r' || e.key === 'R') {
        this.startGame();
        return;
      }

      // Direction keys
      let newDir = null;
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          newDir = { x: 0, y: -1 };
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          newDir = { x: 0, y: 1 };
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          newDir = { x: -1, y: 0 };
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          newDir = { x: 1, y: 0 };
          break;
      }

      if (newDir) {
        if (this.gameState === 'IDLE' || this.gameState === 'GAME_OVER') {
          this.startGame();
        }
        this.queueDirection(newDir);
      }
    }

    queueDirection(newDir) {
      // Determine the reference direction (last queued or current direction)
      const lastDir = this.inputQueue.length > 0 ? this.inputQueue[this.inputQueue.length - 1] : this.direction;

      // Cannot reverse direction directly
      if (newDir.x === -lastDir.x && newDir.y === -lastDir.y) {
        return;
      }

      // Cannot queue identical direction
      if (newDir.x === lastDir.x && newDir.y === lastDir.y) {
        return;
      }

      // Limit buffer to 2 queued turns to ensure responsive, accurate controls
      if (this.inputQueue.length < 2) {
        this.inputQueue.push(newDir);
      }
    }

    resetGame() {
      const midX = Math.floor(GRID_COUNT / 2);
      const midY = Math.floor(GRID_COUNT / 2);

      this.snake = [
        { x: midX, y: midY },
        { x: midX - 1, y: midY },
        { x: midX - 2, y: midY },
      ];

      this.direction = { x: 1, y: 0 };
      this.inputQueue = [];
      this.score = 0;
      this.foodEatenCount = 0;
      this.bonusFood = null;

      this.updateScoreUI();
      this.spawnFood();
    }

    startGame() {
      this.resetGame();
      this.gameState = 'RUNNING';
      this.pauseBtn.textContent = 'Pause';
      this.hideOverlay();
      this.lastTickTime = performance.now();

      if (!this.animationFrameId) {
        this.animationFrameId = requestAnimationFrame((t) => this.gameLoop(t));
      }
    }

    pauseGame() {
      if (this.gameState !== 'RUNNING') return;
      this.gameState = 'PAUSED';
      this.pauseBtn.textContent = 'Resume';
      this.showOverlay('GAME PAUSED', 'Press Space or Resume to continue', false);
    }

    resumeGame() {
      if (this.gameState !== 'PAUSED') return;
      this.gameState = 'RUNNING';
      this.pauseBtn.textContent = 'Pause';
      this.hideOverlay();
      this.lastTickTime = performance.now();
    }

    togglePause() {
      if (this.gameState === 'RUNNING') {
        this.pauseGame();
      } else if (this.gameState === 'PAUSED') {
        this.resumeGame();
      }
    }

    gameOver() {
      this.gameState = 'GAME_OVER';
      this.sound.playGameOver();

      const isNewBest = this.score > this.highScore;
      if (isNewBest) {
        this.highScore = this.score;
        localStorage.setItem('cybersnake_highscore', this.highScore);
        this.highScoreEl.textContent = this.highScore;
      }

      this.finalScoreEl.textContent = this.score;
      if (isNewBest && this.score > 0) {
        this.newHighScoreBanner.classList.remove('hidden');
      } else {
        this.newHighScoreBanner.classList.add('hidden');
      }

      this.showOverlay('GAME OVER', 'Press Space or Play Again to restart', true);
    }

    showOverlay(title, subtitle, showStats) {
      this.overlayTitle.textContent = title;
      this.overlaySubtitle.textContent = subtitle;

      if (showStats) {
        this.finalStats.classList.remove('hidden');
        this.startBtn.textContent = 'PLAY AGAIN';
      } else {
        this.finalStats.classList.add('hidden');
        this.startBtn.textContent = this.gameState === 'PAUSED' ? 'RESUME' : 'START GAME';
      }

      this.overlay.classList.remove('hidden');
    }

    hideOverlay() {
      this.overlay.classList.add('hidden');
    }

    updateScoreUI() {
      this.currentScoreEl.textContent = this.score;
      this.lengthEl.textContent = this.snake.length;
    }

    spawnFood() {
      let valid = false;
      let newFood = { x: 0, y: 0 };

      while (!valid) {
        newFood.x = Math.floor(Math.random() * GRID_COUNT);
        newFood.y = Math.floor(Math.random() * GRID_COUNT);

        const onSnake = this.snake.some((seg) => seg.x === newFood.x && seg.y === newFood.y);
        const onBonus = this.bonusFood && this.bonusFood.x === newFood.x && this.bonusFood.y === newFood.y;

        if (!onSnake && !onBonus) {
          valid = true;
        }
      }

      this.food = newFood;
    }

    spawnBonusFood() {
      let valid = false;
      let newBonus = { x: 0, y: 0 };

      while (!valid) {
        newBonus.x = Math.floor(Math.random() * GRID_COUNT);
        newBonus.y = Math.floor(Math.random() * GRID_COUNT);

        const onSnake = this.snake.some((seg) => seg.x === newBonus.x && seg.y === newBonus.y);
        const onNormalFood = this.food.x === newBonus.x && this.food.y === newBonus.y;

        if (!onSnake && !onNormalFood) {
          valid = true;
        }
      }

      this.bonusFood = {
        x: newBonus.x,
        y: newBonus.y,
        timeLeft: 8000, // 8 seconds
        maxTime: 8000,
      };
    }

    // Main Game Loop
    gameLoop(currentTime) {
      this.animationFrameId = requestAnimationFrame((t) => this.gameLoop(t));

      if (this.gameState !== 'RUNNING') {
        this.render();
        return;
      }

      const elapsed = currentTime - this.lastTickTime;

      // Update bonus food decay
      if (this.bonusFood) {
        this.bonusFood.timeLeft -= (currentTime - (this.lastFrameTime || currentTime));
        if (this.bonusFood.timeLeft <= 0) {
          this.bonusFood = null;
        }
      }
      this.lastFrameTime = currentTime;

      // Fixed-timestep snake movement
      if (elapsed >= this.stepInterval) {
        this.lastTickTime = currentTime;
        this.update();
      }

      this.render();
    }

    update() {
      // Process next direction from input queue
      if (this.inputQueue.length > 0) {
        const nextDir = this.inputQueue.shift();
        if (!(nextDir.x === -this.direction.x && nextDir.y === -this.direction.y)) {
          this.direction = nextDir;
          this.sound.playTurn();
        }
      }

      // Calculate new head position
      const head = this.snake[0];
      const newHead = {
        x: head.x + this.direction.x,
        y: head.y + this.direction.y,
      };

      // Wall Collision Check (Classic Arcade: Wall = Death)
      if (newHead.x < 0 || newHead.x >= GRID_COUNT || newHead.y < 0 || newHead.y >= GRID_COUNT) {
        this.gameOver();
        return;
      }

      // Self Collision Check
      for (let i = 0; i < this.snake.length; i++) {
        if (this.snake[i].x === newHead.x && this.snake[i].y === newHead.y) {
          this.gameOver();
          return;
        }
      }

      // Move snake: add new head
      this.snake.unshift(newHead);

      // Check Normal Food Eating
      if (newHead.x === this.food.x && newHead.y === this.food.y) {
        this.score += 10;
        this.foodEatenCount++;
        this.sound.playEat();
        this.spawnFood();

        // Spawn bonus food every 5 foods eaten
        if (this.foodEatenCount % 5 === 0 && !this.bonusFood) {
          this.spawnBonusFood();
        }

        this.updateScoreUI();
      }
      // Check Bonus Food Eating
      else if (this.bonusFood && newHead.x === this.bonusFood.x && newHead.y === this.bonusFood.y) {
        this.score += 50;
        this.sound.playBonus();
        this.bonusFood = null;
        this.updateScoreUI();
      } else {
        // Normal move: remove tail
        this.snake.pop();
      }
    }

    // --- Rendering Functions ---
    render() {
      const ctx = this.ctx;

      // 1. Clear background
      ctx.fillStyle = '#070a12';
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      // 2. Draw subtle grid
      this.drawGrid();

      // 3. Draw Normal Food
      this.drawFood();

      // 4. Draw Bonus Food (if active)
      if (this.bonusFood) {
        this.drawBonusFood();
      }

      // 5. Draw Snake
      this.drawSnake();
    }

    drawGrid() {
      const ctx = this.ctx;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;

      for (let i = 0; i <= CANVAS_SIZE; i += CELL_SIZE) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, CANVAS_SIZE);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(CANVAS_SIZE, i);
        ctx.stroke();
      }
    }

    drawFood() {
      const ctx = this.ctx;
      const x = this.food.x * CELL_SIZE + CELL_SIZE / 2;
      const y = this.food.y * CELL_SIZE + CELL_SIZE / 2;
      const radius = CELL_SIZE / 2.3;

      // Pulsing food glow effect
      const pulse = Math.sin(Date.now() / 180) * 2;

      ctx.save();
      ctx.shadowColor = '#f43f5e';
      ctx.shadowBlur = 12 + pulse;

      // Outer Apple body
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(x, y, radius + pulse * 0.4, 0, Math.PI * 2);
      ctx.fill();

      // Inner highlight
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fda4af';
      ctx.beginPath();
      ctx.arc(x - radius * 0.3, y - radius * 0.3, radius * 0.35, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    drawBonusFood() {
      const ctx = this.ctx;
      const x = this.bonusFood.x * CELL_SIZE + CELL_SIZE / 2;
      const y = this.bonusFood.y * CELL_SIZE + CELL_SIZE / 2;
      const radius = CELL_SIZE / 2.2;

      const progress = Math.max(0, this.bonusFood.timeLeft / this.bonusFood.maxTime);
      const pulse = Math.sin(Date.now() / 100) * 3;

      ctx.save();
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 16 + pulse;

      // Golden Star / Gem
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Inner glow
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(x, y, radius * 0.5, 0, Math.PI * 2);
      ctx.fill();

      // Countdown Ring around bonus food
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x, y, radius + 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
      ctx.stroke();

      ctx.restore();
    }

    drawSnake() {
      const ctx = this.ctx;

      for (let i = this.snake.length - 1; i >= 0; i--) {
        const seg = this.snake[i];
        const px = seg.x * CELL_SIZE;
        const py = seg.y * CELL_SIZE;

        if (i === 0) {
          // --- Snake Head ---
          ctx.save();
          ctx.shadowColor = '#10b981';
          ctx.shadowBlur = 14;

          // Head Body
          ctx.fillStyle = '#34d399';
          this.roundRect(ctx, px + 1, py + 1, CELL_SIZE - 2, CELL_SIZE - 2, 6);
          ctx.fill();
          ctx.restore();

          // Head Eyes
          this.drawEyes(ctx, px, py);
        } else {
          // --- Snake Body Segments ---
          ctx.save();
          const factor = 1 - i / (this.snake.length + 5);
          // Transition green gradient from head to tail
          ctx.fillStyle = `rgba(16, 185, 129, ${0.5 + 0.5 * factor})`;
          this.roundRect(ctx, px + 1.5, py + 1.5, CELL_SIZE - 3, CELL_SIZE - 3, 4);
          ctx.fill();
          ctx.restore();
        }
      }
    }

    drawEyes(ctx, headX, headY) {
      ctx.fillStyle = '#ffffff';
      let eye1 = { x: 0, y: 0 };
      let eye2 = { x: 0, y: 0 };
      const eyeSize = 3;
      const pupilSize = 1.5;

      // Position eyes according to snake travel direction
      if (this.direction.x === 1) {
        // Moving Right
        eye1 = { x: headX + 13, y: headY + 5 };
        eye2 = { x: headX + 13, y: headY + 13 };
      } else if (this.direction.x === -1) {
        // Moving Left
        eye1 = { x: headX + 5, y: headY + 5 };
        eye2 = { x: headX + 5, y: headY + 13 };
      } else if (this.direction.y === -1) {
        // Moving Up
        eye1 = { x: headX + 5, y: headY + 5 };
        eye2 = { x: headX + 13, y: headY + 5 };
      } else {
        // Moving Down
        eye1 = { x: headX + 5, y: headY + 13 };
        eye2 = { x: headX + 13, y: headY + 13 };
      }

      // Draw Whites
      ctx.beginPath();
      ctx.arc(eye1.x, eye1.y, eyeSize, 0, Math.PI * 2);
      ctx.arc(eye2.x, eye2.y, eyeSize, 0, Math.PI * 2);
      ctx.fill();

      // Draw Pupils
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(
        eye1.x + this.direction.x * 0.7,
        eye1.y + this.direction.y * 0.7,
        pupilSize,
        0,
        Math.PI * 2
      );
      ctx.arc(
        eye2.x + this.direction.x * 0.7,
        eye2.y + this.direction.y * 0.7,
        pupilSize,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    roundRect(ctx, x, y, w, h, r) {
      if (w < 2 * r) r = w / 2;
      if (h < 2 * r) r = h / 2;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
  }

  // Launch game on DOM load
  window.addEventListener('DOMContentLoaded', () => {
    window.game = new SnakeGame();
  });
})();
