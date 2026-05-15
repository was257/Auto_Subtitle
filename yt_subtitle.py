import os
import sys
from yt_dlp import YoutubeDL
from auto_subtitle import generate_subtitles # 💡 直接復用你剛才寫好的完美版方法

def download_and_subtitle(youtube_url):
    print(f"🔗 正在分析 YouTube 鏈接: {youtube_url}")
    
    # 配置 yt-dlp：只下載音訊，節省時間
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': 'yt_download_audio.%(ext)s', # 暫存檔名
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp4', # 轉成 faster-whisper 喜歡的格式
        }],
    }
    
    with YoutubeDL(ydl_opts) as ydl:
        print("📥 正在從 YouTube 服務器秒速提取音訊流...")
        ydl.download([youtube_url])
    
    target_audio = "yt_download_audio.mp4"
    
    if os.path.exists(target_audio):
        print("🎉 音訊下載成功！現在交給本地 4060 顯卡 + Medium 模型處理...")
        # 💡 呼叫你優化好的普通話/廣東話繁體轉錄方法
        generate_subtitles(target_audio, language="zh")
        
        # 改名成更好看的名字
        os.rename("yt_download_audio.srt", "youtube_video.srt")
        print("✅ 搞掂！本地已生成 youtube_video.srt 字幕檔。")
    else:
        print("❌ 下載失敗。")

if __name__ == "__main__":
    # 測試一條你想看的 YouTube 網址
    URL = "https://www.youtube.com/watch?v=yE1CutI5vYk&t=938s" 
    download_and_subtitle(URL)