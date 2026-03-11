// ============================================
// FC 模拟器类 - 基于 EmulatorJS 简化版
// ============================================

class FCSuperMarioEmulator {
    constructor() {
        this.ejs = null;
        this.gameContainer = document.getElementById('gameContainer');
        this.targetROM = 'game/GBA/Pokemon_FireRed_Version/Pokemon_FireRed_Version.gba';
        this.isRunning = false;
        this.isInitialized = false;
        this.audioContext = null;

        // 添加覆盖层相关属性
        this.overlay = document.getElementById('overlay');
        this.playButton = document.getElementById('playButton');

        // 全屏相关属性
        this.originalContainerWidth = '';
        this.originalContainerHeight = '';

        this.init();
    }

    async init() {
        try {
            // 等待 EmulatorJS 加载完成
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
            this.updateStatus(`初始化失败：${error.message}`, 'error');
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
                console.log('调用 ejs.start() 启动游戏');

                // 确保音频上下文可用
                this.resumeAudioContext();

                this.ejs.start();

                // 如果 ejs.start() 没有立即生效，可以尝试模拟点击
                setTimeout(() => {
                    if (!this.isRunning) {
                        console.log('ejs.start() 可能未生效，尝试模拟点击');
                        this.simulateClick();
                    }
                }, 1000);
            } else {
                console.log('模拟器未完全初始化，稍后重试');
                setTimeout(() => this.startGameImmediately(), 1000);
            }
        }, 1000);
    }

    // 模拟鼠标点击
    simulateClick() {
        const gameContainer = document.getElementById('gameContainer');
        if (gameContainer) {
            const clickEvent = new MouseEvent('click', {
                view: window,
                bubbles: true,
                cancelable: true,
                clientX: gameContainer.clientWidth / 2,
                clientY: gameContainer.clientHeight / 2
            });

            gameContainer.dispatchEvent(clickEvent);

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
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            if (this.audioContext.state === 'suspended' || this.audioContext.state === 'closed') {
                this.audioContext.resume()
                    .then(() => {
                        console.log('音频上下文已恢复');
                    })
                    .catch(err => {
                        console.error('音频上下文恢复失败:', err);
                        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    });
            }
        }
    }

    // 等待 EmulatorJS 核心加载
    waitForEmulatorJS() {
        return new Promise((resolve, reject) => {
            if (window.EJS && window.EJS.emulator) {
                resolve();
                return;
            }

            let attempts = 0;
            const maxAttempts = 50;

            const checkEJS = () => {
                attempts++;

                if (window.EJS && window.EJS.emulator) {
                    resolve();
                } else if (attempts >= maxAttempts) {
                    reject(new Error('EmulatorJS 加载超时'));
                } else {
                    setTimeout(checkEJS, 100);
                }
            };

            checkEJS();
        });
    }

    setupControls() {
        const loadButton = document.getElementById('loadButton');
        const romInput = document.getElementById('romInput');
        const startButton = document.getElementById('startButton');
        const pauseButton = document.getElementById('pauseButton');
        const resetButton = document.getElementById('resetButton');
        const fullscreenButton = document.getElementById('fullscreenButton');

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

        if (fullscreenButton) {
            fullscreenButton.addEventListener('click', () => this.toggleFullscreen());
        }
    }

    async initEmulator() {
        if (this.isInitialized) return;

        this.updateStatus('正在初始化模拟器...', 'loading');

        try {
            this.ejs = window.EJS.emulator;

            this.setupEmulatorEvents();

            this.setupFullscreenListener();

            this.isInitialized = true;
            this.updateStatus('模拟器初始化成功', 'success');

        } catch (error) {
            console.error('模拟器初始化失败:', error);
            throw error;
        }
    }

    setupEmulatorEvents() {
        if (!this.ejs) return;

        this.ejs.on('load', () => {
            console.log('模拟器加载完成');
            this.updateStatus('模拟器准备就绪', 'success');
            this.enableControls();
        });

        this.ejs.on('error', (error) => {
            console.error('模拟器错误:', error);
            this.updateStatus(`错误：${error}`, 'error');
        });

        this.ejs.on('start', () => {
            console.log('游戏开始');
            this.isRunning = true;
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

        this.ejs.on('audio', () => {
            this.resumeAudioContext();
        });

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
            const response = await fetch(this.targetROM);

            if (!response.ok) {
                throw new Error(`无法找到游戏文件：${this.targetROM}`);
            }

            if (this.ejs && this.ejs.loadROM) {
                const arrayBuffer = await response.arrayBuffer();
                this.ejs.loadROM(arrayBuffer);

                this.updateStatus('超级马里奥加载成功！', 'success');
            } else {
                console.log('使用全局配置加载游戏');
            }

        } catch (error) {
            console.error('自动加载失败:', error);
            this.updateStatus(`自动加载失败：${error.message}，请手动加载 ROM`, 'error');

            const loadButton = document.getElementById('loadButton');
            if (loadButton) {
                loadButton.style.display = 'inline-block';
            }
        }
    }

    async loadROM(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.updateStatus(`正在加载：${file.name}...`, 'loading');

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

                    setTimeout(() => {
                        this.start();
                    }, 500);
                } else {
                    throw new Error('模拟器未正确初始化');
                }

            } catch (error) {
                this.updateStatus(`加载失败：${error.message}`, 'error');
                console.error('ROM 加载错误:', error);
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

            // 检测是否在全屏状态且获取页面尺寸
            if (document.fullscreenElement || document.webkitFullscreenElement ||
                document.mozFullScreenElement || document.msFullscreenElement) {
                // 全屏模式下，检测页面宽高比
                const pageWidth = window.innerWidth;
                const pageHeight = window.innerHeight;

                if (pageWidth > pageHeight * 2) {
                    // 宽度大于高度的 2 倍
                    const newHeight = containerWidth / 2.5;
                    canvas.style.height = newHeight + 'px';
                } else {
                    // 宽度小于等于高度的 2 倍
                    const newHeight = (containerWidth * 100) / 180;
                    canvas.style.height = newHeight + 'px';
                }
            } else {
                // 非全屏模式，使用原始公式
                const newHeight = (containerWidth * 100) / 180;
                canvas.style.height = newHeight + 'px';
            }
        }
    }

    toggleFullscreen() {
        const canvas = this.gameContainer.querySelector('canvas');
        if (!canvas) return;

        if (!document.fullscreenElement) {
            this.enterFullscreen(canvas);
        } else {
            this.exitFullscreen();
        }
    }

    async enterFullscreen(canvas) {
        try {
            this.originalContainerWidth = this.gameContainer.style.width;
            this.originalContainerHeight = this.gameContainer.style.height;

            this.gameContainer.style.position = 'fixed';
            this.gameContainer.style.top = '0';
            this.gameContainer.style.left = '0';
            this.gameContainer.style.width = '40vw';
            this.gameContainer.style.height = '40vh';
            this.gameContainer.style.zIndex = '9999';
            this.gameContainer.style.background = '#000';

            if (canvas) {
                canvas.style.width = '100%';
                canvas.style.height = '100%';
                canvas.style.imageRendering = 'pixelated';
            }

            if (this.gameContainer.requestFullscreen) {
                await this.gameContainer.requestFullscreen();
            } else if (this.gameContainer.webkitRequestFullscreen) {
                await this.gameContainer.webkitRequestFullscreen();
            } else if (this.gameContainer.mozRequestFullScreen) {
                await this.gameContainer.mozRequestFullScreen();
            } else if (this.gameContainer.msRequestFullscreen) {
                await this.gameContainer.msRequestFullscreen();
            }

            console.log('已进入全屏模式');
            this.updateStatus('全屏模式 - 按 ESC 退出', 'success');

        } catch (error) {
            console.error('进入全屏失败:', error);
            this.updateStatus(`全屏失败：${error.message}`, 'error');
        }
    }

    async exitFullscreen() {
        try {
            if (document.fullscreenElement) {
                if (document.exitFullscreen) {
                    await document.exitFullscreen();
                } else if (document.webkitExitFullscreen) {
                    await document.webkitExitFullscreen();
                } else if (document.mozCancelFullScreen) {
                    await document.mozCancelFullScreen();
                } else if (document.msExitFullscreen) {
                    await document.msExitFullscreen();
                }
            }

            this.gameContainer.style.position = '';
            this.gameContainer.style.top = '';
            this.gameContainer.style.left = '';
            this.gameContainer.style.width = this.originalContainerWidth || '';
            this.gameContainer.style.height = this.originalContainerHeight || '';
            this.gameContainer.style.zIndex = '';
            this.gameContainer.style.background = '';

            const canvas = this.gameContainer.querySelector('canvas');
            if (canvas) {
                canvas.style.width = '100%';
                canvas.style.height = '300px';
                canvas.style.maxHeight = '300px';
            }

            console.log('已退出全屏模式');
            this.updateStatus('已退出全屏模式', 'success');

            setTimeout(() => {
                this.resizeGame();
            }, 100);

        } catch (error) {
            console.error('退出全屏失败:', error);
        }
    }

    setupFullscreenListener() {
        document.addEventListener('fullscreenchange', () => {
            if (!document.fullscreenElement) {
                this.exitFullscreen();
            }
        });

        document.addEventListener('webkitfullscreenchange', () => {
            if (!document.webkitFullscreenElement) {
                this.exitFullscreen();
            }
        });

        document.addEventListener('mozfullscreenchange', () => {
            if (!document.fullscreenElement) {
                this.exitFullscreen();
            }
        });

        document.addEventListener('MSFullscreenChange', () => {
            if (!document.msFullscreenElement) {
                this.exitFullscreen();
            }
        });
    }
}

let emulatorInstance;

window.addEventListener('load', function() {
    setTimeout(() => {
        emulatorInstance = new FCSuperMarioEmulator();

        if (emulatorInstance.resizeGame) {
            emulatorInstance.resizeGame();
        }

        const enableAudioOnInteraction = () => {
            if (emulatorInstance) {
                emulatorInstance.resumeAudioContext();
            }
        };

        ['click', 'touchstart', 'keydown', 'mousedown', 'pointerdown', 'touchend'].forEach(eventType => {
            document.addEventListener(eventType, enableAudioOnInteraction, { once: true, passive: true });
        });
    }, 1000);
});

window.addEventListener('resize', function() {
    if (emulatorInstance && emulatorInstance.resizeGame) {
        emulatorInstance.resizeGame();
    }
});

window.addEventListener('beforeunload', function() {
    if (emulatorInstance) {
        emulatorInstance.pause();
    }
});

function startGame() {
    if (emulatorInstance) emulatorInstance.start();
}

function pauseGame() {
    if (emulatorInstance) emulatorInstance.pause();
}

function resetGame() {
    if (emulatorInstance) emulatorInstance.reset();
}

async function autoLoadLocalGame() {
    console.log('autoLoadLocalGame 已弃用，使用新的初始化方式');
}


