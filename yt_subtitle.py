import os
import sys
from yt_dlp import YoutubeDL
from auto_subtitle import generate_subtitles # 💡 直接復用你剛才寫好的完美版方法

def download_and_subtitle(youtube_url):
    print(f"🔗 正在分析 YouTube 鏈接: {youtube_url}")
    
    # 1. 先提取影片資訊以獲取 videoId
    with YoutubeDL({'quiet': True}) as ydl:
        try:
            info_dict = ydl.extract_info(youtube_url, download=False)
            video_id = info_dict.get('id', 'unknown_id')
        except Exception as e:
            print(f"❌ 無法解析影片資訊: {e}")
            return

    # 定義基於 videoId 的音訊與字幕檔名
    # 這裡使用 m4a 格式（本質上就是 mp4 容器的純音訊，Whisper 完美支援）
    target_audio = f"{video_id}.m4a"
    target_srt = f"{video_id}.srt"
    
    # 2. 配置 yt-dlp：下載音訊並轉碼
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': f"{video_id}.%(ext)s", 
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',  # 👈 改成 wav（或 mp3）
        }],
    }
    
    with YoutubeDL(ydl_opts) as ydl:
        print(f"📥 正在從 YouTube 服務器提取音訊流 (Video ID: {video_id})...")
        ydl.download([youtube_url])
    
    # 3. 檢查檔案並執行轉錄
    if os.path.exists(target_audio):
        print(f"🎉 音訊下載成功 ({target_audio})！現在交給本地模型處理...")
        
        # 💡 呼叫你的轉錄方法
        # 注意：請確保你的 generate_subtitles 輸出的檔名能對應
        # 如果你的 generate_subtitles 預設產生同名的 .srt 檔（例如輸入 a.m4a 輸出 a.srt）：
        generate_subtitles(target_audio, language="zh")
        
        # 如果你的 generate_subtitles 固化了輸出檔名為 "yt_download_audio.srt"，
        # 則需要取消註釋下面這兩行來手動改名：
        # if os.path.exists("yt_download_audio.srt"):
        #     os.rename("yt_download_audio.srt", target_srt)
            
        print(f"✅ 搞掂！本地已生成 {target_srt} 字幕檔。")
    else:
        print("❌ 下載失敗，找不到音訊檔案。")

if __name__ == "__main__":
    # 測試一條你想看的 YouTube 網址
    URL = "https://www.youtube.com/watch?v=3EXJEtGqvU4&t=10s" 
    download_and_subtitle(URL)