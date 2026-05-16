console.log("YouTube 工具箱 Content Script 已就位");


// 1. 從網址中提取 YouTube 影片 ID (例如 ?v=dQw4w9WgXcQ 裡的 dQw4w9WgXcQ)
function getVideoId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('v');
}
// 1. 定義一個全域變數，用來承載最新的字幕數據
let currentSubtitles = [];

// ==========================================
// 核心：接聽來自閱讀編輯頁面的「即時熱更新」信號 (完美對接版)
// ==========================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "REFRESH_SUBTITLES") {
        console.log("[工具箱 Content.js] 📥 成功接收到熱更新信號！");
        
        // 1. 將全域變數更新為剛剛修改完的最新完美字幕
        currentSubtitles = message.subtitles; 
        
        // 2. 💥 核心魔法：直接重新呼叫你原本的渲染函數，並把最新數據塞進去！
        if (typeof renderSubtitles === 'function') {
            renderSubtitles(currentSubtitles);
            console.log("[工具箱 Content.js] ⚡ 已成功重新驅動 renderSubtitles 函數！");
        } else {
            console.error("[工具箱 Content.js] ❌ 找不到 renderSubtitles 函數，請確認加載順序。");
        }
        
        sendResponse({ result: "hot_refresh_completed" });
    }
    return true; 
});

function init() {
    const videoId = getVideoId();
    if (!videoId) return;

    // 讀取本地快取字幕
    chrome.storage.local.get([videoId], (result) => {
        if (result[videoId]) {
            renderSubtitles(result[videoId]);
        }
    });
}

// 輔助函數：將 HEX 顏色轉換成帶透明度的 RGBA
function hexToRgba(hex, opacity) {
    let c = hex.substring(1);
    if(c.length === 3) c = c.split('').map(x => x + x).join('');
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function renderSubtitles(subtitles) {
    const videoElement = document.querySelector("video");
    if (!videoElement) return;

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
        subTextSpan.style.whiteSpace = "pre-line"; // 💥 確保 \n 可以正常換行分層
        
        subContainer.appendChild(subTextSpan);
        document.querySelector(".html5-video-player")?.appendChild(subContainer);
    }

    const textSpan = document.getElementById("toolbox-subtitle-span");

    // 動態更新樣式
    function applyDynamicStyles() {
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
            textSpan.style.backgroundColor = hexToRgba(styles.backgroundColor, styles.opacity);
        });
    }

    applyDynamicStyles();

    // -------------------------------------------------------------
    // ⏳ 雙層滾動與最小時間核心變數
    // -------------------------------------------------------------
    let lastDisplayedSub = null;   // 記錄上一句顯示嘅完整字幕物件 (包含 start, end, text)
    let lastDisplayTime = 0;       // 記錄上一句字幕實際喺畫面上「開始掛載」嘅影片播放秒數
    const MIN_DURATION = 2;      // ⏳ 每行字幕最少強制顯示 1.0 秒 (可自行調校)

    // 對齊全域變數
    currentSubtitles = subtitles;

    if (!videoElement.dataset.hasToolboxListener) {
        videoElement.addEventListener("timeupdate", () => {
            const currentTime = videoElement.currentTime;
            
            // 1. 🔍 尋找「當前正規時間」應該播放嘅主字幕
            let currentSub = currentSubtitles.find(sub => currentTime >= sub.start && currentTime <= sub.end);
            
            // 2. ⏳ 最小顯示時間補償機制：
            // 如果當前時間點已經冇字幕，但上一句字幕顯示嘅時間仲未夠 MIN_DURATION 秒
            if (!currentSub && lastDisplayedSub && (currentTime - lastDisplayTime) < MIN_DURATION) {
                // 強制將上一句當作當前主字幕延續壽命
                currentSub = lastDisplayedSub;
            }

            // 3. 💥 雙層字幕撞車判定機制：
            let finalOutputText = "";

            if (currentSub) {
                // 如果換咗新一句字幕，更新計時起點
                if (!lastDisplayedSub || currentSub.text !== lastDisplayedSub.text) {
                    lastDisplayTime = currentTime;
                    lastDisplayedSub = currentSub;
                }

                finalOutputText = currentSub.text;

                // 🔍 關鍵：去尋找「緊絀依附在後」嘅下一句字幕
                // 條件：搵出所有開始時間大過當前主字幕，且排在後面最接近嘅那一句
                const nextSub = currentSubtitles.find(sub => sub.start > currentSub.start);
                
                if (nextSub) {
                    // 判定下一句係咪「太接近」？
                    // 定義接近：下一句字幕嘅官方開始時間，早過（主字幕實際起點 + 最小顯示時間）
                    // 白話文：主字幕還沒被「強行顯示完畢」，下一句就已經急不及待要出來了
                    const currentSubExpectedEnd = lastDisplayTime + MIN_DURATION;
                    
                    if (nextSub.start <= currentSubExpectedEnd || currentTime >= nextSub.start) {
                        // 💥 滿足條件！此時 currentTime 可能已經踩入下一句，或者下一句即將到來
                        // 如果 currentTime 已經踩入下一句，就將下一句當作主體，上一句疊在上面；
                        // 如果未踩入，就將下一句提早調用，疊在下面！
                        if (currentTime >= nextSub.start) {
                            // 視角轉換：當前其實已經播緊下一句，所以舊字幕（currentSub）在上面，新字幕（nextSub）在下面
                            finalOutputText = `${currentSub.text}\n${nextSub.text}`;
                        } else {
                            // 當前仲播緊舊字幕，但因為太接近，提早把新字幕（nextSub）拉出來顯示在下面
                            finalOutputText = `${currentSub.text}\n${nextSub.text}`;
                        }
                    }
                }
            }

            // 4. 🖨️ 真正印出畫面
            if (finalOutputText) {
                textSpan.innerText = finalOutputText;
                subContainer.style.display = "block";
            } else {
                subContainer.style.display = "none";
                textSpan.innerText = "";
                lastDisplayedSub = null;
            }
        });
        
        videoElement.dataset.hasToolboxListener = "true";
        console.log("[工具箱 Content.js] ⏱️ 智能前後句時序雙層字幕監聽器更新成功！");
    }
}


// 監聽 YouTube SPA 影片切换
window.addEventListener("yt-navigate-finish", init);
init();
