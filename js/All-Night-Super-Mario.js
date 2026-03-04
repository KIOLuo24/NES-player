class NesEmulatorTetris{
    constructor(){
        [this.canvas,this.ctx]=[document.getElementById('nesCanvas'),document.getElementById('nesCanvas').getContext('2d')];
        [this.imageData,this.frameBuffer]=[this.ctx.createImageData(256,240),new Uint8Array(256*240*4)];
        [this.isRunning,this.animationId,this.lastFrameTime]=[false,null,0];
        [this.targetFPS,this.frameTime]=[60,1000/60];
        [this.audioContext,this.audioBuffer,this.audioSampleRate]=[null,[],44100];
        this.setupAudio();
        this.setupControls();
    }
    setupAudio(){
        try{
            this.audioContext=new(window.AudioContext||window.webkitAudioContext)();
            this.audioContext.resume();
        }catch(e){
            console.warn('音频上下文初始化失败:',e);
        }
    }
    setupControls(){
        // 修复：正确绑定键盘事件
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
        document.getElementById('romInput').addEventListener('change', (e) => this.loadROM(e));
    }
    handleKeyDown(event){
        if(!this.nes||!this.isRunning)return;
        const key=this.getKeyMapping(event.code);
        if(key){
            event.preventDefault();
            this.nes.buttonDown(1,key);
        }
    }
    handleKeyUp(event){
        if(!this.nes||!this.isRunning)return;
        const key=this.getKeyMapping(event.code);
        if(key){
            event.preventDefault();
            this.nes.buttonUp(1,key);
        }
    }
    getKeyMapping(keyCode){
        return{
            'ArrowUp':jsnes.Controller.BUTTON_UP,
            'ArrowDown':jsnes.Controller.BUTTON_DOWN,
            'ArrowLeft':jsnes.Controller.BUTTON_LEFT,
            'ArrowRight':jsnes.Controller.BUTTON_RIGHT,
            'KeyX':jsnes.Controller.BUTTON_A,
            'KeyZ':jsnes.Controller.BUTTON_B,
            'Enter':jsnes.Controller.BUTTON_START,
            'ShiftLeft':jsnes.Controller.BUTTON_SELECT,
            'ShiftRight':jsnes.Controller.BUTTON_SELECT
        }[keyCode];
    }
    async loadROM(event){
        const file=event.target.files[0];
        if(!file)return;
        this.updateStatus(`正在加载: ${file.name}...`, 'loading');
        const reader=new FileReader();
        reader.onload=(e)=>{
            try{
                this.initEmulator();
                this.nes.loadROM(e.target.result);
                this.updateStatus(`游戏加载成功: ${file.name}`, 'success');
                this.enableControls();
            }catch(error){
                this.updateStatus(`游戏加载失败: ${error.message}`, 'error');
                console.error('ROM加载错误:', error);
            }
        };
        reader.onerror=()=>this.updateStatus('文件读取失败', 'error');
        reader.readAsBinaryString(file);
    }
    initEmulator(){
        this.nes=new jsnes.NES({
            onFrame:(frameBuffer)=>this.onFrame(frameBuffer),
            onAudioSample:(left,right)=>this.onAudioSample(left,right),
            sampleRate:this.audioSampleRate
        });
    }
    onFrame(frameBuffer){
        for(let i=0;i<frameBuffer.length;i++){
            const pixel=frameBuffer[i];
            this.frameBuffer.set([pixel&0xFF,(pixel>>8)&0xFF,(pixel>>16)&0xFF,0xFF],i*4);
        }
    }
    onAudioSample(left,right){
        if(this.audioContext)this.audioBuffer.push(left,right);
    }
    start(){
        if(!this.nes){
            this.updateStatus('请先加载游戏ROM', 'error');
            return;
        }
        this.isRunning=true;
        this.gameLoop();
        this.updateStatus('游戏运行中...', 'success');
        this.toggleButtons(true);
    }
    pause(){
        this.isRunning=false;
        if(this.animationId)cancelAnimationFrame(this.animationId);
        this.updateStatus('游戏已暂停', 'loading');
        this.toggleButtons(false);
    }
    reset(){
        if(this.nes){
            this.nes.reset();
            this.updateStatus('游戏已重置', 'success');
        }
    }
    gameLoop(currentTime=0){
        if(!this.isRunning)return;
        const deltaTime=currentTime-this.lastFrameTime;
        if(deltaTime>=this.frameTime){
            this.nes.frame();
            this.imageData.data.set(this.frameBuffer);
            this.ctx.putImageData(this.imageData,0,0);
            this.playAudio();
            this.lastFrameTime=currentTime;
        }
        this.animationId=requestAnimationFrame((time)=>this.gameLoop(time));
    }
    playAudio(){
        if(!this.audioContext||this.audioBuffer.length<4096)return;
        const bufferSize=4096;
        const buffer=this.audioContext.createBuffer(2,bufferSize/2,this.audioSampleRate);
        const[leftChannel,rightChannel]=[buffer.getChannelData(0),buffer.getChannelData(1)];
        for(let i=0;i<bufferSize/2;i++){
            leftChannel[i]=this.audioBuffer[i*2];
            rightChannel[i]=this.audioBuffer[i*2+1];
        }
        const source=this.audioContext.createBufferSource();
        source.buffer=buffer;
        source.connect(this.audioContext.destination);
        source.start();
        this.audioBuffer=this.audioBuffer.slice(bufferSize);
    }
    updateStatus(message,type='normal'){
        Object.assign(document.getElementById('status'),{textContent:message,className:type});
    }
    enableControls(){
        document.getElementById('startButton').disabled=false;
        document.getElementById('resetButton').disabled=false;
    }
    toggleButtons(isRunning){
        const[startBtn,pauseBtn]=[document.getElementById('startButton'),document.getElementById('pauseButton')];
        [startBtn.disabled,pauseBtn.disabled]=[isRunning,!isRunning];
    }
}
const emulator=new NesEmulatorTetris();
const[startGame,pauseGame,resetGame]=[()=>emulator.start(),()=>emulator.pause(),()=>emulator.reset()];
function resizeGame(){
    const[canvas,container]=[document.getElementById('nesCanvas'),document.getElementById('gameContainer')];
    canvas.style.height=`${(container.clientWidth*240)/256}px`;
}
async function autoLoadLocalGame(){
    try{
        emulator.updateStatus('loading tetris...', 'loading');
        const response=await fetch('game/nes/super marioNES/All Night Nippon Super Mario Bros [p1].nes');
        if(response.ok){
            const arrayBuffer=await response.arrayBuffer();
            const binaryString=Array.from(new Uint8Array(arrayBuffer),b=>String.fromCharCode(b)).join('');
            emulator.initEmulator();
            emulator.nes.loadROM(binaryString);
            emulator.updateStatus('本地游戏加载成功！点击"开始游戏"开始游玩', 'success');
            emulator.enableControls();
            setTimeout(()=>emulator.start(),1000);
        }else{
            throw new Error('无法访问本地文件');
        }
    }catch(error){
        console.error('自动加载失败:',error);
        emulator.updateStatus('自动加载失败，请手动选择ROM文件', 'error');
    }
}
