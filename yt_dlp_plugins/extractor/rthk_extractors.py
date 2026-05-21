import re
from yt_dlp.extractor.common import InfoExtractor
from yt_dlp.utils import clean_html

# 👑 1. 繼承 InfoExtractor 基類
class RTHKCultureIE(InfoExtractor):
    """專門解析香港電台（RTHK）中華五千年專題嘅自定義解析器"""
    
    # 👑 1. 明確宣告 IE_NAME，這會影響 ie_key() 的預設生成
    IE_NAME = 'RTHKCulture' 
    _VALID_URL = r'.*?https?://(?:www\.)?rthk\.hk/chiculture/fivethousandyears/.*'

    # 👑 2. 為了保險起見，我們直接重寫 ie_key 方法，確保它返回的名字乾乾淨淨
    @classmethod
    def ie_key(cls):
        """強行指定 yt-dlp 識別這個 Extractor 的唯一 Key"""
        return 'RTHKCulture'
        
    _TESTS = [{
        'url': 'https://www.rthk.hk/chiculture/fivethousandyears/comics/comics_legend_004.htm',
        'only_matching': True,
    }]

    @classmethod
    def suitable(cls, url):
        """Receives a URL and returns True if suitable for this IE."""
        # This function must import everything it needs (except other extractors),
        # so that lazy_extractors works correctly
        return cls._match_valid_url(url) is not None

    # 3. 重寫核心解析方法
    def _real_extract(self, url):
        # 自動根據 _VALID_URL 提取影片 ID（呢度可以用網址最後個名當 ID）
        video_id = url.split('/')[-1].split('.')[0]
        
        # ─── 後台自動抓取網頁原始碼 ───
        # InfoExtractor 內建咗 _download_webpage 方法，會自動處理 User-Agent、Cookie 同編碼
        webpage = self._download_webpage(url, video_id)

        # ─── 核心抓取邏輯（重寫部分） ───
        # 用正則在網頁原始碼入面刨出真實嘅媒體路徑 (.mp4 或 .mp3)
        # 根據 RTHK 結構，通常可以用正則撈出相對或絕對路徑
        media_url_match = re.search(r'["\']([^"\']+\.(?:mp4|mp3|m4a))["\']', webpage)
        
        if not media_url_match:
            # 萬一找不到，嘗試撈相對路徑並補全
            relative_match = re.search(r'href=["\'](/[^\s"\']+\.(?:mp4|mp3|m4a))["\']', webpage)
            if relative_match:
                real_media_url = "https://www.rthk.hk" + relative_match.group(1)
            else:
                raise Exception("❌ 唔好意思，在此 RTHK 網頁內找不到任何媒體串流路徑")
        else:
            real_media_url = media_url_match.group(1)
            if not real_media_url.startswith('http'):
                real_media_url = "https://www.rthk.hk" + real_media_url

        # ─── 抓取影片標題 ───
        # InfoExtractor 內建咗 _html_search_regex，可以方便地抓取 HTML 標籤內嘅文字
        title = self._html_search_regex(
            r'<title>(.*?)</title>', webpage, 'title', default=video_id
        )
        title = clean_html(title).replace("香港電台", "").strip()

        # ─── 4. 回傳標準的 yt-dlp 數據字典 ───
        # 只要結構符合標準，yt-dlp 就會自動幫你接手下載、命名、甚至轉碼！
        return {
            'id': video_id,
            'title': title,
            'url': real_media_url,
            'ext': real_media_url.split('.')[-1], # 自動識別是 mp4 還是 mp3
        }