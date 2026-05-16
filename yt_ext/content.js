// =============================================================
// 1. 全域變數定義區 (確保所有管道讀取嘅都是同一份記憶體)
// =============================================================
let currentSubtitles = [];     // 儲存當前最新的字幕陣列
let lastDisplayedSub = null;   // 記錄上一句顯示的字幕物件
let lastDisplayTime = 0;       // 記錄上一句字幕開始顯示的影片秒數
const MIN_DURATION = 1.0;      // ⏳ 每行字幕最少強制顯示 1.0 秒

// =============================================================
// 2. 核心：建立與獲取字幕 HTML 容器 (DOM)
// =============================================================
function getOrCreateSubtitleLayer() {
    let subContainer = document.getElementById("toolbox-subtitle-layer");
    if (!subContainer) {
        subContainer = document.createElement("div");
        subContainer.id = "toolbox-subtitle-layer";
        subContainer.style.position = "absolute";
        subContainer.style.bottom = "80px"; 
        subContainer.style.width = "100%";
        subContainer.style.textAlign = "center";
        subContainer.style.zIndex = "9999";
        subContainer.style.pointerEvents = "none";
        
        const subTextSpan = document.createElement("span");
        subTextSpan.id = "toolbox-subtitle-span";
        subTextSpan.style.padding = "4px 12px";
        subTextSpan.style.borderRadius = "4px";
        subTextSpan.style.lineHeight = "1.5";
        subTextSpan.style.whiteSpace = "pre-line"; // 💥 必須：確保 \n 換行正常，雙層字幕才能分行
        
        subContainer.appendChild(subTextSpan);
        document.querySelector(".html5-video-player")?.appendChild(subContainer);
    }
    return document.getElementById("toolbox-subtitle-span");
}

// =============================================================
// 3. 🎨 樣式即時套用核心
// =============================================================
function applyDynamicStyles() {
    const textSpan = getOrCreateSubtitleLayer();
    if (!textSpan) return;

    chrome.storage.local.get(["subtitle_style"], (res) => {
        const styles = res.subtitle_style || {
            fontSize: "26px",
            color: "#ffffff",
            backgroundColor: "#000000",
            opacity: 0.6,
            textShadow: "2px 2px 4px #000"
        };
        
        textSpan.style.fontSize = styles.fontSize;
        textSpan.style.color = styles.color;
        textSpan.style.textShadow = styles.textShadow;
        
        if (typeof hexToRgba === 'function') {
            textSpan.style.backgroundColor = hexToRgba(styles.backgroundColor, styles.opacity);
        } else {
            textSpan.style.backgroundColor = styles.backgroundColor;
        }
        console.log("[工具箱 Content.js] 🎨 樣式已更新:", styles.fontSize);
    });
}

// =============================================================
// 4. ⏱️ 時序比對與「雙層防撞」渲染引擎
// =============================================================
function checkAndUpdateSubtitleDisplay() {
    const videoElement = document.querySelector("video");
    const textSpan = document.getElementById("toolbox-subtitle-span");
    const subContainer = document.getElementById("toolbox-subtitle-layer");
    if (!videoElement || !textSpan || !subContainer) return;

    const currentTime = videoElement.currentTime;
    
    // ① 尋找當前主字幕
    let currentSub = currentSubtitles.find(sub => currentTime >= sub.start && currentTime <= sub.end);
    
    // ② 最小時間留存補償 (強行延命)
    if (!currentSub && lastDisplayedSub && (currentTime - lastDisplayTime) < MIN_DURATION) {
        currentSub = lastDisplayedSub;
    }

    let finalOutputText = "";

    if (currentSub) {
        // 如果換了新的一句，重設計時起點
        if (!lastDisplayedSub || currentSub.text !== lastDisplayedSub.text) {
            lastDisplayTime = currentTime;
            lastDisplayedSub = currentSub;
        }

        finalOutputText = currentSub.text;

        // ③ 💥 核心功能：雙層字幕防撞邏輯
        const nextSub = currentSubtitles.find(sub => sub.start > currentSub.start);
        if (nextSub) {
            const currentSubExpectedEnd = lastDisplayTime + MIN_DURATION;
            // 判定條件：如果下一句的開始時間，早過主字幕預期退場的時間，或者當前時間已經踩入下一句
            if (nextSub.start <= currentSubExpectedEnd || currentTime >= nextSub.start) {
                finalOutputText = `${currentSub.text}\n${nextSub.text}`;
            }
        }
    }

    // ④ 真正印出畫面
    if (finalOutputText) {
        textSpan.innerText = finalOutputText;
        subContainer.style.display = "block";
    } else {
        subContainer.style.display = "none";
        textSpan.innerText = "";
        lastDisplayedSub = null;
    }
}

// =============================================================
// 5. 🚀 外部主驅動入口函數
// =============================================================
function renderSubtitles(subtitles) {
    if (!subtitles || subtitles.length === 0) return;

    // 確保容器存在
    getOrCreateSubtitleLayer();
    
    // 更新全域數據
    currentSubtitles = subtitles;
    
    // 初始化樣式
    applyDynamicStyles();

    // 綁定時間軸監聽 (確保全網頁只綁定一次)
    const videoElement = document.querySelector("video");
    if (videoElement && !videoElement.dataset.hasToolboxListener) {
        videoElement.addEventListener("timeupdate", checkAndUpdateSubtitleDisplay);
        videoElement.dataset.hasToolboxListener = "true";
        console.log("[工具箱 Content.js] ⏱️ 影片時間軸監聽雷達成功掛載！");
    }

    // 數據進來時，立刻強制刷新一次畫面
    checkAndUpdateSubtitleDisplay();
}

// =============================================================
// 6. 📡 全域事件監聽雷達 (永不失效)
// =============================================================

// 💥 解決「應用樣式沒反應」：全域單一監聽 storage 變更
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (changes.subtitle_style) {
        console.log("[工具箱 Content.js] 📥 偵測到 Popup 更改了樣式，立即套用...");
        applyDynamicStyles();
        setTimeout(checkAndUpdateSubtitleDisplay, 50);
    }
});

// 💥 解決「保存後不更新」：全域單一監聽閱讀分頁的熱更新信號
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "REFRESH_SUBTITLES") {
        console.log("[工具箱 Content.js] 📥 收到閱讀頁面發射的熱更新字幕！");
        currentSubtitles = message.subtitles;
        checkAndUpdateSubtitleDisplay();
        sendResponse({ result: "success_hot_refresh" });
    }
    return true;
});

// =============================================================
// 7. 🔑 插件初始化與生命週期驅動區 (完美修復版)
// =============================================================

/**
 * 💥 核心補救：將純文字 SRT 字串解析為結構化陣列物件
 */
function parseSrtContent(srtText) {
    if (!srtText || typeof srtText !== 'string') return [];
    
    // 將換行符號統一，並以雙換行切分每一句字幕區塊
    const blocks = srtText.replace(/\r\n/g, '\n').split('\n\n');
    const subtitleArray = [];

    blocks.forEach(block => {
        const lines = block.trim().split('\n');
        if (lines.length >= 3) {
            // lines[0] 是序號 (例如 1)
            // lines[1] 是時間軸 (例如 00:00:01,123 --> 00:00:04,567)
            // lines[2] 之後是字幕文本
            const timeMatch = lines[1].match(/(\d+):(\d+):(\d+),(\d+)\s*-->\s*(\d+):(\d+):(\d+),(\d+)/);
            
            if (timeMatch) {
                // 將 時間軸 轉換為 總秒數 (Float)
                const sH = parseInt(timeMatch[1]), sM = parseInt(timeMatch[2]), sS = parseInt(timeMatch[3]), sMs = parseInt(timeMatch[4]);
                const eH = parseInt(timeMatch[5]), eM = parseInt(timeMatch[6]), eS = parseInt(timeMatch[7]), eMs = parseInt(timeMatch[8]);
                
                const startTime = sH * 3600 + sM * 60 + sS + sMs / 1000;
                const endTime = eH * 3600 + eM * 60 + eS + eMs / 1000;
                
                // 內文可能有多行，合併起來
                const text = lines.slice(2).join('\n');
                
                subtitleArray.push({
                    start: startTime,
                    end: endTime,
                    text: text
                });
            }
        }
    });

    return subtitleArray;
}

function init() {
    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get("v");
    
    if (videoId) {
        console.log(`[工具箱 Content.js] 🚀 偵測到影片分頁 ${videoId}，開始初始化抓取快取...`);
        
        chrome.storage.local.get([`${videoId}_native`], (res) => {
            const cachedSrt = res[`${videoId}_native`];
            if (cachedSrt) {
                console.log("[工具箱 Content.js] 🎉 成功找到快取純文字 SRT，開始安全解析為陣列...");
                
                // 💥 關鍵修復：先將字串轉為陣列，再丟入渲染引擎
                const parsedArray = parseSrtContent(cachedSrt);
                
                console.log("[工具箱 Content.js] 解析完成，總計條數:", parsedArray.length);
                renderSubtitles(parsedArray);
            } else {
                console.log("[工具箱 Content.js] 📭 當前影片尚未快取字幕數據。");
            }
        });
    }
}

// 監聽 YouTube 獨有的單頁應用（SPA）換頁事件
window.addEventListener("yt-navigate-finish", init);

// 首次開啟網頁時直接執行一次
init();


// =============================================================
// 附屬輔助函數
// =============================================================
function hexToRgba(hex, opacity) {
    let c;
    if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
        c= hex.substring(1).split('');
        if(c.length== 3){
            c= [c[0], c[0], c[1], c[1], c[2], c[2]];
        }
        c= '0x'+c.join('');
        return 'rgba('+[(c>>16)&255, (c>>8)&255, c&255].join(',')+','+opacity+')';
    }
    return hex;
}