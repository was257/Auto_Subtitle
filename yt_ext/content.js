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
        // 基本常規佈局定位
        subContainer.style.position = "absolute";
        subContainer.style.bottom = "80px"; 
        subContainer.style.width = "100%";
        subContainer.style.textAlign = "center";
        subContainer.style.zIndex = "9999";
        subContainer.style.pointerEvents = "none";
        
        // 內層真正的文字 Span，方便精準控制底色範圍
        const subTextSpan = document.createElement("span");
        subTextSpan.id = "toolbox-subtitle-span";
        subTextSpan.style.padding = "4px 12px";
        subTextSpan.style.borderRadius = "4px";
        subTextSpan.style.lineHeight = "1.5";
        
        subContainer.appendChild(subTextSpan);
        document.querySelector(".html5-video-player")?.appendChild(subContainer);
    }

    const textSpan = document.getElementById("toolbox-subtitle-span");

    // 核心優化：動態更新樣式函數
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

    // 初始化調用一次樣式
    applyDynamicStyles();

    // 監聽來自 Popup 點擊「應用樣式」時的即時儲存變更事件
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (changes.subtitle_style) {
            applyDynamicStyles();
        }
    });
    // 先把全域變數對齊傳進來的數據（確保任何時候計時器讀到的都是最新版）
    currentSubtitles = subtitles;

    // 檢查是不是已經綁定過計時器了，如果沒綁定過才綁定，防止無限疊加監聽器
    if (!videoElement.dataset.hasToolboxListener) {
        videoElement.addEventListener("timeupdate", () => {
            const currentTime = videoElement.currentTime;
            
            // 💥 這裡改成讀取全域的 currentSubtitles，這樣只要上面變數一換，這裡會一微秒內直接抓到新字幕！
            const currentSub = currentSubtitles.find(sub => currentTime >= sub.start && currentTime <= sub.end);
            
            if (currentSub) {
                textSpan.innerText = currentSub.text;
                subContainer.style.display = "block";
            } else {
                subContainer.style.display = "none";
                textSpan.innerText = "";
            }
        });
        
        // 做個標記，代表這個 video 已經掛過計時器雷達了
        videoElement.dataset.hasToolboxListener = "true";
        console.log("[工具箱 Content.js] ⏱️ 影片時間軸監聽器首次綁定成功！");
    }
}



// 監聽 YouTube SPA 影片切换
window.addEventListener("yt-navigate-finish", init);
init();
