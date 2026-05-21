import os

def srt_to_lrc(srt_path, lrc_path):
    with open(srt_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    lrc_lines = []
    current_time = ""
    current_text = []

    for line in lines:
        line = line.strip()
        
        # 1. 跳過純數字的序號行
        if line.isdigit():
            continue
            
        # 2. 匹配時間軸行 (尋找 SRT 特有的 --> 箭頭)
        if "-->" in line:
            # 只要前半段的開始時間，例如 "00:01:23,456"
            start_time = line.split("-->")[0].strip()
            
            # 切分出 時:分:秒,毫秒
            h, m, s_ms = start_time.split(":")
            s, ms = s_ms.split(",")
            
            # 將小時換算成分鐘，轉為 LRC 格式 [MM:SS.xx]
            total_minutes = int(h) * 60 + int(m)
            # LRC 通常毫秒只取兩位（xx），所以把 3 位的 456 變成 2 位的 45
            short_ms = ms[:2] 
            
            current_time = f"[{total_minutes:02d}:{s}.{short_ms}]"
            current_text = [] # 清空緩存，準備接下面的文本
            
        # 3. 如果既不是序號也不是時間軸，且不為空，那就是對白文本
        elif line and current_time:
            current_text.append(line)
            
        # 4. 當遇到空行，代表這一個字幕塊結束了，打包寫入
        elif not line and current_time and current_text:
            combined_text = " ".join(current_text)
            lrc_lines.append(f"{current_time}{combined_text}")
            current_time = "" # 重置

    # 處理結尾可能沒有空行包裹的最後一句
    if current_time and current_text:
        combined_text = " ".join(current_text)
        lrc_lines.append(f"{current_time}{combined_text}")

    # 寫入 LRC 文件
    with open(lrc_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lrc_lines))

# 🛠️ 文件路徑設定
srt_file = r"D:\Cursor\autosubtitle\1088741.srt"  # 👈 改成你真正的 SRT 文件名
lrc_file = srt_file.replace('.srt', '.lrc')

if os.path.exists(srt_file):
    srt_to_lrc(srt_file, lrc_file)
    print(f"🎉 轉換成功！已生成: {lrc_file}")
else:
    print(f"❌ 找不到文件: {srt_file}")