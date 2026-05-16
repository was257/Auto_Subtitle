# 📖 YouTube 字幕校正與專注閱讀工具箱 (YouTube Subtitle Focus Reader & Editor)

一款專為高效學習者與影音創作者打造的 Chrome 擴充功能。本工具能一鍵攔截並提取 YouTube 影片的原生字幕，提供**全螢幕沉浸式閱讀分頁**，並內建 **SRT 即時雙模編輯器**。

當你在閱讀分頁中校正錯字並點擊保存後，YouTube 播放網頁的客製化字幕將**一微秒內無縫熱更新**，完全不需要重新整理網頁！

---

## ✨ 核心特色

* 🚀 **網頁原生字幕攔截**：自動偵測並異步快取 YouTube 封包（支援 JSON/XML），一鍵提取。
* ⚡ **黃金比例極簡佈局**：Popup 面板空間優化，操作按鈕並排緊湊，完全不需滾動滑鼠。
* 📖 **全螢幕專注閱讀模式**：獨立 Tab 分頁開啟，時間軸全蒸發，字體自由放大縮小，切換分頁狀態絕不丟失。
* ✍️ **SRT 雙模實時編輯器**：一秒切換原始 SRT 時間軸代碼與整潔文字，支援本地適配檔回存。
* 🔄 **無縫數據熱更新**：編輯頁面點擊「保存到插件」後，透過 Message Passing 機制讓 YouTube 影片字幕即時同步更換。
* 📂 **本地 SRT 檔案綁定**：支援拖放上傳本地 SRT 檔案，精準與特定 YouTube 影片 ID 進行動態綁定。

---

## 🛠️ 技術架構

本專案基於 **Chrome Extension Manifest V3** 標準開發，並搭配 Python 運算後台。

* `manifest.json`：擴充功能核心設定檔（配置 webRequest、storage 與主控權限）。
* `background.js`：後台 Service Worker。負責安全攔截字幕網絡請求（內建防無限迴圈重入機制），並作為訊息轉發中心。
* `content.js`：注入 YouTube 網頁的腳本。負責客製化字幕的時序渲染 DOM（`#toolbox-subtitle-layer`）與熱更新監聽。
* `popup.html / .js`：插件彈出視窗。極簡緊湊佈局，負責提取快取與引導跳轉。
* `reading.html / .js`：獨立的沉浸式閱讀與編輯工作站。
* `auto_subtitle.py`：本地 Python 輔助伺服器（執行時會產生 `__pycache__` 快取以優化啟動速度）。

---

## 📦 安裝與使用說明

### 1. 安裝 Chrome 插件
1. 下載本專案原始碼至本地電腦。
2. 開啟 Google Chrome 瀏覽器，導向至 `chrome://extensions/`。
3. 開啟右上角的**「開發者模式」 (Developer mode)**。
4. 點擊左上角**「載入解壓縮擴充功能」 (Load unpacked)**，並選擇本專案的資料夾。

### 2. 啟動 Python 後台（如適用）
```bash
run.bat
/or/
python auto_subtitle.py

---



🤝
Gemini 3 flash  / AI Collaborator
> **"Great tools are born from the collision of human creativity and AI execution."**
