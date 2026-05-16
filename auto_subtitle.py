import os
import sys
import time
from datetime import timedelta

# 1. 處理便攜版 FFmpeg 的路徑（如果用戶透過 install.bat 安裝了便攜版）
ffmpeg_path = os.path.join(os.path.dirname(__file__), 'ffmpeg')
if os.path.exists(ffmpeg_path):
    os.environ["PATH"] += os.pathsep + ffmpeg_path

# 2. 引入隨後需要的套件
from faster_whisper import WhisperModel

def format_time(seconds):
    """將秒數轉換為 SRT 字幕的時間格式 (HH:MM:SS,mmm)"""
    td = timedelta(seconds=seconds)
    total_seconds = int(td.total_seconds())
    hours, remainder = divmod(total_seconds, 3600)
    minutes, seconds_flat = divmod(remainder, 60)
    milliseconds = int((td.total_seconds() - total_seconds) * 1000)
    return f"{hours:02d}:{minutes:02d}:{seconds_flat:02d},{milliseconds:03d}"

def generate_subtitles(video_path, language="zh"):
    """
    讀取 MP4 影片並根據硬件自動選擇本地離線模型生成 SRT 字幕（具備崩潰安全保護）
    """
    if not os.path.exists(video_path):
        print(f"❌ 錯誤：找不到影片檔案 {video_path}")
        return

    # 3. 硬件動態檢測與本地模型路徑分配
    import torch
    base_dir = os.path.dirname(__file__)
    
    if torch.cuda.is_available():
        device = "cuda"
        compute_type = "float16"  # GPU 專用加速模式
        model_path = os.path.join(base_dir, "whisper", "medium")
        print("🚀 [硬件適配] 檢測到 Nvidia GPU，已自動開啟 CUDA 硬件加速！")
        print(f"📂 [模型適配] 自動選用高品質模型：{model_path}")
    else:
        device = "cpu"
        compute_type = "int8"     # CPU 專用低記憶體量化模式，防止 Lag 機
        model_path = os.path.join(base_dir, "whisper", "small")
        print("🐌 [硬件適配] 未檢測到 GPU，將使用純 CPU 運行（已採取低記憶體優化模式）。")
        print(f"📂 [模型適配] 自動降級為輕量化模型：{model_path}")

    # 檢查本地模型目錄是否存在
    if not os.path.exists(model_path) or not os.listdir(model_path):
        print(f"❌ 錯誤：在 {model_path} 找不到模型文件！")
        print("請確保你已將 Hugging Face 下載的模型檔案放入該目錄中。")
        return

    print("📦 正在載入離線模型...")
    start_time = time.time()
    
    # 傳入本地模型資料夾的絕對路徑
    model = WhisperModel(model_path, device=device, compute_type=compute_type)
 

    # 4. 執行語音識別 (Generator 流式獲取)
    print(f"🎙️ 正在分析影片音訊：{os.path.basename(video_path)}")
    print("⏳ 正在讀取完整影片進行分析，請稍候...")
    
    segments, info = model.transcribe(
        video_path, 
        beam_size=5, 
        language="zh",            
        initial_prompt="以下係廣東話/粵語對話，請用香港繁體字書寫口語紀錄。", 
        # 💡 核心調整 1：徹底釋放被封印的符號與語氣詞（最關鍵！）
        suppress_tokens=None,  

        # 💡 核心調整 2：關閉片頭空白抑制，防止隨口的開頭詞被吞
        suppress_blank=False,  

        # 💡 核心調整 3：降低保守度，讓 AI 更大膽地輸出「不確定」的聲音
        temperature=0.0,       # 保持 0.0 確保準確，但配合下面的 threshold 降低門檻
        # 💡 核心優化 1：開啟上下文聯動，但限制溫度，讓 AI 記得前面說過話
        condition_on_previous_text=True,
        prompt_reset_on_temperature=0.5, # 👈 超過這個溫度就重置提示，防止陷入復讀機
        
        # 💡 核心優化 2：放寬 VAD 的語音檢測，防止稍微小聲或有背景音的對白被當成靜音砍掉
        vad_filter=True,  
        vad_parameters=dict(
            min_speech_duration_ms=200,   # 降低門檻：只要聲音持續 0.2 秒就當作有人說話
            max_speech_duration_s=10,     # 鐵腕限制：每句話最長 10 秒必須斷開，變成新的一行
            speech_pad_ms=400             # 在說話前後各擴展 0.4 秒緩衝，防止字頭字尾被切斷
        ),

        # 💡 核心優化 3：降低幻聽閾值，防止 AI 因為太嚴格而丟棄它「不確定」的對白
        no_speech_threshold=0.3,          # 只要靜音概率低於 40% 就強制識別，不漏字
        log_prob_threshold=-0.8,          # 放寬對聲音質量的要求
        
        # 💡 核心優化 4：限制單行字數
        max_new_tokens=50
    )

    print(f" Detected language: '{info.language}' (Probability: {info.language_probability:.2f})")
    print(f" Total audio duration: {info.duration:.2f} seconds")

    # 5. 寫入 SRT 字幕檔案（加入防中斷、即時刷入硬盤的安全保護機制）
    srt_filename = os.path.splitext(video_path)[0] + ".srt"
    print("📝 正在生成字幕文本...")
    
    saved_count = 0
    try:
        with open(srt_filename, "w", encoding="utf-8") as f:
            for index, segment in enumerate(segments, start=1):
                start_str = format_time(segment.start)
                end_str = format_time(segment.end)
                text = segment.text.strip()
                
                f.write(f"{index}\n")
                f.write(f"{start_str} --> {end_str}\n")
                f.write(f"{text}\n\n")
                
                # 💡 核心優化：每跑完一條就強制刷入硬盤，防止中途報錯時檔案變空白
                f.flush() 
                
                saved_count = index
                # 在終端機實時輸出看進度
                print(f"[{start_str} -> {end_str}] {text}")
                
        end_time = time.time()
        print("---" * 10)
        print(f"✅ 字幕完整生成完畢！總共處理了 {saved_count} 條字幕。")
        print(f"💾 儲存路徑: {srt_filename}")
        print(f"⏱️ 總共耗時: {end_time - start_time:.2f} 秒")

    except Exception as e:
        print("\n💥 [⚠️ 運行中途發生錯誤]：")
        print(f" 錯誤詳情: {e}")
        print(f"🛡️ [安全保護機制已啟動]：已為您緊急保存崩潰前生成的 {saved_count} 條字幕！")
        print(f"💾 殘余字幕已安全儲存至: {srt_filename}\n")
        print("請檢查您的電腦硬件狀態（如顯存/內存是否爆滿、顯卡過熱等）。")

if __name__ == "__main__":
    # 填入你要處理的 MP4 影片檔名或路徑
    VIDEO_FILE = "3EXJEtGqvU4.mp3" 
    
    # 執行字幕生成
    generate_subtitles(VIDEO_FILE, language="zh")