/**
 * 读心术解密 - 核心业务逻辑
 * 通过 ES6 Class 将状态、UI交互、音频和语音播放模块化，降低耦合度。
 */

// --- 核心配置与数据字典 ---
const LION_NUMS = new Set([9, 18, 27, 36, 45, 54, 63, 72, 81, 90, 99]);
const RANDOM_EMOJIS = ["🐹", "🍎", "🍊", "⭐", "🐶", "🌸", "🐮", "🔥", "🌈", "✨", "💡", "🦁"];
const PENCIL_AUDIOS = ['audio/铅笔画圈-快.mp3', 'audio/铅笔纸上画圈声_4.mp3', 'audio/铅笔纸上画圈声_5.mp3'];

// ---------------------------------------------------------
// ⬇️ 在这里集中修改各种动画的停顿等待时间 (单位：毫秒 ms) ⬇️
// ---------------------------------------------------------
const ANIM_TIMING = {
    // 2. 多行模式气泡 (新UI)
    multiGuideStep1Show: 500,     // 引导模式: 第一步出现的延迟
    multiGuideWaitFly: 700,       // 引导模式: 等待气泡飞往右侧前的延迟
    multiNormalArrow1Wait: 150,   // 普通模式: 箭头1出现前延迟
    multiNormalStep1Wait: 100,    // 普通模式: 算式1出现前延迟
    multiNormalStep1Pause: 400,   // 普通模式: 算式1停留时间
    multiNormalStep2Pause: 500,   // 普通模式: 算式2停留时间
    multiNormalArrow2Wait: 100,   // 普通模式: 箭头2出现前延迟
    multiNormalWaitFly: 550,      // 普通模式: 等待气泡飞往右侧前的延迟

    // 3. 右侧大数字矩阵动效时间
    matrixFocusDelay: 300,        // 第3次点亮时，触发3个数字提示前的延迟
    matrixSettleBreathing: 1000,  // (普通模式下) 触发聚光灯特效之前的等待时间
    matrixFocusBreathing: 900,   // (普通模式下) 聚光灯特效结束后的沉淀时间
    matrixNormalSettle: 800,     // (普通模式下) 无特效时，简单的等待沉淀时间

    // 4. 其他极短延迟 (用于UI渲染缓冲，不建议修改)
    miscWaitShort: 10,
};


const STAGE_TEXTS = {
    // --- 流程和引导模式语音提示 ---
    startGuide: "一起来找找这个读心术背后的规律吧，先输一个10到19的数试一下。",
    calcStep1: "根据规则，先减去它个位上的数字",
    calcStep2: "然后再减去十位上的数字",
    calcStep3: "这就是运算后的结果啦",
    firstLight: "读心术的奥秘就藏在点亮的数字里，你可以多输入一些两位数，找找它们的数学规律。",
    secondLight: "多输入一些数字，找找它们的数学规律。",
    thirdLight: "多输入一些数字，找找它们的数学规律。",
    fourthLight: "如果发现了这些数字的规律，你可以点下面的按钮。",
    fifthLight: "仔细观察一下这些数字哦~",
    sixthLight: "这些数好像都是某个数字的倍数",
    seventhLight: "通过9好像可以算出这些数",
    eighthLight: "这些数都是 9 的倍数，赶紧去把这个发现告诉老师吧！",
    ninthLight: "这些数都是 9 的倍数，恭喜你发现了读心术的奥秘！",
    successSecret: "恭喜你成功破解了读心术的奥秘！",

    // --- 错误或特殊状态提示 ---
    sameResultRandom: "这个结果和上次的一样，重新试试。",
    sameResultHint: (targetTen) => `这个结果和上次的一样，试试输入${targetTen}0几的数。`,
    sameResult: "这个结果和上次的一样，换个十位数再试试看",

    alreadyLightRandom: "这个结果已经被点亮过了，重新试试。",
    alreadyLightHint: (targetTen) => `这个结果已经被点亮过了，试试输入${targetTen}0几的数。`,
    alreadyLight: "这个结果已经被点亮过了，换一个开头不一样的两位数",

    invalidTen: "十位不能是0，请输入1到9。",
    invalidRange: "请输入10到99之间的两位整数。",
    invalidFirst: "先输入一个10到19之间的两位数。",
    subsequent: "你已经找到规律了！点击下方按钮继续。",

    // --- 占位符/输入框提示语 (guideInputForNextTry) ---
    inputGuideDefault: "再试试20到99之间的数",
    inputGuideFirst: "写下一个10到19之间的两位数",
    inputGuideRange: "请输入10到99的两位整数",
    inputGuideFirstRetry: "输入10到19之间的数",
    inputGuideSameTen: "换个十位数不同的两位数算算",
    inputGuideAlreadyLit: "再选一个不同的两位数试试"
};

// --- 工具函数 ---
const Utils = {
    wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
    getCellCenter: (el) => {
        const rect = el.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
};

// --- 音频管理器 ---
class AudioManager {
    constructor() {
        this.bgm = document.getElementById('bgm');
        this.voiceAudio = document.getElementById('voiceAudio');
        this.effectAudio = document.getElementById('effectAudio');
        if (this.bgm) this.bgm.volume = 0.3;
    }

    async playBgm() {
        try { if (this.bgm) await this.bgm.play(); } catch (e) { console.log('BGM Play failed:', e); }
    }

    switchBgm(path) {
        if (!this.bgm) return;
        this.bgm.src = path;
        this.bgm.play().catch(e => console.log('BGM Switch failed:', e));
    }

    stopVoice() {
        if (this.voiceAudio) {
            this.voiceAudio.pause();
            this.voiceAudio.currentTime = 0;
        }
    }

    playVoice(path) {
        if (!this.voiceAudio) return;
        this.voiceAudio.src = path;
        this.voiceAudio.volume = 0.95;
        this.voiceAudio.play().catch(e => console.log('Voice Play failed:', e));
    }

    playEffect(path) {
        if (!this.effectAudio) return;
        this.effectAudio.src = path;
        this.effectAudio.volume = 0.8;
        this.effectAudio.play().catch(e => console.log('Effect Play failed:', e));
    }

    playRandomPencil() {
        const path = PENCIL_AUDIOS[Math.floor(Math.random() * PENCIL_AUDIOS.length)];
        this.playEffect(path);
    }
}

class TTSManager {
    constructor() {
        this.currentUtterance = null;
        this.currentAudio = null;
        this._resumeTimer = null; // Chrome speechSynthesis pause bug workaround timer

        // ==========================================
        // 在这里填入你的 Fish Audio 配置：
        // ==========================================
        this.fishApiKey = '917e2aebbde647e4acb001139343812c';
        this.fishReferenceId = '25b0f52b8b254fb0a57133bc7230825b';
        this.fishModel = 's2.1-pro-free';

        if ('speechSynthesis' in window) {
            window.speechSynthesis.getVoices();
            window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
        }
    }

    async speak(text, callback) {
        this.stop();
        const cleanText = text.replace(/<[^>]*>/g, '');

        // 查找 STAGE_TEXTS 中对应的 key 以播放对应的本地 MP3
        let audioKey = null;
        for (const [key, value] of Object.entries(STAGE_TEXTS)) {
            if (typeof value === 'string' && value === text) {
                audioKey = key;
                break;
            }
        }

        if (audioKey) {
            const url = `audio/${audioKey}.mp3`;
            this.currentAudio = new Audio(url);

            if (callback) {
                this.currentAudio.addEventListener('ended', callback);
                this.currentAudio.addEventListener('error', () => {
                    console.warn(`Local audio failed or not found for key: ${audioKey}, falling back to Web API`);
                    this.speakWeb(cleanText, callback);
                });
            } else {
                this.currentAudio.addEventListener('error', () => {
                    console.warn(`Local audio failed or not found for key: ${audioKey}, falling back to Web API`);
                    this.speakWeb(cleanText);
                });
            }

            try {
                await this.currentAudio.play();
                return; // 如果播放成功，直接返回，不再执行后续降级
            } catch (e) {
                console.warn('Local MP3 play failed, falling back:', e);
            }
        }

        /* 
        // --- Fish Audio 接口调用已注释 ---
        if (this.fishApiKey && this.fishReferenceId) {
            try {
                // 因为 Fish Audio 官方接口在浏览器端会有严重的跨域（CORS）拦截
                // 这里我们指向一个本地的轻量级代理服务，通过它来转发请求
                const apiUrl = 'https://fish-audio-proxy.dlttog.workers.dev/';
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.fishApiKey}`,
                        'Content-Type': 'application/json',
                        'model': 's2.1-pro-free'
                    },
                    body: JSON.stringify({
                        text: cleanText,
                        reference_id: this.fishReferenceId,
                        format: 'mp3'
                    })
                });

                if (response.ok) {
                    const blob = await response.blob();
                    const url = URL.createObjectURL(blob);
                    this.currentAudio = new Audio(url);
                    if (callback) {
                        this.currentAudio.addEventListener('ended', callback);
                        this.currentAudio.addEventListener('error', callback);
                    }
                    this.currentAudio.play().catch(e => {
                        console.error('Fish Audio play failed:', e);
                        if (callback) callback();
                    });
                    return;
                } else {
                    console.warn('Fish Audio API returned status:', response.status);
                }
            } catch (error) {
                console.error('Fish Audio Request failed:', error);
            }
        }
        */

        // 降级使用浏览器自带的 Web Speech API
        this.speakWeb(cleanText, callback);
    }

    speakWeb(cleanText, callback) {
        if (!('speechSynthesis' in window)) {
            console.log('Web Speech Synthesis is not supported.');
            if (callback) callback();
            return;
        }

        const utterance = new SpeechSynthesisUtterance(cleanText);
        this.currentUtterance = utterance;

        const voices = window.speechSynthesis.getVoices();
        let selectedVoice = null;
        const priorityNames = ['xiaoxiao', 'yaoyao', 'tingting', 'huihui', 'kangkang', 'chinese', 'zh-cn', 'zh-tw'];
        for (const name of priorityNames) {
            selectedVoice = voices.find(v => v.lang.toLowerCase().startsWith('zh') && v.name.toLowerCase().includes(name));
            if (selectedVoice) break;
        }
        if (!selectedVoice) selectedVoice = voices.find(v => v.lang.toLowerCase().startsWith('zh'));

        if (selectedVoice) utterance.voice = selectedVoice;
        utterance.rate = 1.05;

        // Chrome bug 修复：输入框 focus 等操作会导致 speechSynthesis 被系统暂停
        // 通过定时轮询检测到暂停时立即 resume
        clearInterval(this._resumeTimer);
        this._resumeTimer = setInterval(() => {
            if (!window.speechSynthesis.speaking) { clearInterval(this._resumeTimer); return; }
            if (window.speechSynthesis.paused) window.speechSynthesis.resume();
        }, 200);

        const cleanup = () => clearInterval(this._resumeTimer);

        if (callback) {
            utterance.onend = () => { cleanup(); if (this.currentUtterance === utterance) callback(); };
            utterance.onerror = () => { cleanup(); if (this.currentUtterance === utterance) callback(); };
        } else {
            utterance.onend = cleanup;
            utterance.onerror = cleanup;
        }
        window.speechSynthesis.speak(utterance);
    }

    stop() {
        clearInterval(this._resumeTimer);
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.currentAudio = null;
        }
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    }

    // 返回 Promise，在语音播放完成后 resolve（供需要等待语音结束的场景使用）
    speakAndWait(text) {
        return new Promise(resolve => {
            this.speak(text, resolve);
        });
    }
}

// --- 核心逻辑游戏管理器 ---
class GameManager {
    constructor() {
        this.lightRecord = [];
        this.usedNumbers = new Set();
        this.lastTenDigit = null;
        this.lastResult = null;
        this.hasStarted = false;
        this.lastRandomWasDuplicate = false;

        this.currentMagicPattern = '';
        this.nonMagicPatterns = [];
        this.history = [];
    }

    initPatterns() {
        this.currentMagicPattern = "🦁";
        this.nonMagicPatterns = RANDOM_EMOJIS.filter(e => e !== "🦁");
    }

    getRandomPatternImage() {
        return this.nonMagicPatterns[Math.floor(Math.random() * this.nonMagicPatterns.length)];
    }

    resetState() {
        this.lightRecord = [];
        this.lastTenDigit = null;
        this.lastResult = null;
        this.history = [];
        this.lastRandomWasDuplicate = false;
    }

    recordLight(res, tenDigit) {
        if (!this.lightRecord.includes(res)) {
            this.lightRecord.push(res);
        }
        this.lastResult = res;
        this.lastTenDigit = tenDigit;
    }
}

// --- UI / DOM交互管理器 ---
class UIManager {
    constructor(audio, tts, game) {
        this.audio = audio;
        this.tts = tts;
        this.game = game;

        this.els = {
            app: document.getElementById('app'),
            board: document.getElementById('board'),
            boardWrap: document.querySelector('.boardWrap'),
            appShell: document.getElementById('appShell'),
            startScreen: document.getElementById('startScreen'),
            startBtn: document.getElementById('startBtn'),
            secretBtn: document.getElementById('secretBtn'),
            normalTip: document.getElementById('normalTip'),
            inputTen: document.getElementById('inputTen'),
            inputGe: document.getElementById('inputGe'),
            cellTen: document.getElementById('cellTen'),
            cellGe: document.getElementById('cellGe'),
            inputFixed: document.querySelector('.inputFixed'),
            calcRecordList: document.getElementById('calcRecordList'),
            litNumbersList: document.getElementById('litNumbersList'),
            numpad: document.getElementById('numpad'),
            numpadClear: document.getElementById('numpadClear'),
            numpadDel2: document.getElementById('numpadDel2'),
            randomBtn: document.getElementById('randomBtn'),
            focusOverlay: document.getElementById('focusOverlay'),
            focusFlyLayer: document.getElementById('focusFlyLayer'),
            continueExploreBtn: document.getElementById('continueExploreBtn'),
            replayModal: document.getElementById('replayModal'),
            replayBtn: document.getElementById('replayBtn')
        };

        this.numDomList = [];
        this.isResultAnimating = false;
        this.isFocusAnimating = false;
        this.hasPlayedThreeNumsFocus = false;
        this.secretBtnTimer = null;
        this.secretBtnRevealed = false;
        this.circleTimer = null;
        this.isFirstTimeGuide = true;
        this.persistentTip = false; // 第4步提示文字保持到第3个结果点亮

        this.initResize();
        this.bindEvents();
    }

    initResize() {
        const resizeApp = () => {
            const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
            if (this.els.app) this.els.app.style.transform = `translate(-50%, -50%) scale(${scale})`;
        };
        window.addEventListener('resize', resizeApp);
        resizeApp();
    }

    buildBoard() {
        if (!this.els.board) return;
        this.els.board.innerHTML = '';
        this.numDomList = [];
        for (let i = 1; i <= 99; i++) {
            const d = document.createElement('div');
            d.className = 'num';
            const patternImage = LION_NUMS.has(i) ? this.game.currentMagicPattern : this.game.getRandomPatternImage();
            const displayNum = i < 10 ? '0' + i : i;
            d.innerHTML = `${displayNum}<span>${patternImage}</span>`;
            d.dataset.val = i;
            this.els.board.appendChild(d);
            this.numDomList.push(d);
        }
    }

    resetBoardUI() {
        if (this.els.calcRecordList) this.els.calcRecordList.innerHTML = '';
        if (this.els.litNumbersList) this.els.litNumbersList.innerHTML = '';
        this.els.boardWrap.classList.remove('show-bubbles');
    }

    showTip(t, playVoice = true) {
        if (!t) return;
        if (this.uninterruptibleVoice) {
            playVoice = false;
        } else {
            this.audio.stopVoice();
        }
        this.els.normalTip.classList.remove('show');
        void this.els.normalTip.offsetWidth;

        const showTextToggle = document.getElementById('showGuideTextToggle');
        const enableVoiceToggle = document.getElementById('enableGuideVoiceToggle');

        if (!showTextToggle || showTextToggle.checked) {
            let htmlText = t.replace(/(\d+到\d+|\d+几|\d+)/g, '<span class="highlight-num">$1</span>').replace(/\n/g, '<br>');
            this.els.normalTip.innerHTML = htmlText;
            this.els.normalTip.classList.add('show');
        }

        if (playVoice && (!enableVoiceToggle || enableVoiceToggle.checked)) {
            this.tts.speak(t);
        }
    }

    hideTip() {
        this.els.normalTip.classList.remove('show');
        if (!this.uninterruptibleVoice) {
            this.tts.stop();
        }
    }

    // 显示提示文字并等待语音播放完毕后 resolve
    async showTipAndWait(t) {
        if (!t) return;
        if (!this.uninterruptibleVoice) {
            this.audio.stopVoice();
        }
        this.els.normalTip.classList.remove('show');
        void this.els.normalTip.offsetWidth;

        const showTextToggle = document.getElementById('showGuideTextToggle');
        const enableVoiceToggle = document.getElementById('enableGuideVoiceToggle');

        if (!showTextToggle || showTextToggle.checked) {
            let htmlText = t.replace(/(\d+到\d+|\d+几|\d+)/g, '<span class="highlight-num">$1</span>').replace(/\n/g, '<br>');
            this.els.normalTip.innerHTML = htmlText;
            this.els.normalTip.classList.add('show');
        }

        if (!enableVoiceToggle || enableVoiceToggle.checked) {
            await this.tts.speakAndWait(t);
        }
    }

    getNextTenHint(curTen) {
        const usedTens = new Set(this.game.lightRecord.map(r => r / 9));
        for (let t = 1; t <= 9; t++) {
            if (t !== curTen && !usedTens.has(t)) {
                return t;
            }
        }
        return null;
    }

    clearDigitInputs() {
        this.els.inputTen.value = '';
        this.els.inputGe.value = '';
    }

    setInputDisabled(disabled) {
        this.els.inputTen.disabled = disabled;
        this.els.inputGe.disabled = disabled;
    }

    guideInputForNextTry(message = STAGE_TEXTS.inputGuideDefault) {
        if (this.isFocusAnimating) return;
        this.setInputDisabled(false);
        this.clearDigitInputs();

        if (this.game.lightRecord.length === 0) {
            this.els.inputTen.readOnly = false;
            this.els.cellTen.classList.remove('locked');
            this.els.inputTen.focus();
            if (this.els.randomBtn) this.els.randomBtn.style.display = 'flex';
        } else {
            this.els.inputTen.readOnly = false;
            this.els.cellTen.classList.remove('locked');
            this.els.inputTen.focus();
            if (this.els.randomBtn) this.els.randomBtn.style.display = 'flex';
        }

        // this.els.inputFixed.dataset.guide = message;
        this.els.inputFixed.classList.remove('guide-input');
        void this.els.inputFixed.offsetWidth;
        // this.els.inputFixed.classList.add('guide-input');
    }

    hideInputGuide() {
        this.els.inputFixed.classList.remove('guide-input');
        delete this.els.inputFixed.dataset.guide;
    }

    clearCalc() {
        // Obsolete in new UI
    }

    prepareNextRecordBlock() {
        // Disabled
    }

    async updateCalcAnimated(num, ge, shi, res) {
        const c1 = num - ge;
        const c2 = c1 - shi;

        const list = this.els.calcRecordList;
        if (!list) return;

        const existingBlocks = list.querySelectorAll('.record-block, .record-block-multi');
        existingBlocks.forEach(block => block.classList.add('dimmed-record'));

        await Utils.wait(this.isFirstTimeGuide ? 300 : ANIM_TIMING.miscWaitShort);

        const block = document.createElement('div');
        block.className = 'record-block-multi';
        block.innerHTML = `
            <div class="multi-box multi-box-left">${num}</div>
            <div class="multi-arrow multi-arrow-1">→</div>
            <div class="multi-box multi-box-middle">
                <div class="step-line step-1">① ${num} - ${ge} = ${c1}</div>
                <div class="step-line step-2">② ${c1} - ${shi} = <span class="text-red">${c2}</span></div>
            </div>
            <div class="multi-arrow multi-arrow-2">→</div>
            <div class="multi-box multi-box-right current-result-num">${c2}</div>
        `;

        list.prepend(block);

        const allCurrent = list.querySelectorAll('.current-result-num');
        allCurrent.forEach((el, index) => {
            if (index > 0) el.classList.remove('current-result-num');
        });

        const area = list.parentElement;
        area.scrollTo({ top: 0, behavior: 'smooth' });

        const leftBox = block.querySelector('.multi-box-left');
        const arrow1 = block.querySelector('.multi-arrow-1');
        const middleBox = block.querySelector('.multi-box-middle');
        const step1 = block.querySelector('.step-1');
        const step2 = block.querySelector('.step-2');
        const arrow2 = block.querySelector('.multi-arrow-2');
        const rightBox = block.querySelector('.multi-box-right');

        if (this.isFirstTimeGuide) {
            this.guideStep = 2;
            this.clearGuideHighlights();
            block.classList.add('guide-highlight', 'no-bg');
        }

        if (!this.isRandomAction) {
            const fromTen = Utils.getCellCenter(this.els.cellTen);
            const fromGe = Utils.getCellCenter(this.els.cellGe);
            const toLeftBox = Utils.getCellCenter(leftBox);

            const flyTen = document.createElement('div');
            flyTen.className = 'fly-num-text';
            flyTen.textContent = shi;
            flyTen.style.left = `${fromTen.x}px`;
            flyTen.style.top = `${fromTen.y}px`;
            document.body.appendChild(flyTen);

            const flyGe = document.createElement('div');
            flyGe.className = 'fly-num-text';
            flyGe.textContent = ge;
            flyGe.style.left = `${fromGe.x}px`;
            flyGe.style.top = `${fromGe.y}px`;
            document.body.appendChild(flyGe);

            // this.audio.playRandomPencil();

            const animDuration = 600;
            const targetOffsetX = 10;

            const deltaTenX = (toLeftBox.x - targetOffsetX) - fromTen.x;
            const deltaTenY = toLeftBox.y - fromTen.y;

            const deltaGeX = (toLeftBox.x + targetOffsetX) - fromGe.x;
            const deltaGeY = toLeftBox.y - fromGe.y;

            const animTen = flyTen.animate(
                [
                    { transform: 'translate(-50%, -50%) scale(1)', color: 'var(--text-blue)' },
                    { transform: `translate(calc(-50% + ${deltaTenX}px), calc(-50% + ${deltaTenY}px)) scale(0.533)`, color: '#1e293b' }
                ],
                { duration: animDuration, easing: 'cubic-bezier(0.22, 0.75, 0.25, 1)', fill: 'forwards' }
            );
            const animGe = flyGe.animate(
                [
                    { transform: 'translate(-50%, -50%) scale(1)', color: 'var(--text-blue)' },
                    { transform: `translate(calc(-50% + ${deltaGeX}px), calc(-50% + ${deltaGeY}px)) scale(0.533)`, color: '#1e293b' }
                ],
                { duration: animDuration, easing: 'cubic-bezier(0.22, 0.75, 0.25, 1)', fill: 'forwards' }
            );

            try { await Promise.all([animTen.finished, animGe.finished]); } catch (e) { }

            flyTen.remove();
            flyGe.remove();
        }

        leftBox.classList.add('show');
        //引导模式的核心执行流程：
        if (this.isFirstTimeGuide) {
            // 1. 等待配置的 multiGuideStep1Show 时间
            await Utils.wait(ANIM_TIMING.multiGuideStep1Show);
            // 2. 显示第一步算式
            arrow1.classList.add('show');
            middleBox.classList.add('show');
            step1.classList.add('show');

            // ⚠️ 3. 关键点：这里会播放语音，并一直【等待语音播放完毕】才继续往下走
            await this.showTipAndWait(STAGE_TEXTS.calcStep1);
            await Utils.wait(700); // 增加额外停顿时间，再显示下一步
            // 4. 显示第二步算式
            step2.classList.add('show');
            // ⚠️ 5. 再次等待第二句语音播放完毕
            await this.showTipAndWait(STAGE_TEXTS.calcStep2);
            await Utils.wait(400); // 增加额外停顿时间，再显示下一步
            // 6. 显示最终结果
            arrow2.classList.add('show');
            rightBox.classList.add('show');

            // 7. 等待第三句语音播放完毕
            await this.showTipAndWait(STAGE_TEXTS.calcStep3);
            await Utils.wait(200); // 最后写死了一个 200ms 的缓冲时间
        } else {
            await Utils.wait(ANIM_TIMING.multiNormalArrow1Wait);
            arrow1.classList.add('show');
            middleBox.classList.add('show');
            await Utils.wait(ANIM_TIMING.multiNormalStep1Wait);

            // this.audio.playRandomPencil();
            step1.classList.add('show');

            await Utils.wait(ANIM_TIMING.multiNormalStep1Pause);

            // this.audio.playRandomPencil();
            step2.classList.add('show');

            await Utils.wait(ANIM_TIMING.multiNormalStep2Pause);
            arrow2.classList.add('show');
            await Utils.wait(ANIM_TIMING.multiNormalArrow2Wait);

            // this.audio.playRandomPencil();
            rightBox.classList.add('show');

            await Utils.wait(ANIM_TIMING.multiNormalWaitFly);
        }
    }

    async animateResultToCell(num, targetEl) {
        let fromEl = this.els.calcRecordList ? this.els.calcRecordList.querySelector('.current-result-num') : document.body;
        if (!fromEl) fromEl = document.body;
        const from = Utils.getCellCenter(fromEl);
        const to = Utils.getCellCenter(targetEl);
        const fly = document.createElement('div');
        fly.className = 'result-fly-num';
        fly.textContent = num;
        fly.style.left = `${from.x - 38}px`;
        fly.style.top = `${from.y - 38}px`;
        document.body.appendChild(fly);

        // this.audio.playRandomPencil();
        const animation = fly.animate(
            [{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${to.x - from.x}px, ${to.y - from.y}px) scale(1.08)`, opacity: 1 }],
            { duration: 1000, easing: 'cubic-bezier(0.22, 0.75, 0.25, 1)', fill: 'forwards' }
        );
        try { await animation.finished; } catch (e) { }
        fly.remove();
    }

    lightResultCell(el) {
        this.audio.playEffect('audio/点亮.mp3');
        el.classList.remove('animate');
        void el.offsetWidth;
        el.classList.add('light', 'animate');
        const val = Number(el.dataset.val);
        if (val % 9 === 0 && !(this.isFirstTimeGuide && val === 9) && !el.querySelector('.hover-bubble')) {
            const hb = document.createElement('div');
            hb.className = 'hover-bubble';
            hb.textContent = `${val / 9} × 9 = ${val}`;
            el.appendChild(hb);
        }


        // Apply dimming effect when lighting a number
        this.isLightingAnim = true;
        if (typeof this.applyMatrixOpacity === 'function') this.applyMatrixOpacity();

        if (this.lightingAnimTimer) clearTimeout(this.lightingAnimTimer);
        this.lightingAnimTimer = setTimeout(() => {
            this.isLightingAnim = false;
            if (typeof this.applyMatrixOpacity === 'function') this.applyMatrixOpacity();
        }, 3200);
    }

    updateLitNumbersList(res) {
        const list = this.els.litNumbersList;
        if (!list) return null;
        const badge = document.createElement('div');
        badge.className = 'lit-num-badge';
        badge.textContent = res;
        const existingBadges = Array.from(list.children);
        const insertIndex = existingBadges.findIndex(el => Number(el.textContent) > res);
        if (insertIndex === -1) list.appendChild(badge);
        else list.insertBefore(badge, existingBadges[insertIndex]);
        return badge;
    }



    flashLitCell(res) {
        const el = this.numDomList[res - 1];
        if (!el || !el.classList.contains('light')) return;
        el.classList.remove('animate'); // Ensure any existing animation is stopped

        el.querySelectorAll('.circle-animation').forEach(c => c.remove());
        const circle = document.createElement('div');
        circle.className = 'circle-animation circle-flash';
        circle.style.setProperty('--circle-delay', '0s');
        el.appendChild(circle);
        setTimeout(() => circle.remove(), 3200);
    }

    removeAllCircles() {
        document.querySelectorAll('.circle-animation:not(.circle-flash)').forEach(c => c.remove());
    }

    playFocusAnimation() {
        if (this.game.lightRecord.length >= 3) {
            this.game.lightRecord.slice().sort((a, b) => a - b).forEach((num, index) => {
                const el = this.numDomList[num - 1];
                if (!el) return;

                el.animate([
                    { transform: 'scale(1)', boxShadow: '0 0 0 rgba(0,0,0,0)', zIndex: 1 },
                    { transform: 'scale(1.06)', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)', zIndex: 8, offset: 0.5 },
                    { transform: 'scale(1)', boxShadow: '0 0 0 rgba(0,0,0,0)', zIndex: 1 }
                ], { duration: 800, easing: 'ease-in-out', iterations: 2 });
            });
        }
    }

    async playThreeNumbersFocusAnimation() {
        if (this.hasPlayedThreeNumsFocus || this.game.lightRecord.length < 3) return;
        this.hasPlayedThreeNumsFocus = true;
        await Utils.wait(ANIM_TIMING.matrixFocusDelay);
        this.showTip(STAGE_TEXTS.thirdLight, false);
    }

    showHandGuideOnGe() {
        // 小手功能已根据需求移除
    }

    clearGuideHighlights() {
        document.querySelectorAll('.guide-highlight').forEach(el => el.classList.remove('guide-highlight', 'no-bg'));
    }

    async startFirstTimeGuide() {
        if (!this.isFirstTimeGuide) return;

        this.guideStep = 1;
        this.setInputDisabled(true);
        await this.showTipAndWait(STAGE_TEXTS.startGuide);
        this.setInputDisabled(false);

        // 统一聚光灯效果：激活遮罩层
        this.els.focusOverlay.classList.add('active');

        // Remove paper rotations for a cleaner guide view
        this.els.appShell.classList.add('guide-active');

        // Highlight inputs and numpad
        this.els.inputFixed.querySelector('.digit-inputs').classList.add('guide-highlight');
        this.els.numpad.classList.add('guide-highlight');
    }

    hideSecretButton() {
        clearTimeout(this.secretBtnTimer);
        this.secretBtnRevealed = false;
        this.els.secretBtn.classList.remove('reveal', 'soft-breath', 'flying');
        this.els.secretBtn.style.cssText = '';
        this.els.secretBtn.classList.add('locked');
        this.els.secretBtn.innerHTML = '<span class="btn-icon">🔒</span>发现数学规律';
    }

    revealSecretButton(delay = 0) {
        if (this.secretBtnRevealed) return;
        clearTimeout(this.secretBtnTimer);
        this.secretBtnTimer = setTimeout(() => {
            this.secretBtnRevealed = true;
            this.els.secretBtn.innerHTML = '<span class="btn-icon">✅</span>发现数学规律';
            this.els.secretBtn.classList.remove('locked');
            this.els.secretBtn.classList.add('reveal');

            const anim = this.els.secretBtn.animate([
                { transform: 'scale(1) translateY(0)', boxShadow: '0 4px 10px rgba(217, 119, 6, 0.1)' },
                { transform: 'scale(1.15) translateY(-4px)', boxShadow: '0 8px 25px rgba(217, 119, 6, 0.7)' },
                { transform: 'scale(1) translateY(0)', boxShadow: '0 4px 10px rgba(217, 119, 6, 0.1)' }
            ], {
                duration: 600,
                easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                iterations: 2
            });

            anim.onfinish = () => {
                this.els.secretBtn.classList.add('soft-breath');
            };

            const finalRect = this.els.secretBtn.getBoundingClientRect();
            const finalX = finalRect.left + finalRect.width / 2;
            const finalY = finalRect.top + finalRect.height / 2;

            for (let i = 0; i < 3; i++) {
                const ripple = document.createElement('div');
                ripple.className = 'ripple-effect secret-btn-ripple';
                ripple.style.left = `${finalX - 30}px`;
                ripple.style.top = `${finalY - 30}px`;
                ripple.style.animationDelay = `${i * 0.3}s`;
                ripple.style.zIndex = 250;
                document.body.appendChild(ripple);
                setTimeout(() => ripple.remove(), 1200 + i * 300);
            }
        }, delay);
    }

    updateTip(num) {
        const cnt = this.game.lightRecord.length;
        if (cnt >= 6) this.els.boardWrap.classList.add('show-bubbles');

        if (cnt === 1) this.showTip(STAGE_TEXTS.firstLight, false);
        else if (cnt === 2) this.showTip(STAGE_TEXTS.secondLight, false);
        else if (cnt === 4) {
            this.showTipAndWait(STAGE_TEXTS.fourthLight).then(() => {
                this.revealSecretButton(0);
            });
        }
        // else if (cnt === 5) { this.revealSecretButton(0); this.showTip(STAGE_TEXTS.fifthLight); }  // 暂时停用
        else if (cnt === 5) { this.revealSecretButton(0); }
        else if (cnt === 6) { this.revealSecretButton(0); this.showTip(STAGE_TEXTS.sixthLight); }
        // else if (cnt === 7) { this.revealSecretButton(0); this.showTip(STAGE_TEXTS.seventhLight); }  // 暂时停用
        else if (cnt === 7) { this.revealSecretButton(0); }
        else if (cnt === 8) { this.revealSecretButton(0); this.showTip(STAGE_TEXTS.eighthLight); }
        else if (cnt >= 9) {
            this.revealSecretButton(0);
            // 第9个点亮后，等语音播完直接结束程序
            this.uninterruptibleVoice = true;
            this.showTipAndWait(STAGE_TEXTS.ninthLight).then(() => {
                this.uninterruptibleVoice = false;
                if (window.g) window.g.trackComplete();
            });
        }
    }

    // --- 事件绑定 ---
    bindEvents() {
        const { inputTen, inputGe, cellTen, cellGe, numpad, numpadClear, numpadDel2, randomBtn, secretBtn, replayBtn, continueExploreBtn, startBtn } = this.els;


        const unlitOpacitySlider = document.getElementById('unlitOpacitySlider');
        const matrixPersistentToggle = document.getElementById('matrixPersistentToggle');

        this.applyMatrixBrightness = () => {
            if (!unlitOpacitySlider) return;
            const targetBrightness = unlitOpacitySlider.value / 100;
            const isPersistent = matrixPersistentToggle ? matrixPersistentToggle.checked : false;

            if (isPersistent || (this.isLightingAnim && this.isFirstTimeGuide)) {
                document.documentElement.style.setProperty('--unlit-brightness', targetBrightness);
            } else {
                document.documentElement.style.setProperty('--unlit-brightness', 1);
            }
        };

        // 兼容：保留旧名引用
        this.applyMatrixOpacity = this.applyMatrixBrightness;

        if (unlitOpacitySlider) {
            unlitOpacitySlider.addEventListener('input', this.applyMatrixBrightness);
            this.applyMatrixBrightness();
        }
        if (matrixPersistentToggle) {
            matrixPersistentToggle.addEventListener('change', this.applyMatrixBrightness);
        }

        const debugToggle = document.getElementById('debugToggle');
        const debugPanel = document.getElementById('debugPanel');
        if (debugToggle && debugPanel) {
            debugToggle.addEventListener('click', () => {
                debugPanel.classList.toggle('collapsed');
            });
        }

        const showLitListToggle = document.getElementById('showLitListToggle');
        const boardHint = document.getElementById('boardHint');
        if (showLitListToggle && boardHint) {
            showLitListToggle.addEventListener('change', (e) => {
                boardHint.style.display = e.target.checked ? 'flex' : 'none';
            });
            boardHint.style.display = showLitListToggle.checked ? 'flex' : 'none';
        }

        const themeSelect = document.getElementById('themeSelect');
        if (themeSelect) {
            themeSelect.addEventListener('change', (e) => {
                // Remove all theme classes
                document.body.classList.remove('theme-2', 'theme-3');
                // Add the selected theme class (theme-1 is default, no class needed)
                if (e.target.value !== 'theme-1') {
                    document.body.classList.add(e.target.value);
                }
            });
        }

        [inputTen, inputGe].forEach(inp => {
            inp.addEventListener('focus', () => {
                cellTen.classList.toggle('focused', document.activeElement === inputTen);
                cellGe.classList.toggle('focused', document.activeElement === inputGe);
            });
            inp.addEventListener('blur', () => {
                setTimeout(() => {
                    if (document.activeElement !== inputTen && document.activeElement !== inputGe) {
                        cellTen.classList.remove('focused');
                        cellGe.classList.remove('focused');
                    }
                }, 80);
            });
            inp.addEventListener('click', () => this.hideInputGuide());
        });

        const removeFirstTimeHand = () => {
            const hand = document.querySelector('.first-time-hand');
            if (hand) hand.remove();
        };
        numpad.addEventListener('click', removeFirstTimeHand);
        [inputTen, inputGe].forEach(inp => inp.addEventListener('input', removeFirstTimeHand));

        inputTen.addEventListener('keydown', (e) => { if (this.isResultAnimating || this.isFocusAnimating) e.preventDefault(); });
        inputTen.addEventListener('input', () => {

            if (this.isResultAnimating || this.isFocusAnimating) { inputTen.value = ''; return; }
            this.hideInputGuide();
            if (!this.persistentTip) this.els.normalTip.classList.remove('show');
            const digit = inputTen.value.replace(/\D/g, '').slice(-1);
            if (this.guideStep === 1 && digit !== '1' && digit !== '') {
                inputTen.value = '';
                return;
            }
            if (digit === '0') {
                inputTen.value = '';
                this.showTip(STAGE_TEXTS.invalidTen);
                return;
            }
            if (digit) {
                inputTen.value = digit;
                inputGe.focus();
                inputGe.select();
            } else {
                inputTen.value = '';
            }
        });

        inputGe.addEventListener('keydown', (e) => {
            if (this.isResultAnimating || this.isFocusAnimating) { e.preventDefault(); return; }
            if (e.key === 'Backspace' && inputGe.value === '') {
                e.preventDefault();
                inputTen.focus();
                inputTen.select();
            }
        });

        inputGe.addEventListener('input', () => {
            if (this.isResultAnimating || this.isFocusAnimating) { inputGe.value = ''; return; }
            this.hideInputGuide();
            if (!this.persistentTip) this.els.normalTip.classList.remove('show');
            const digit = inputGe.value.replace(/\D/g, '').slice(-1);
            inputGe.value = digit;
            if (digit && inputTen.value) {
                this.executeCalc(Number(inputTen.value + digit));
            }
        });

        numpad.addEventListener('click', (e) => {

            const btn = e.target.closest('.numpad-btn');
            if (!btn || this.isResultAnimating || this.isFocusAnimating) return;
            const digit = btn.dataset.digit;
            if (digit === undefined) return;

            this.hideInputGuide();
            if (!this.persistentTip) this.els.normalTip.classList.remove('show');

            if (!inputTen.value) {
                if (this.guideStep === 1 && digit !== '1') {
                    return;
                }
                if (digit === '0') {
                    this.showTip(STAGE_TEXTS.invalidTen);
                    return;
                }
                inputTen.value = digit;
                this.prepareNextRecordBlock();
                inputGe.focus();
            } else if (!inputGe.value) {
                inputGe.value = digit;
                this.executeCalc(Number(inputTen.value + digit));
            }
        });

        numpadClear.addEventListener('click', () => {
            if (this.isResultAnimating || this.isFocusAnimating) return;
            if (!inputTen.readOnly) inputTen.value = '';
            inputGe.value = '';
            if (inputTen.readOnly) { inputTen.value = '1'; inputGe.focus(); } else inputTen.focus();
            this.hideInputGuide();
            this.clearCalc();
        });

        numpadDel2.addEventListener('click', () => {
            if (this.isResultAnimating || this.isFocusAnimating) return;
            if (inputGe.value) { inputGe.value = ''; inputGe.focus(); }
            else if (inputTen.value && !inputTen.readOnly) { inputTen.value = ''; inputTen.focus(); }
            else if (inputTen.readOnly && inputGe.value === '') inputGe.focus();
            this.hideInputGuide();
            this.clearCalc();
        });

        if (randomBtn) {
            randomBtn.addEventListener('click', () => {
                if (this.isFirstTimeGuide || this.isResultAnimating || this.isFocusAnimating) return;
                this.hideInputGuide();

                let candidatePool = [];
                const litResults = this.game.lightRecord;
                const allPossibleResults = [9, 18, 27, 36, 45, 54, 63, 72, 81];
                const unlitResults = allPossibleResults.filter(r => !litResults.includes(r));

                let is30Percent = Math.random() < 0.05;
                if (this.game.lastRandomWasDuplicate) {
                    is30Percent = false;
                }

                const getUnusedForResult = (R) => {
                    let tens = Math.floor(R / 9);
                    let arr = [];
                    for (let g = 0; g <= 9; g++) {
                        let N = tens * 10 + g;
                        if (!this.game.usedNumbers.has(N)) arr.push(N);
                    }
                    return arr;
                };

                if (is30Percent && litResults.length > 0) {
                    const shuffledLit = [...litResults].sort(() => Math.random() - 0.5);
                    for (let r of shuffledLit) {
                        let available = getUnusedForResult(r);
                        if (available.length > 0) {
                            candidatePool = available;
                            break;
                        }
                    }
                }

                if (candidatePool.length === 0 && unlitResults.length > 0) {
                    const shuffledUnlit = [...unlitResults].sort(() => Math.random() - 0.5);
                    for (let r of shuffledUnlit) {
                        let available = getUnusedForResult(r);
                        if (available.length > 0) {
                            candidatePool = available;
                            break;
                        }
                    }
                }

                if (candidatePool.length === 0) {
                    for (let i = 10; i <= 99; i++) {
                        if (!this.game.usedNumbers.has(i)) candidatePool.push(i);
                    }
                }

                let randomNum;
                if (candidatePool.length > 0) {
                    randomNum = candidatePool[Math.floor(Math.random() * candidatePool.length)];
                } else {
                    randomNum = Math.floor(Math.random() * 90) + 10;
                }

                const testR = randomNum - (randomNum % 10) - Math.floor(randomNum / 10);
                this.game.lastRandomWasDuplicate = litResults.includes(testR);

                inputTen.value = Math.floor(randomNum / 10);
                inputGe.value = randomNum % 10;
                this.executeCalc(randomNum, true);
            });
        }

        secretBtn.addEventListener('click', () => {
            if (secretBtn.classList.contains('locked')) return;
            // successSecret 提示已移除，结束由第9个点亮的语音播完后触发
            alert('跳转到下一环节');
            if (window.g) window.g.trackComplete();
        });

        if (replayBtn) {
            replayBtn.addEventListener('click', () => {
                this.playAgain();
            });
        }

        startBtn.addEventListener('click', async () => {
            if (this.game.hasStarted) return;
            this.game.hasStarted = true;
            this.els.startScreen.classList.add('hidden');
            this.els.appShell.classList.add('active');

            this.guideInputForNextTry(STAGE_TEXTS.inputGuideFirst);
            this.audio.playBgm();

            if (this.isFirstTimeGuide) {
                this.els.focusOverlay.classList.add('active');
                setTimeout(() => this.startFirstTimeGuide(), 500);
            } else {
                setTimeout(() => { if (this.game.lightRecord.length === 0) this.showHandGuideOnGe(); }, 1500);
            }
        });
        this.els.boardWrap.addEventListener('click', (e) => {
            const numEl = e.target.closest('.num.light');
            this.els.board.querySelectorAll('.mobile-hover').forEach(el => el.classList.remove('mobile-hover'));

            if (numEl) {
                numEl.classList.add('mobile-hover');
                if (this.mobileHoverTimer) clearTimeout(this.mobileHoverTimer);
                this.mobileHoverTimer = setTimeout(() => {
                    numEl.classList.remove('mobile-hover');
                }, 3000);
            }
        });
    }

    reRenderHistory() {
        const list = this.els.calcRecordList;
        if (!list) return;

        list.innerHTML = '';
        this.currentPendingBlock = null;

        const historyReversed = [...this.game.history].reverse();
        historyReversed.forEach((item, index) => {
            const { num, ge, shi, res } = item;
            const c1 = num - ge;
            const c2 = c1 - shi;
            const block = document.createElement('div');
            block.className = index === 0 ? 'record-block-multi' : 'record-block-multi dimmed-record';

            block.innerHTML = `
                    <div class="multi-box multi-box-left show">${num}</div>
                    <div class="multi-arrow multi-arrow-1 show">→</div>
                    <div class="multi-box multi-box-middle show">
                        <div class="step-line step-1 show">① ${num} - ${ge} = ${c1}</div>
                        <div class="step-line step-2 show">② ${c1} - ${shi} = <span class="text-red">${c2}</span></div>
                    </div>
                    <div class="multi-arrow multi-arrow-2 show">→</div>
                    <div class="multi-box multi-box-right show ${index === 0 ? 'current-result-num' : ''}">${c2}</div>
                `;
            list.appendChild(block);
        });
        list.parentElement.scrollTo({ top: 0, behavior: 'smooth' });
    }
    finalizePendingBlock() {
        // Disabled
    }

    abortPendingBlock() {
        // Disabled
    }

    clearCalc() {
        this.clearDigitInputs();
        this.abortPendingBlock();
    }

    async executeCalc(num, isRandomAction = false) {
        if (this.isResultAnimating || this.isFocusAnimating) return;

        if (!Number.isInteger(num) || num < 10 || num > 99) {
            this.clearCalc();
            this.showTip(STAGE_TEXTS.invalidRange);
            this.guideInputForNextTry(STAGE_TEXTS.inputGuideRange);
            return;
        }

        // 首次输入必须为 10-19，但给用户自由输入的权利，在此处校验
        if (this.game.lightRecord.length === 0 && num > 19) {
            this.showTip(STAGE_TEXTS.invalidFirst);
            this.clearCalc();
            this.guideInputForNextTry(STAGE_TEXTS.inputGuideFirstRetry);
            return;
        }

        this.game.usedNumbers.add(num);

        const ge = num % 10;
        const shi = Math.floor(num / 10);
        const res = num - ge - shi;

        this.els.inputFixed.classList.add('dimmed-inputs');
        this.isResultAnimating = true;
        this.setInputDisabled(true);

        await this.updateCalcAnimated(num, ge, shi, res);
        this.game.history.push({ num, ge, shi, res });

        if (this.isFirstTimeGuide) {
            this.guideStep = 3;
            //this.showTip("每次运算的结果会在这个区域被点亮");
            this.clearGuideHighlights();
            const panel = this.els.boardWrap.closest('.board-panel');
            if (panel) panel.classList.add('guide-highlight', 'no-bg');
        }

        const isAlreadyLight = this.game.lightRecord.includes(res);
        const curTen = shi;
        let isNew = !isAlreadyLight;

        if (res >= 1 && res <= 99) {
            const el = this.numDomList[res - 1];

            // 如果未点亮过，记录到点亮历史中
            if (!isAlreadyLight) {
                this.game.recordLight(res, curTen);
            } else {
                // 如果已点亮过，仅更新最近一次十位以备后续判断，但不阻止正常飞入
                this.game.lastTenDigit = curTen;
            }

            this.updateTip(num);

            try { await this.animateResultToCell(res, el); } finally {
                this.lightResultCell(el);
                if (isNew) {
                    this.updateLitNumbersList(res);
                    // 第一次点亮时（非引导模式），短暂展示气泡提示
                    if (this.game.lightRecord.length === 1 && !this.isFirstTimeGuide) {
                        el.classList.add('brief-show-bubble');
                        setTimeout(() => el.classList.remove('brief-show-bubble'), 2000);
                    }
                }
            }

            if (this.isFirstTimeGuide) {
                // 引导模式下的特殊处理
                this.guideStep = 4;
                this.persistentTip = true;

                // 撤销遮罩
                this.clearGuideHighlights();
                this.els.focusOverlay.classList.remove('active', 'light-mask');
                this.els.focusOverlay.style.background = '';
                this.els.appShell.classList.remove('guide-active');

                this.isFirstTimeGuide = false;
                this.audio.switchBgm('audio/Proof_Of_The_Pattern.mp3');

                // 补充 09 的气泡
                const el9 = this.numDomList[8];
                if (el9 && el9.classList.contains('light') && !el9.querySelector('.hover-bubble')) {
                    el9.classList.remove('brief-show-bubble');
                    const hb = document.createElement('div');
                    hb.className = 'hover-bubble';
                    hb.textContent = '1 × 9 = 9';
                    el9.appendChild(hb);
                }

                // 提前清空输入框，防止遗留数据导致键盘被锁死
                this.clearDigitInputs();

                // 提前显示随机按钮（不等语音播完）
                if (this.els.randomBtn) this.els.randomBtn.style.display = 'flex';

                // 停止当前TTS
                this.tts.stop();

                // 播放总结语音（在解锁UI前播放）
                this.uninterruptibleVoice = true;
                await this.showTipAndWait(STAGE_TEXTS.firstLight);
                this.uninterruptibleVoice = false;

                // 语音播完后，左侧区域发光虚线边框闪烁提示学生输入
                const sidebarEl = document.querySelector('.sidebar');
                if (sidebarEl) {
                    sidebarEl.classList.remove('sidebar-guide-flash');
                    void sidebarEl.offsetWidth;
                    sidebarEl.classList.add('sidebar-guide-flash');
                    setTimeout(() => sidebarEl.classList.remove('sidebar-guide-flash'), 2000);
                }

                // 语音播完后再解除操作锁定，恢复交互
                this.isResultAnimating = false;
                this.guideInputForNextTry();

                return;
            } else {
                this.isResultAnimating = false; // 普通模式下，动画结束即可解锁
            }

            if (isNew && this.game.lightRecord.length >= 3) {
                el.animate([
                    { transform: 'scale(1)', boxShadow: '0 0 0 rgba(0,0,0,0)', zIndex: 1 },
                    { transform: 'scale(1.06)', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)', zIndex: 8, offset: 0.5 },
                    { transform: 'scale(1)', boxShadow: '0 0 0 rgba(0,0,0,0)', zIndex: 1 }
                ], { duration: 800, easing: 'ease-in-out', iterations: 1 });
                // await Utils.wait(ANIM_TIMING.matrixSettleBreathing);
                // this.playFocusAnimation();
                // await Utils.wait(ANIM_TIMING.matrixFocusBreathing);
                await Utils.wait(ANIM_TIMING.matrixNormalSettle);
            } else if (isNew) {
                await Utils.wait(ANIM_TIMING.matrixNormalSettle);
            }
        }

        if (isNew && this.game.lightRecord.length === 3) {
            // 第3个结果点亮时，清除持久提示
            if (this.persistentTip) {
                this.persistentTip = false;
            }
            this.clearDigitInputs();
            this.playThreeNumbersFocusAnimation();
            this.guideInputForNextTry();
            return;
        }

        if (isNew) this.guideInputForNextTry();
        else if (isAlreadyLight) {
            // 已点亮的结果：静默解锁输入框，不触发任何语音或提示
            this.guideInputForNextTry();
        }
    }

    playAgain() {
        this.game.initPatterns();
        this.game.resetState();
        this.buildBoard();
        this.resetBoardUI();
        this.clearCalc();
        this.hasPlayedThreeNumsFocus = false;
        this.removeAllCircles();
        this.hideSecretButton();

        this.els.focusOverlay.classList.remove('active', 'light-mask');
        this.els.focusOverlay.style.background = '';
        this.els.appShell.classList.remove('guide-active');
        this.persistentTip = false;

        // 如果重新开始需要连同引导模式一起重置，可以解除下面两行的注释：
        // this.isFirstTimeGuide = true;
        // this.audio.switchBgm('audio/bgm.mp3');

        this.showTip(STAGE_TEXTS.start);
        this.guideInputForNextTry(STAGE_TEXTS.inputGuideFirst);
    }
}

// --- 初始化入口 ---
function bootstrapApp() {
    const audio = new AudioManager();
    const tts = new TTSManager();
    const game = new GameManager();

    // 初始化数据
    game.initPatterns();

    const ui = new UIManager(audio, tts, game);

    ui.buildBoard();
    ui.resetBoardUI();
    ui.clearCalc();
    ui.hideSecretButton();

    // 第三方 SDK 集成逻辑
    const mzoneSdk = window.MzoneGlobal?.default || window.MzoneGlobal;
    const { Global } = mzoneSdk || {};
    const g = Global ? new Global('learning_class_gene_msg_h5') : null;
    window.g = g;

    if (g) {
        const system = g.query('userId') ? 'morton' : 'ide';
        const isEmbedded = window.self !== window.top;
        if (isEmbedded) g.resize(1440, 900);

        if (isEmbedded || system === 'morton') {
            g.loading(true);
            g.init(system, Number(g.query('unitId') || 0), { images: [] }, () => g.loading(false));
        } else {
            g.trackView();
            g.trackInit();
            g.loading(false);
        }
    }
}

// 启动应用
bootstrapApp();
