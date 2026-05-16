// ==========================================
// 1. 監聽 YouTube 字幕網絡請求 (加入防重入安全機制)
// ==========================================
chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
        const url = details.url;
        
        // 💥 關鍵防禦 1：如果是插件自己發出的 fetch 請求，絕對不要攔截，直接放行！
        if (url.includes("extractedByPlugin=true")) {
            return; 
        }

        // 確保這是 YouTube 的字幕數據包
        if (url.includes("youtube.com/api/timedtext") && !url.includes("&format=srt")) {
            
            // 透過 URL 參數提取當前影片的 Video ID
            const urlObj = new URL(url);
            let videoId = urlObj.searchParams.get("v");
            
            if (!videoId) {
                chrome.tabs.get(details.tabId, (tab) => {
                    if (tab && tab.url) {
                        const tabUrlObj = new URL(tab.url);
                        videoId = tabUrlObj.searchParams.get("v");
                        if (videoId) {
                            fetchAndCacheSubtitle(url, videoId);
                        }
                    }
                });
            } else {
                fetchAndCacheSubtitle(url, videoId);
            }
        }
    },
    { urls: ["*://*.youtube.com/api/timedtext*"] }
);

/**
 * 安全 Fetch 函數
 */
function fetchAndCacheSubtitle(url, videoId) {
    // 💥 關鍵防禦 2：在請求的網址後面強制加上「密碼標籤」，告訴監聽器這是自己人
    const separator = url.includes("?") ? "&" : "?";
    const secureUrl = url + separator + "extractedByPlugin=true";

    console.log(`[工具箱後台] 攔截到影片 ${videoId}，發起防無限迴圈安全請求...`);

    fetch(secureUrl, {
        method: "GET",
        mode: "cors",
        credentials: "include", 
        headers: {
            "Accept": "*/*",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
    })
    .then(response => {
        if (!response.ok) throw new Error(`HTTP 錯誤! 狀態碼: ${response.status}`);
        return response.text(); 
    })
    .then(rawSubtitleData => {
        const srtFormatted = convertYoutubeRawToSrt(rawSubtitleData);
        if (srtFormatted) {
            chrome.storage.local.set({ [`${videoId}_native`]: srtFormatted }, () => {
                console.log(`[工具箱後台] 🎉 影片 ${videoId} 原始字幕快取成功！`);
            });
        }
    })
    .catch(err => {
        console.error("[工具箱後台] ❌ 讀取字幕流失敗 (防重入後仍報錯):", err);
    });
}

/**
 * 簡易 YouTube 原始字幕轉 SRT 輔助解析器 (JSON 格式)
 */
function convertYoutubeRawToSrt(rawData) {
    try {
        const json = JSON.parse(rawData);
        if (!json.events) return null;
        
        let srtResult = "";
        let counter = 1;
        
        json.events.forEach(event => {
            if (!event.segs || event.segs.length === 0) return;
            
            const text = event.segs.map(s => s.utf8).join("").trim();
            if (!text || text === "\n") return;
            
            const startMs = event.tStartMs;
            const durationMs = event.dDurationMs || 2000;
            const endMs = startMs + durationMs;
            
            const formatTime = (ms) => {
                const totalSecs = Math.floor(ms / 1000);
                const hrs = Math.floor(totalSecs / 3600).toString().padStart(2, '0');
                const mins = Math.floor((totalSecs % 3600) / 60).toString().padStart(2, '0');
                const secs = Math.floor(totalSecs % 60).toString().padStart(2, '0');
                const msecs = (ms % 1000).toString().padStart(3, '0');
                return `${hrs}:${mins}:${secs},${msecs}`;
            };
            
            srtResult += `${counter}\n${formatTime(startMs)} --> ${formatTime(endMs)}\n${text}\n\n`;
            counter++;
        });
        
        return srtResult;
    } catch (e) {
        return convertXmlToSrt(rawData);
    }
}

/**
 * XML 字幕轉 SRT 備用解析器
 */
function convertXmlToSrt(xmlData) {
    const regex = /<text start="([\d.]+)" dur="([\d.]+)".*?>([\s\S]*?)<\/text>/g;
    let match;
    let srtResult = "";
    let counter = 1;

    const formatTime = (totalSeconds) => {
        const hrs = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
        const mins = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
        const secs = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
        const msecs = Math.floor((totalSeconds % 1) * 1000).toString().padStart(3, '0');
        return `${hrs}:${mins}:${secs},${msecs}`;
    };

    while ((match = regex.exec(xmlData)) !== null) {
        const start = parseFloat(match[1]);
        const dur = parseFloat(match[2]);
        const end = start + dur;
        let text = match[3]
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>');

        if (text.trim()) {
            srtResult += `${counter}\n${formatTime(start)} --> ${formatTime(end)}\n${text.trim()}\n\n`;
            counter++;
        }
    }
    return srtResult || null;
}


// ==========================================
// 2. 即時編輯保存 - 熱更新轉發中心
// ==========================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "NOTIFY_SUBTITLE_UPDATE") {
        const targetVideoId = message.videoId;
        
        console.log(`[工具箱後台] 收到字幕更新通知，開始同步搜尋影片 ID: ${targetVideoId} 的分頁...`);
        
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                if (tab.url && tab.url.includes(`v=${targetVideoId}`)) {
                    chrome.tabs.sendMessage(tab.id, {
                        action: "REFRESH_SUBTITLES",
                        subtitles: message.subtitles
                    }, (response) => {
                        if (chrome.runtime.lastError) { /* quiet */ }
                    });
                }
            });
        });
        sendResponse({ status: "success" });
    }
    return true; 
});