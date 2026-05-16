// 全局暫存
let extractedSrtContent = ""; 

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    checkMatchedLocalSrt();
    initActionButtons();
    initReaderEvents(); 
});

function initTabs() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.nav-item, .panel').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
            document.getElementById(item.dataset.target).classList.add('active');
        });
    });
}

async function checkMatchedLocalSrt() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !tab.url.includes("youtube.com/watch")) return;
    
    const urlParams = new URLSearchParams(new URL(tab.url).search);
    const videoId = urlParams.get('v');
    if (!videoId) return;

    const matchedContainer = document.getElementById('matched-srt-status');

    chrome.storage.local.get([videoId], (result) => {
        if (result[videoId]) {
            // 💥 核心改動：點擊下載 換成 專注閱讀
            matchedContainer.innerHTML = `🟢 已適配本地檔 <a href="#" id="link-read-matched" style="color:#28a745; font-weight:bold; text-decoration:underline;">[專注閱讀]</a>`;
            
            document.getElementById('link-read-matched').addEventListener('click', (e) => {
                e.preventDefault();
                // 將已匹配的 JSON 字幕數組還原成 SRT 字串
                const srtText = convertJsonToSrt(result[videoId]);
                
                // 將該影片 ID 與內容寫入快取，供 reading 頁面使用
                chrome.storage.local.set({ 
                    "current_reading_article": cleanSrtToArticle(srtText),
                    "current_reading_raw_srt": srtText,
                    "current_reading_video_id": videoId
                }, () => {
                    chrome.tabs.create({ url: chrome.runtime.getURL("reading.html") });
                });
            });
        } else {
            matchedContainer.innerHTML = `⚪ 暫無外掛本地字幕`;
        }
    });
}

function initActionButtons() {
    const output = document.getElementById('captions-output');
    const btnContainer = document.getElementById('action-buttons-container');

    // 點擊提取字幕
    document.getElementById('btn-read-captions').addEventListener('click', async () => {
        output.value = "正在讀取後台攔截到的字幕緩存...";
        btnContainer.style.display = "none"; 

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.url || !tab.url.includes("youtube.com/watch")) {
            output.value = "請在 YouTube 影片播放頁面使用此功能。";
            return;
        }

        const urlParams = new URLSearchParams(new URL(tab.url).search);
        const videoId = urlParams.get('v');
        if (!videoId) return;

        chrome.storage.local.get([`${videoId}_native`], (result) => {
            const nativeSrt = result[`${videoId}_native`];
            if (nativeSrt) {
                extractedSrtContent = nativeSrt;
                output.value = "【成功！】字幕已就緒，請選擇下方操作。";
                btnContainer.style.display = "flex"; // 緊湊佈局直接展現，不需滾動
            } else {
                output.value = `暫未獲取到字幕封包。\n\n💡 快速解決方法：\n請確認 YouTube 影片右下角的「CC」字幕已經開啟。如果剛開啟，請「重新整理網頁」讓後台進行自動抓取。`;
            }
        });
    });

    // 下載為 SRT
    document.getElementById('btn-download-srt').addEventListener('click', async () => {
        if (!extractedSrtContent) return;
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const urlParams = new URLSearchParams(new URL(tab.url).search);
        const videoId = urlParams.get('v') || "youtube_subtitle";
        downloadBlob(extractedSrtContent, `${videoId}.srt`);
    });
}

// ==========================================
// 💡 專注閱讀：全新標籤頁（Tab）彈出流
// ==========================================
function initReaderEvents() {
    const focusBtn = document.getElementById('btn-focus-read');

    focusBtn.addEventListener('click', async () => {
        if (!extractedSrtContent) return;

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const urlParams = new URLSearchParams(new URL(tab.url).search);
        const videoId = urlParams.get('v') || "unknown_video";

        const cleanText = cleanSrtToArticle(extractedSrtContent);
        
        // 存入清洗後文本、原始 SRT、以及當前影片 ID
        chrome.storage.local.set({ 
            "current_reading_article": cleanText,
            "current_reading_raw_srt": extractedSrtContent,
            "current_reading_video_id": videoId
        }, () => {
            chrome.tabs.create({ url: chrome.runtime.getURL("reading.html") });
        });
    });
}

/**
 * SRT 強力洗滌重組演算法
 */
function cleanSrtToArticle(srtData) {
    const blocks = srtData.replace(/\r\n/g, '\n').split('\n\n');
    let textLines = [];

    blocks.forEach(block => {
        const lines = block.split('\n');
        if (lines.length >= 3) {
            const content = lines.slice(2).join(' ').trim();
            if (content) textLines.push(content);
        }
    });

    let paragraphResult = "";
    for (let i = 0; i < textLines.length; i++) {
        paragraphResult += textLines[i] + "  ";
        if ((i + 1) % 6 === 0) { // 修改為每 6 句一個段落，更適合大螢幕排版
            paragraphResult += "\n\n";
        }
    }
    return paragraphResult || "字幕內容解析為空。";
}

// ==========================================
// 通用核心工具函數
// ==========================================
function downloadBlob(content, filename) {
    const blob = new Blob([content], { type: 'text/srt;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function convertJsonToSrt(subArray) {
    return subArray.map((sub, index) => {
        const formatTime = (totalSeconds) => {
            const hrs = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
            const mins = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
            const secs = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
            const msecs = Math.floor((totalSeconds % 1) * 1000).toString().padStart(3, '0');
            return `${hrs}:${mins}:${secs},${msecs}`;
        };
        return `${index + 1}\n${formatTime(sub.start)} --> ${formatTime(sub.end)}\n${sub.text}\n`;
    }).join('\n');
}

function parseSRT(data) {
    const srtParts = data.replace(/\r\n/g, '\n').split('\n\n');
    const result = [];
    srtParts.forEach(part => {
        const lines = part.split('\n');
        if (lines.length >= 3) {
            const timeLine = lines[1];
            const textLines = lines.slice(2).join(' ');
            const match = timeLine.match(/(\d+):(\d+):(\d+),(\d+)\s*-->\s*(\d+):(\d+):(\d+),(\d+)/);
            if (match) {
                const startSec = parseInt(match[1])*3600 + parseInt(match[2])*60 + parseInt(match[3]) + parseInt(match[4])/1000;
                const endSec = parseInt(match[5])*3600 + parseInt(match[6])*60 + parseInt(match[7]) + parseInt(match[8])/1000;
                result.push({ start: startSec, end: endSec, text: textLines });
            }
        }
    });
    return result;
}

// TAB 3 保持不變
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const uploadStatus = document.getElementById('upload-status');
if(dropzone) {
    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const urlParams = new URLSearchParams(new URL(tab.url).search);
        const videoId = urlParams.get('v');
        if (!videoId) {
            uploadStatus.innerText = "❌ 失敗：請在播放頁面上傳！";
            return;
        }
        const reader = new FileReader();
        reader.onload = function(evt) {
            chrome.storage.local.set({ [videoId]: parseSRT(evt.target.result) }, () => {
                uploadStatus.innerText = `✅ 已成功將該 SRT 綁定至當前影片！`;
                checkMatchedLocalSrt();
            });
        };
        reader.readAsText(file);
    });
}

// =============================================================
// --- 功能 2：設置字幕樣式 (儲存、即時套用與初始化回填) ---
// =============================================================
document.addEventListener("DOMContentLoaded", () => {
    // 🔔 步驟一：一打開 Popup，立刻去 storage 拿之前存過的值並回填到畫面上
    chrome.storage.local.get(["subtitle_style"], (res) => {
        if (res.subtitle_style) {
            const styles = res.subtitle_style;
            console.log("[工具箱 Popup.js] 📥 偵測到歷史樣式，開始回填畫面...", styles);

            // 1. 還原字體大小 (去掉 'px' 單位，以便填回純數字 input 裡面)
            if (styles.fontSize) {
                const pureSize = styles.fontSize.replace("px", "");
                const sizeInput = document.getElementById('style-size');
                if (sizeInput) sizeInput.value = pureSize;
            }

            // 2. 還原文字顏色
            const colorInput = document.getElementById('style-color');
            if (colorInput && styles.color) colorInput.value = styles.color;

            // 3. 還原背景顏色
            const bgInput = document.getElementById('style-bg');
            if (bgInput && styles.backgroundColor) bgInput.value = styles.backgroundColor;

            // 4. 還原背景透明度 (從 0~1 的浮點數 還原回 0~100 的百分比數字)
            const opacityInput = document.getElementById('style-bg-opacity');
            if (opacityInput && styles.opacity !== undefined) {
                opacityInput.value = Math.round(styles.opacity * 100);
            }

            // 5. 還原文字描邊/陰影
            const strokeInput = document.getElementById('style-stroke');
            if (strokeInput && styles.textShadow) strokeInput.value = styles.textShadow;
        } else {
            console.log("[工具箱 Popup.js] 📭 尚未有歷史樣式紀錄，使用 HTML 預設值。");
        }
    });

    // 🔔 步驟二：原本的點擊保存事件 (完美與最新 content.js 數據結構對齊)
    const saveStyleBtn = document.getElementById('btn-save-style');
    if (saveStyleBtn) {
        saveStyleBtn.addEventListener('click', () => {
            const sizeValue = document.getElementById('style-size').value || "26";
            const colorValue = document.getElementById('style-color').value || "#ffffff";
            const bgValue = document.getElementById('style-bg').value || "#000000";
            const opacityValue = document.getElementById('style-bg-opacity').value || "60";
            const strokeValue = document.getElementById('style-stroke').value || "2px 2px 4px #000";

            const styleSettings = {
                fontSize: sizeValue + 'px',
                color: colorValue,
                backgroundColor: bgValue,
                opacity: parseFloat(opacityValue) / 100,
                textShadow: strokeValue
            };

            // 存入本地，Content Script 會自動監聽並即時更新
            chrome.storage.local.set({ "subtitle_style": styleSettings }, () => {
                console.log("[工具箱 Popup.js] 💾 樣式已保存:", styleSettings);
                alert("樣式已成功保存並應用！");
            });
        });
    }
});