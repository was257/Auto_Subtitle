let currentFontSize = 18;
let isEditMode = false; // 當前是否為編輯模式
let currentVideoId = "";

document.addEventListener('DOMContentLoaded', () => {
    const contentArea = document.getElementById('article-content');
    const srtEditor = document.getElementById('srt-editor');
    const titleArea = document.getElementById('reader-title');
    
    // 按鈕群
    const toggleModeBtn = document.getElementById('btn-toggle-mode');
    const zoomInBtn = document.getElementById('btn-zoom-in');
    const zoomOutBtn = document.getElementById('btn-zoom-out');
    const savePluginBtn = document.getElementById('btn-save-plugin');
    const downloadSrtBtn = document.getElementById('btn-download-srt');

    // 1. 初始化資料載入
    chrome.storage.local.get(["current_reading_article", "current_reading_raw_srt", "current_reading_video_id"], (result) => {
        currentVideoId = result.current_reading_video_id || "unknown";
        
        if (result.current_reading_article) {
            contentArea.innerText = result.current_reading_article;
        } else {
            contentArea.innerText = "未找到閱讀內容，請返回影片頁面重新提取。";
        }

        if (result.current_reading_raw_srt) {
            srtEditor.value = result.current_reading_raw_srt;
        }
    });

    // 2. 雙模式切換核心邏輯
    toggleModeBtn.addEventListener('click', () => {
        isEditMode = !isEditMode;

        if (isEditMode) {
            // 進入編輯模式
            titleArea.innerText = "✍️ 原始 SRT 編輯模式";
            toggleModeBtn.innerText = "📖 返回專注閱讀";
            
            contentArea.style.display = "none";
            zoomInBtn.style.display = "none";
            zoomOutBtn.style.display = "none";
            
            srtEditor.style.display = "block";
            savePluginBtn.style.display = "inline-block";
            downloadSrtBtn.style.display = "inline-block";
        } else {
            // 回到閱讀模式 (即時將編輯器改動的內容洗淨同步)
            titleArea.innerText = "📖 專注閱讀模式";
            toggleModeBtn.innerText = "✍️ 切換為編輯 SRT";
            
            // 即時重新洗滌文字
            const updatedCleanText = cleanSrtToArticle(srtEditor.value);
            contentArea.innerText = updatedCleanText;

            srtEditor.style.display = "none";
            savePluginBtn.style.display = "none";
            downloadSrtBtn.style.display = "none";
            
            contentArea.style.display = "block";
            zoomInBtn.style.display = "inline-block";
            zoomOutBtn.style.display = "inline-block";
        }
    });

    // 3. 放大與縮小字體
    zoomInBtn.addEventListener('click', () => {
        if (currentFontSize < 36) {
            currentFontSize += 2;
            contentArea.style.fontSize = currentFontSize + 'px';
        }
    });
    zoomOutBtn.addEventListener('click', () => {
        if (currentFontSize > 14) {
            currentFontSize -= 2;
            contentArea.style.fontSize = currentFontSize + 'px';
        }
    });

    // 4. 編輯模式：保存到插件 (直接覆蓋或新增該影片的適配檔，並立即同步網頁)
    savePluginBtn.addEventListener('click', () => {
        const editedSrtText = srtEditor.value;
        if (!editedSrtText.trim()) return;

        if (currentVideoId === "unknown" || !currentVideoId) {
            alert("⚠️ 無法獲取當前影片 ID，保存失敗。");
            return;
        }

        // 解析最新修改過的 SRT，包裝成插件物件陣列
        const parsedSubtitles = parseSRT(editedSrtText);
        
        // 核心同步：存入本地資料庫
        chrome.storage.local.set({ [currentVideoId]: parsedSubtitles }, () => {
            
            // 🔥【全新黑科技】：保存成功後，立刻向後台發送即時同步信號
            chrome.runtime.sendMessage({
                action: "NOTIFY_SUBTITLE_UPDATE",
                videoId: currentVideoId,
                subtitles: parsedSubtitles
            }, (response) => {
                alert(`💾 字幕校正成功！\n資料已存入插件，且已「即時更新」到 YouTube 播放網頁中，不需重新整理網頁！`);
            });

        });
    });

    // 5. 編輯模式：下載為 SRT 檔案
    downloadSrtBtn.addEventListener('click', () => {
        const editedSrtText = srtEditor.value;
        if (!editedSrtText.trim()) return;

        const blob = new Blob([editedSrtText], { type: 'text/srt;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentVideoId}_edited.srt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
});

/**
 * 輔助工具：SRT洗滌重組演算法
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
        if ((i + 1) % 6 === 0) {
            paragraphResult += "\n\n";
        }
    }
    return paragraphResult || "（編輯框內無有效字幕內容）";
}

/**
 * 輔助工具：SRT 轉成 插件物件陣列
 */
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