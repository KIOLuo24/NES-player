// ============================================
// FC模拟器类 - 基于EmulatorJS简化版
// ============================================

class FCSuperMarioEmulator {
    constructor() {
        this.ejs = null;
        this.gameContainer = document.getElementById('gameContainer');
        this.targetROM = 'game/nes/super marioNES/All Night Nippon Super Mario Bros [p1].nes';
        this.isRunning = false;
        this.isInitialized = false;
        this.audioContext = null;  // 添加音频上下文

        // 添加覆盖层相关属性
        this.overlay = document.getElementById('overlay');
        this.playButton = document.getElementById('playButton');

        this.init();
    }

    async init() {
        try {
            // 等待EmulatorJS加载完成
            await this.waitForEmulatorJS();

            // 设置覆盖层事件
            this.setupOverlay();

            // 设置控制按钮
            this.setupControls();

            // 初始化模拟器
            await this.initEmulator();

            // 自动加载游戏
            await this.autoLoadGame();

            // 启动游戏（不等待用户交互）
            this.startGameImmediately();

        } catch (error) {
            console.error('初始化失败:', error);
            this.updateStatus(`初始化失败: ${error.message}`, 'error');
        }
    }

    // 设置覆盖层事件
    setupOverlay() {
        if (this.playButton) {
            this.playButton.addEventListener('click', () => {
                this.hideOverlay();
                this.resumeAudioContext();
            });
        }
    }

    // 隐藏覆盖层
    hideOverlay() {
        if (this.overlay) {
            this.overlay.style.display = 'none';
        }
    }

    // 立即启动游戏，不等待用户交互
    startGameImmediately() {
        console.log('尝试立即启动游戏...');

        // 延迟一段时间确保模拟器已完全初始化
        setTimeout(() => {
            if (this.ejs && this.ejs.start) {
                console.log('调用ejs.start()启动游戏');

                // 确保音频上下文可用
                this.resumeAudioContext();

                this.ejs.start();

                // 如果ejs.start()没有立即生效，可以尝试模拟点击
                setTimeout(() => {
                    if (!this.isRunning) {
                        console.log('ejs.start()可能未生效，尝试模拟点击');
                        this.simulateClick();
                    }
                }, 1000);
            } else {
                console.log('模拟器未完全初始化，稍后重试');
                setTimeout(() => this.startGameImmediately(), 1000);
            }
        }, 1000); // 延迟1秒确保一切就绪
    }

    // 模拟鼠标点击
    simulateClick() {
        // 获取游戏容器元素
        const gameContainer = document.getElementById('gameContainer');
        if (gameContainer) {
            // 创建并分发鼠标点击事件
            const clickEvent = new MouseEvent('click', {
                view: window,
                bubbles: true,
                cancelable: true,
                clientX: gameContainer.clientWidth / 2,
                clientY: gameContainer.clientHeight / 2
            });

            // 触发点击事件
            gameContainer.dispatchEvent(clickEvent);

            // 恢复音频上下文
            this.resumeAudioContext();

            console.log('已执行自动点击');
            this.updateStatus('已执行自动点击', 'success');
        } else {
            console.warn('未找到游戏容器元素');
        }
    }

    // 恢复音频上下文
    resumeAudioContext() {
        if (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined') {
            if (!this.audioContext) {
                // 创建新的音频上下文
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            if (this.audioContext.state === 'suspended' || this.audioContext.state === 'closed') {
                this.audioContext.resume()
                    .then(() => {
                        console.log('音频上下文已恢复');
                    })
                    .catch(err => {
                        console.error('音频上下文恢复失败:', err);
                        // 如果恢复失败，尝试创建新的音频上下文
                        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    });
            }
        }
    }

    // 等待EmulatorJS核心加载
    waitForEmulatorJS() {
        return new Promise((resolve, reject) => {
            // 先检查是否已经加载
            if (window.EJS && window.EJS.emulator) {
                resolve();
                return;
            }

            let attempts = 0;
            const maxAttempts = 50; // 最多等待5秒

            const checkEJS = () => {
                attempts++;

                if (window.EJS && window.EJS.emulator) {
                    resolve();
                } else if (attempts >= maxAttempts) {
                    reject(new Error('EmulatorJS加载超时'));
                } else {
                    setTimeout(checkEJS, 100);
                }
            };

            checkEJS();
        });
    }

    setupControls() {
        // 加载ROM按钮
        const loadButton = document.getElementById('loadButton');
        const romInput = document.getElementById('romInput');
        const startButton = document.getElementById('startButton');
        const pauseButton = document.getElementById('pauseButton');
        const resetButton = document.getElementById('resetButton');

        if (loadButton && romInput) {
            loadButton.addEventListener('click', () => {
                romInput.click();
            });
        }

        if (romInput) {
            romInput.addEventListener('change', (e) => this.loadROM(e));
        }

        if (startButton) {
            startButton.addEventListener('click', () => this.start());
        }

        if (pauseButton) {
            pauseButton.addEventListener('click', () => this.pause());
        }

        if (resetButton) {
            resetButton.addEventListener('click', () => this.reset());
        }
    }

    async initEmulator() {
        if (this.isInitialized) return;

        this.updateStatus('正在初始化模拟器...', 'loading');

        try {
            // 使用EmulatorJS的简化初始化方式
            this.ejs = window.EJS.emulator;

            // 监听EmulatorJS事件
            this.setupEmulatorEvents();

            this.isInitialized = true;
            this.updateStatus('模拟器初始化成功', 'success');

        } catch (error) {
            console.error('模拟器初始化失败:', error);
            throw error;
        }
    }

    setupEmulatorEvents() {
        if (!this.ejs) return;

        // 监听模拟器状态变化
        this.ejs.on('load', () => {
            console.log('模拟器加载完成');
            this.updateStatus('模拟器准备就绪', 'success');
            this.enableControls();
        });

        this.ejs.on('error', (error) => {
            console.error('模拟器错误:', error);
            this.updateStatus(`错误: ${error}`, 'error');
        });

        this.ejs.on('start', () => {
            console.log('游戏开始');
            this.isRunning = true;

            // 确保音频上下文已启动
            this.resumeAudioContext();

            this.updateStatus('游戏运行中...', 'success');
            this.updateButtonStates();
        });

        this.ejs.on('pause', () => {
            console.log('游戏暂停');
            this.isRunning = false;
            this.updateStatus('游戏已暂停', 'loading');
            this.updateButtonStates();
        });

        // 监听音频相关事件
        this.ejs.on('audio', () => {
            // 当模拟器尝试使用音频时，确保音频上下文已恢复
            this.resumeAudioContext();
        });

        // 监听其他可能需要音频的事件
        this.ejs.on('ready', () => {
            this.resumeAudioContext();
        });
    }

    async autoLoadGame() {
        if (!this.isInitialized) {
            this.updateStatus('模拟器未初始化', 'error');
            return;
        }

        this.updateStatus('正在加载超级马里奥...', 'loading');

        try {
            // 检查ROM文件是否存在
            const response = await fetch(this.targetROM);

            if (!response.ok) {
                throw new Error(`无法找到游戏文件: ${this.targetROM}`);
            }

            // 告诉EmulatorJS加载游戏
            if (this.ejs && this.ejs.loadROM) {
                const arrayBuffer = await response.arrayBuffer();
                this.ejs.loadROM(arrayBuffer);

                this.updateStatus('超级马里奥加载成功！', 'success');
            } else {
                // 如果ejs没有loadROM方法，使用全局配置
                console.log('使用全局配置加载游戏');
            }

        } catch (error) {
            console.error('自动加载失败:', error);
            this.updateStatus(`自动加载失败: ${error.message}，请手动加载ROM`, 'error');

            // 显示加载按钮
            const loadButton = document.getElementById('loadButton');
            if (loadButton) {
                loadButton.style.display = 'inline-block';
            }
        }
    }

    async loadROM(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.updateStatus(`正在加载: ${file.name}...`, 'loading');

        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                if (!this.isInitialized) {
                    await this.initEmulator();
                }

                if (this.ejs && this.ejs.loadROM) {
                    this.ejs.loadROM(e.target.result);
                    this.updateStatus(`${file.name} 加载成功`, 'success');
                    this.enableControls();

                    // 加载完成后自动开始游戏
                    setTimeout(() => {
                        this.start();
                    }, 500);
                } else {
                    throw new Error('模拟器未正确初始化');
                }

            } catch (error) {
                this.updateStatus(`加载失败: ${error.message}`, 'error');
                console.error('ROM加载错误:', error);
            }
        };

        reader.onerror = () => {
            this.updateStatus('文件读取失败', 'error');
        };

        reader.readAsArrayBuffer(file);
    }

    start() {
        if (this.ejs && this.ejs.start) {
            this.ejs.start();
        } else {
            this.updateStatus('模拟器未准备好', 'error');
        }
    }

    pause() {
        if (this.ejs && this.ejs.pause) {
            this.ejs.pause();
        }
    }

    reset() {
        if (this.ejs && this.ejs.reset) {
            this.ejs.reset();
            this.updateStatus('游戏已重置', 'success');
        }
    }

    updateStatus(message, type = 'normal') {
        const statusElement = document.getElementById('status');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = type;
        }

        console.log(`[状态] ${message}`);
    }

    enableControls() {
        const startBtn = document.getElementById('startButton');
        const pauseBtn = document.getElementById('pauseButton');
        const resetBtn = document.getElementById('resetButton');

        if (startBtn) startBtn.disabled = false;
        if (pauseBtn) pauseBtn.disabled = false;
        if (resetBtn) resetBtn.disabled = false;
    }

    updateButtonStates() {
        const startBtn = document.getElementById('startButton');
        const pauseBtn = document.getElementById('pauseButton');

        if (this.isRunning) {
            if (startBtn) startBtn.disabled = true;
            if (pauseBtn) pauseBtn.disabled = false;
        } else {
            if (startBtn) startBtn.disabled = false;
            if (pauseBtn) pauseBtn.disabled = true;
        }
    }

    resizeGame() {
        const canvas = this.gameContainer.querySelector('canvas');
        if (canvas) {
            const containerWidth = this.gameContainer.clientWidth;
            const newHeight = (containerWidth * 240) / 256;
            canvas.style.height = newHeight + 'px';
        }
    }
}

let emulatorInstance;

// 页面加载完成后初始化
window.addEventListener('load', function() {
    // 延迟初始化，确保EmulatorJS已加载
    setTimeout(() => {
        emulatorInstance = new FCSuperMarioEmulator();

        // 调整游戏尺寸
        if (emulatorInstance.resizeGame) {
            emulatorInstance.resizeGame();
        }

        // 添加用户交互监听器以启用音频
        const enableAudioOnInteraction = () => {
            if (emulatorInstance) {
                emulatorInstance.resumeAudioContext();
            }
        };

        // 监听多种用户交互事件
        ['click', 'touchstart', 'keydown', 'mousedown', 'pointerdown', 'touchend'].forEach(eventType => {
            document.addEventListener(eventType, enableAudioOnInteraction, { once: true, passive: true });
        });
    }, 1000);
});

// 窗口大小变化时调整游戏尺寸
window.addEventListener('resize', function() {
    if (emulatorInstance && emulatorInstance.resizeGame) {
        emulatorInstance.resizeGame();
    }
});

// 页面卸载前清理
window.addEventListener('beforeunload', function() {
    if (emulatorInstance) {
        emulatorInstance.pause();
    }
});

// 全局控制函数（供HTML直接调用）
function startGame() {
    if (emulatorInstance) emulatorInstance.start();
}

function pauseGame() {
    if (emulatorInstance) emulatorInstance.pause();
}

function resetGame() {
    if (emulatorInstance) emulatorInstance.reset();
}

// 自动加载本地游戏（兼容旧代码）
async function autoLoadLocalGame() {
    console.log('autoLoadLocalGame已弃用，使用新的初始化方式');
}
