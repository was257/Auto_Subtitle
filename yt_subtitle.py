import os
import sys
from yt_dlp import YoutubeDL
from auto_subtitle import generate_subtitles # 💡 直接復用你剛才寫好的完美版方法

def media_read(url):
    ydl_opts = {
        'quiet': True,
    }
    with YoutubeDL(ydl_opts) as ydl:
        try:
            info_dict = ydl.extract_info(url ,download=False)
            video_id = info_dict.get('id', 'unknown_id')
            print(video_id)
        except Exception as e:
            print(f"❌ 無法解析影片資訊: {e}")
            return

def download_and_subtitle(youtube_url):
    print(f"🔗 正在分析 YouTube 鏈接: {youtube_url}")

    extract_opts = {
        'quiet': True,
        'noplaylist': True, 
    }
    
    # 1. 先提取影片資訊以獲取 videoId
    with YoutubeDL(extract_opts) as ydl:
        try:
            info_dict = ydl.extract_info(youtube_url, download=False)
            if 'entries' in info_dict:
                # 拿取清單中的第一條影片
                video_info = info_dict['entries'][0]
                video_id = video_info.get('id', 'unknown_id')
            else:
                # 普通的單一影片網址
                video_id = info_dict.get('id', 'unknown_id')
        except Exception as e:
            print(f"❌ 無法解析影片資訊: {e}")
            return

    # 定義基於 videoId 的音訊與字幕檔名
    # 這裡使用 m4a 格式（本質上就是 mp4 容器的純音訊，Whisper 完美支援）
    target_audio = f"{video_id}.mp3"
    target_srt = f"{video_id}.srt"
    
    # 2. 配置 yt-dlp：下載音訊並轉碼
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': f"{video_id}.%(ext)s", 
        'noplaylist': True,  # 👈 確保下載時不會把整條 list 擸埋落嚟
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
        generate_subtitles(target_audio, language="zh")
         
            
        print(f"✅ 搞掂！本地已生成 {target_srt} 字幕檔。")
    else:
        print("❌ 下載失敗，找不到音訊檔案。")


if __name__ == "__main__":
    # 測試一條你想看的 YouTube  網址
    #URL = "https://www.rthk.hk/radio/radio5/programme/culture_5000years/episode/1088741" 
    #URL = "https://www.rthk.hk/chiculture/fivethousandyears/comics/comics_legend_004.htm"
    URL = "https://www.youtube.com/watch?v=E5LAGEj-6AA&list=PLjYsL-4iEERWhsuRC8Ti1_31Jw2qOeIJF"
    #media_read(URL)
    download_and_subtitle(URL)