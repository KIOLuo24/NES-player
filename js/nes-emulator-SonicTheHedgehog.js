class NesEmulatorTetris {
    constructor() {
        this.nes = null;
        this.canvas = document.getElementById('nesCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.imageData = this.ctx.createImageData(256, 240);
        this.frameBuffer = new Uint8Array(256 * 240 * 4);

        this.isRunning = false;
        this.animationId = null;
        this.lastFrameTime = 0;
        this.targetFPS = 60;
        this.frameTime = 1000 / this.targetFPS;

        this.audioContext = null;
        this.audioBuffer = [];
        this.audioSampleRate = 44100;

        this.setupAudio();
        this.setupControls();
    }

    setupAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.audioContext.resume();
        } catch (e) {
            console.warn('音频上下文初始化失败:', e);
        }
    }

    setupControls() {
        // 键盘控制
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));

        // ROM加载
        document.getElementById('romInput').addEventListener('change', (e) => this.loadROM(e));
    }

    handleKeyDown(event) {
        if (!this.nes || !this.isRunning) return;

        const key = this.getKeyMapping(event.code);
        if (key) {
            event.preventDefault();
            this.nes.buttonDown(1, key);
        }
    }

    handleKeyUp(event) {
        if (!this.nes || !this.isRunning) return;

        const key = this.getKeyMapping(event.code);
        if (key) {
            event.preventDefault();
            this.nes.buttonUp(1, key);
        }
    }

    getKeyMapping(keyCode) {
        const mapping = {
            'ArrowUp': jsnes.Controller.BUTTON_UP,
            'ArrowDown': jsnes.Controller.BUTTON_DOWN,
            'ArrowLeft': jsnes.Controller.BUTTON_LEFT,
            'ArrowRight': jsnes.Controller.BUTTON_RIGHT,
            'KeyX': jsnes.Controller.BUTTON_A,
            'KeyZ': jsnes.Controller.BUTTON_B,
            'Enter': jsnes.Controller.BUTTON_START,
            'ShiftLeft': jsnes.Controller.BUTTON_SELECT,
            'ShiftRight': jsnes.Controller.BUTTON_SELECT
        };
        return mapping[keyCode];
    }

    loadROM(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.updateStatus(`正在加载: ${file.name}...`, 'loading');

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                this.initEmulator();
                this.nes.loadROM(e.target.result);
                this.updateStatus(`游戏加载成功: ${file.name}`, 'success');
                this.enableControls();
            } catch (error) {
                this.updateStatus(`游戏加载失败: ${error.message}`, 'error');
                console.error('ROM加载错误:', error);
            }
        };
        reader.onerror = () => {
            this.updateStatus('文件读取失败', 'error');
        };
        reader.readAsBinaryString(file);
    }

    initEmulator() {
        this.nes = new jsnes.NES({
            onFrame: (frameBuffer) => this.onFrame(frameBuffer),
            onAudioSample: (left, right) => this.onAudioSample(left, right),
            sampleRate: this.audioSampleRate
        });
    }

    onFrame(frameBuffer) {
        // 将帧缓冲区转换为Canvas图像数据
        for (let i = 0; i < frameBuffer.length; i++) {
            const pixel = frameBuffer[i];
            this.frameBuffer[i * 4] = pixel & 0xFF;         // R
            this.frameBuffer[i * 4 + 1] = (pixel >> 8) & 0xFF;  // G
            this.frameBuffer[i * 4 + 2] = (pixel >> 16) & 0xFF; // B
            this.frameBuffer[i * 4 + 3] = 0xFF;             // A
        }
    }

    onAudioSample(left, right) {
        if (this.audioContext) {
            this.audioBuffer.push(left, right);
        }
    }

    start() {
        if (!this.nes) {
            this.updateStatus('请先加载游戏ROM', 'error');
            return;
        }

        this.isRunning = true;
        this.gameLoop();
        this.updateStatus('游戏运行中...', 'success');

        // 更新按钮状态
        document.getElementById('startButton').disabled = true;
        document.getElementById('pauseButton').disabled = false;
    }

    pause() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        this.updateStatus('游戏已暂停', 'loading');

        // 更新按钮状态
        document.getElementById('startButton').disabled = false;
        document.getElementById('pauseButton').disabled = true;
    }

    reset() {
        if (this.nes) {
            this.nes.reset();
            this.updateStatus('游戏已重置', 'success');
        }
    }

    gameLoop(currentTime = 0) {
        if (!this.isRunning) return;

        const deltaTime = currentTime - this.lastFrameTime;

        if (deltaTime >= this.frameTime) {
            // 运行一个NES帧
            this.nes.frame();

            // 渲染到Canvas
            this.imageData.data.set(this.frameBuffer);
            this.ctx.putImageData(this.imageData, 0, 0);

            // 播放音频
            this.playAudio();

            this.lastFrameTime = currentTime;
        }

        this.animationId = requestAnimationFrame((time) => this.gameLoop(time));
    }

    playAudio() {
        if (!this.audioContext || this.audioBuffer.length === 0) return;

        const bufferSize = 4096;
        if (this.audioBuffer.length >= bufferSize) {
            const buffer = this.audioContext.createBuffer(2, bufferSize / 2, this.audioSampleRate);
            const leftChannel = buffer.getChannelData(0);
            const rightChannel = buffer.getChannelData(1);

            for (let i = 0; i < bufferSize / 2; i++) {
                leftChannel[i] = this.audioBuffer[i * 2];
                rightChannel[i] = this.audioBuffer[i * 2 + 1];
            }

            const source = this.audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(this.audioContext.destination);
            source.start();

            // 清空已播放的音频数据
            this.audioBuffer = this.audioBuffer.slice(bufferSize);
        }
    }

    updateStatus(message, type = 'normal') {
        const statusElement = document.getElementById('status');
        statusElement.textContent = message;
        statusElement.className = type;
    }

    enableControls() {
        document.getElementById('startButton').disabled = false;
        document.getElementById('resetButton').disabled = false;
    }
}

// 全局模拟器实例
let emulator = new NesEmulatorTetris();

// 控制函数
function startGame() {
    emulator.start();
}

function pauseGame() {
    emulator.pause();
}

// 添加窗口大小调整函数
function resizeGame() {
    const canvas = document.getElementById('nesCanvas');
    const container = document.getElementById('gameContainer');

    // 获取容器宽度并计算对应的高度(NES比例是256:240)
    const containerWidth = container.clientWidth;
    const newHeight = (containerWidth * 240) / 256;

    canvas.style.height = newHeight + 'px';
}

// 在页面加载完成后初始化尺寸
window.addEventListener('load', function() {
    resizeGame();
    autoLoadLocalGame();
});

// 监听窗口大小变化事件
window.addEventListener('resize', resizeGame);


function resetGame() {
    emulator.reset();
}

// 自动加载本地游戏
async function autoLoadLocalGame() {
    try {
        emulator.updateStatus('Loading Sonic The Hedgehog...', 'loading');

        // 尝试直接加载本地文件
        const romPath = 'game/nes/SonicTheHedgehog/Sonic_The_Hedgehog.nes';

        // 使用fetch尝试加载本地文件
        const response = await fetch(romPath);

        if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            const binaryString = arrayBufferToBinaryString(arrayBuffer);

            emulator.initEmulator();
            emulator.nes.loadROM(binaryString);
            emulator.updateStatus('本地游戏加载成功！点击"开始游戏"开始游玩', 'success');
            emulator.enableControls();

            // 自动开始游戏
            setTimeout(() => {
                emulator.start();
            }, 1000);

        } else {
            throw new Error('无法访问本地文件');
        }

    } catch (error) {
        console.error('自动加载失败:', error);
        emulator.updateStatus('自动加载失败，请手动选择ROM文件', 'error');
    }
}

// 辅助函数：将ArrayBuffer转换为二进制字符串
function arrayBufferToBinaryString(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return binary;
}

// 防止页面卸载时的清理
window.addEventListener('beforeunload', () => {
    if (emulator) {
        emulator.pause();
    }
});
