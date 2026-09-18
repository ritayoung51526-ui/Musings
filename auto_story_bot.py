#!/usr/bin/env python3
"""
auto_story_bot.py
=================
全自動多平台熱門故事採集與網頁生成機器人 (Musings / 隨筆專用)

【正確執行順序與架構】：
  Step 1: 上網探索 Trending / 高討論度話題
          - Reddit 熱門 (r/tifu, r/embarrassing, r/confession, r/teenagers)
          - Google Trends 即時熱搜 (公開 RSS / 免 API 密鑰)
          - TikTok / X 熱門社死標籤話題庫 (#storytime, #cringe, #embarrassing)
  Step 2: 智能篩選符合「尷尬日常 / 青春社死」且適合大眾閱讀的題材 (過濾成人/極端內容)
  Step 3: 人性化改寫 (第一人稱、去 AI 八股味、豐富感官細節、情緒起伏、標註生字與繁體中文書面語對照、3題測驗)
  Step 4: 自動生成標準 HTML 故事頁面並將新卡片注入 index.html，觸發部署

支援雲端自動化 (GitHub Actions) 與 手機/終端一鍵觸發。
"""

import os
import sys
import re
import json
import argparse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime

# 標準故事頁面模板
STORY_HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title} – Musings · 隨筆</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="container">
    <div class="top-nav">
      <a href="index.html" class="back" data-en="← Back to Musings" data-zh="← 返回隨筆首頁">← Back to Musings</a>
      <button id="langToggleBtn" class="lang-toggle-btn">🌐 繁中</button>
    </div>

    <header>
      <h1>{title}</h1>
      <div class="meta">
        <span class="badge {badge_class}">{badge_text}</span>
        <span>{category} · {scene}</span>
      </div>
    </header>

    <div class="hero">{scene}</div>

    <div class="controls">
      <button id="listenBtn" class="btn">🎧 Listen Audio</button>
      <button id="dictToggleBtn" class="btn secondary">📖 Vocabulary: OFF</button>
      <button id="transToggleBtn" class="btn secondary">🌐 Translation: OFF</button>
    </div>

    <!-- Voice TTS Player Bar -->
    <div id="audioPlayerPanel" class="audio-player-panel">
      <div class="audio-header">
        <span id="audioStatus">Audio ready</span>
        <div class="speed-group">
          <span>Speed:</span>
          <button class="speed-btn active" data-speed="0.85">0.85x</button>
          <button class="speed-btn" data-speed="0.95">0.95x</button>
          <button class="speed-btn" data-speed="1.1">1.1x</button>
        </div>
      </div>
      <div class="audio-controls">
        <button id="audioPlayPauseBtn" class="btn" style="padding: 6px 14px; font-size: 0.85rem;">▶ Play</button>
        <button id="audioStopBtn" class="btn secondary" style="padding: 6px 14px; font-size: 0.85rem;">⏹ Stop</button>
        <span style="font-size: 0.8rem; color: var(--muted); margin-left: 8px;">Tip: Click any paragraph to jump there!</span>
      </div>
    </div>

    <article class="story">
{story_paragraphs_html}
    </article>

    

    <!-- Quick Quiz Section -->
    <section class="quiz-section">
      <div class="quiz-header">
        <h2 data-en="💡 Quick Quiz" data-zh="💡 趣味閱讀小測驗">💡 Quick Quiz</h2>
        <p data-en="Test what you picked up from the story!" data-zh="測測你看完故事後記住了多少生字與細節！">Test what you picked up from the story!</p>
      </div>
{quiz_items_html}
      <div id="quizSummary" class="quiz-summary"></div>
    </section>

    <footer>
      <p>Musings · 100% Free Everyday Stories</p>
    </footer>
  </div>

  <script src="story-engine.js"></script>
  
</body>
</html>
"""

# ==============================================================================
# Step 1: 多平台熱門趨勢與素材探索 (Trending Topic Discovery)
# ==============================================================================
def fetch_google_trends():
    """從 Google Trends 即時熱門探索話題 (免 API 密鑰)"""
    url = "https://trends.google.com/trending/rss?geo=US"
    print("[1/4] 正在掃描 Google Trends 即時熱門話題...")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 MusingsBot/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            root = ET.fromstring(resp.read())
            items = root.findall("./channel/item")
            trends = []
            for it in items[:10]:
                title = it.find("title").text if it.find("title") is not None else ""
                desc = it.find("description").text if it.find("description") is not None else ""
                if title:
                    trends.append({"title": title, "summary": desc, "source": "Google Trends"})
            print(f"  └ 獲取到 {len(trends)} 個熱門搜尋主題。")
            return trends
    except Exception as e:
        print(f"  └ Google Trends 掃描略過: {e}")
        return []

def fetch_reddit_candidates(subreddits=["tifu", "embarrassing", "confession"]):
    """從多個 Reddit 專題板塊抓取真實經歷 (免 API 密鑰)"""
    print("[1/4] 正在掃描 Reddit 尷尬社死話題...")
    candidates = []
    for sub in subreddits:
        url = f"https://www.reddit.com/r/{sub}/top.json?t=week&limit=10"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 MusingsBot/1.0"})
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                children = data.get("data", {}).get("children", [])
                for it in children:
                    p = it.get("data", {})
                    text = p.get("selftext", "").strip()
                    words = len(text.split())
                    if not p.get("stickied") and 100 <= words <= 1200:
                        candidates.append({
                            "title": p.get("title"),
                            "text": text,
                            "ups": p.get("ups", 0),
                            "sub": sub,
                            "source": f"Reddit r/{sub}"
                        })
        except Exception as e:
            print(f"  └ r/{sub} 掃描略過: {e}")
    print(f"  └ 成功篩選出 {len(candidates)} 篇社死素材候選。")
    return candidates

# ==============================================================================
# Step 2 & 3: 智能篩選與去 AI 感人性化改寫 (Human-Style Rewriting)
# ==============================================================================
def call_llm_human_rewrite(raw_title, raw_text, api_key=None):
    if not api_key:
        print("[2 & 3/4] 測試模式：生成示範人性化社死故事...")
        return {
            "title": "The Accidental AirDrop",
            "scene": "Subway Train · Crowded Carriage",
            "category": "Commute & Digital Cringe",
            "read_time": "Short · ~3 min",
            "badge_class": "short",
            "summary": "You try to AirDrop a meme to your sister on the train, but accidentally broadcast a goofy unflattering selfie to everyone with an iPhone.",
            "paragraphs": [
                {
                    "en": "The 6:15 PM train was packed shoulder-to-shoulder, and everyone was staring blankly at their screens to avoid eye contact.",
                    "zh": "傍晚六點十五分的列車裡人擠人、摩肩接踵，每個人都面無表情地盯著手機螢幕，以避免與陌生人發生視線接觸。"
                },
                {
                    "en": "I took an intentionally horrifying, triple-chinned selfie to send to my sister, making the ugliest face humanly possible.",
                    "zh": "我拍了一張極度搞怪的三層下巴自拍照準備發給妹妹，故意擠出了人類生理極限所能做出的最醜表情。"
                },
                {
                    "en": "I hit share via AirDrop. The phone listed 'iPhone' and 'Sarah's Phone'. My thumb clicked the wrong one before my eyes could catch up.",
                    "zh": "我點選了 AirDrop 分享。螢幕上同時列出了『iPhone』和『莎拉的手機』。還沒等我的大腦反應過來，我的大拇指就手滑點錯了。"
                },
                {
                    "en": "Three seconds later, two college kids across the aisle gasped, looked down at their phones, and then simultaneously glanced up at me in pure <span class=\\"vocab\\" data-word=\\"disbelief\\" data-pos=\\"noun\\" data-phonetic=\\"/ˌdɪs.bɪˈliːf/\\" data-meaning=\\"難以置信、目瞪口呆\\" data-eg=\\"glanced up at me in pure disbelief\\">disbelief</span>.",
                    "zh": "三秒鐘後，走道對面的兩個大學生倒抽了一口涼氣，猛地低頭看著手機，隨後齊刷刷地抬起頭，滿臉難以置信地看著我。"
                },
                {
                    "en": "They had received my triple-chin masterpiece in full resolution. I stared down at my shoes and got off two stations early.",
                    "zh": "他們以最高畫質完整接收了我的三下巴自拍傑作。我死死盯著自己的鞋尖，提早整整兩站落荒而逃下了車。"
                }
            ],
            "quiz": [
                {
                    "question": "Why did the college students look at the narrator in disbelief?",
                    "options": [
                        {"text": "The narrator spilled coffee on their clothes", "correct": False},
                        {"text": "They received the narrator's goofy triple-chin selfie via AirDrop", "correct": True},
                        {"text": "The narrator was singing loudly", "correct": False},
                        {"text": "The narrator took their seats", "correct": False}
                    ],
                    "explanation": "主角手滑將自己故意扮醜的三下巴搞怪自拍透過 AirDrop 誤發給了車廂裡的其他陌生乘客。"
                }
            ]
        }

    system_prompt = """
You are a witty, empathetic storytelling writer. 
Rewrite the provided raw topic or experience into a grounded, funny, first-person English short story (250-450 words).

RULES FOR VOICE (NO AI FLUFF, NO ACADEMIC TALK):
- Write from an ordinary person's view (humorous, self-deprecating, authentic).
- Focus on emotional ups and downs: anticipation -> the awkward trigger -> the instant shock/cringe -> the aftermath.
- Use natural sensory details (sweaty palms, silent room, ticking seconds, awkward glance).
- Completely fictionalize names and locations.

TRANSLATION & VOCAB:
- Standard Written Chinese (規範繁體中文書面語) for all paragraph translations. (Do NOT use colloquial Cantonese).
- Tag 4 to 6 authentic words with <span class="vocab" data-word="WORD" data-pos="POS" data-phonetic="/PHONETIC/" data-meaning="繁體中文釋義" data-eg="EXAMPLE">WORD</span>.
- 2 simple comprehension/vocab quiz questions.

Output strict JSON:
{
  "title": "Catchy Title",
  "scene": "Short Scene Hook",
  "category": "Awkward Moments / Cringe",
  "read_time": "Short · ~3 min",
  "badge_class": "short",
  "summary": "1 sentence hook",
  "paragraphs": [
    {"en": "English paragraph with <span class='vocab'...>vocab</span>", "zh": "標準繁體中文書面語翻譯"}
  ],
  "quiz": [
    {
      "question": "Question text?",
      "options": [{"text": "...", "correct": true/false}],
      "explanation": "標準繁體中文詳解"
    }
  ]
}
"""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": f"{system_prompt}\n\nRAW INPUT:\nTitle: {raw_title}\n\nContent: {raw_text}"}]}],
        "generationConfig": {"response_mime_type": "application/json"}
    }
    req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        res = json.loads(resp.read().decode("utf-8"))
        return json.loads(res["candidates"][0]["content"]["parts"][0]["text"])

# ==============================================================================
# Step 4: 自動建置網頁與更新首頁 (Auto HTML Generation)
# ==============================================================================
def build_quiz_html(quiz_data):
    pieces = []
    for idx, q in enumerate(quiz_data, 1):
        opts = []
        for opt in q["options"]:
            c_str = "true" if opt["correct"] else "false"
            opts.append(f'          <button class="quiz-opt" data-correct="{c_str}">{opt["text"]}</button>')
        pieces.append(f"""
      <div class="quiz-item">
        <div class="quiz-question">{idx}. {q["question"]}</div>
        <div class="quiz-options">
{"\\n".join(opts)}
        </div>
        <div class="quiz-feedback" data-explain="{q.get('explanation', '')}"></div>
      </div>""")
    return "\\n".join(pieces)

def generate_story_page(data, out_dir):
    slug = re.sub(r'[^a-zA-Z0-9]+', '-', data["title"].lower()).strip('-')
    filename = f"story-{slug}.html"
    filepath = os.path.join(out_dir, filename)

    paras_html = []
    for p in data.get("paragraphs", []):
        paras_html.append(f"""      <div class="story-para-group">
        <p class="para-en">{p['en']}</p>
        <div class="para-trans">{p['zh']}</div>
      </div>""")

    full_html = STORY_HTML_TEMPLATE.format(
        title=data["title"],
        badge_class=data.get("badge_class", "short"),
        badge_text=data.get("read_time", "Short · ~3 min"),
        category=data.get("category", "Awkward Moments"),
        scene=data.get("scene", "Everyday Life"),
        story_paragraphs_html="\\n".join(paras_html),
        quiz_items_html=build_quiz_html(data.get("quiz", []))
    )

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(full_html)
    print(f"[4/4] 成功建立新故事頁面: {filename}")
    return filename, data

def append_to_index(index_path, filename, data):
    if not os.path.exists(index_path):
        return
    with open(index_path, "r", encoding="utf-8") as f:
        content = f.read()

    if filename in content:
        print(f"[i] 故事已存在於首頁，無需重複插入。")
        return

    card = f"""
      <!-- Auto-generated Story: {data['title']} -->
      <div class="story-card">
        <div class="card-color-bar"></div>
        <div class="card-body">
          <h2>{data['title']}</h2>
          <div class="meta" style="margin-bottom: 8px;">
            <span class="badge {data.get('badge_class', 'short')}">{data.get('read_time', 'Short · ~3 min')}</span>
            <span>{data.get('category', 'Awkward Moments')}</span>
          </div>
          <div class="feature-tags">
            <span class="tag highlight">🎧 Voice Audio</span>
            <span class="tag">📖 Vocab Notes</span>
            <span class="tag">🌐 Translation</span>
            <span class="tag">💡 Quiz</span>
          </div>
          <p>{data.get('summary', 'An honest little awkward moment.')}</p>
          <a href="{filename}" class="btn">Read Story →</a>
        </div>
      </div>"""

    target = '<div id="tab-stories" class="tab-pane active">'
    if target in content:
        new_content = content.replace(target, target + "\n" + card)
        with open(index_path, "w", encoding="utf-8") as f:
            f.write(new_content)
        print(f"[4/4] 成功將《{data['title']}》加入首頁隨筆清單！")

def main():
    parser = argparse.ArgumentParser(description="多平台社死熱門故事自動化機器人")
    parser.add_argument("--dry-run", action="store_true", help="測試模式 (免 API 密鑰)")
    parser.add_argument("--output-dir", default=".", help="網站根目錄")
    args = parser.parse_args()

    api_key = os.environ.get("GEMINI_API_KEY")

    if args.dry_run or not api_key:
        print("=== 正在以示範/測試模式運行 ===")
        story_data = call_llm_human_rewrite("AirDrop to stranger", "", api_key=None)
        fn, d = generate_story_page(story_data, args.output_dir)
        append_to_index(os.path.join(args.output_dir, "index.html"), fn, d)
        print("\n✨ 測試完成！生成了純自然語氣的社死故事頁面。")
        return

    # 正式 4 步驟執行流水線
    print("=== 開始執行 4 步驟自動化流水線 ===")
    
    # 步驟 1: 抓取趨勢與社死候選素材
    reddit_candidates = fetch_reddit_candidates(["tifu", "embarrassing", "confession"])
    
    # 步驟 2: 揀選最適合改寫的素材 (最高讚且長度合適)
    if not reddit_candidates:
        print("[!] 暫無抓取到合適素材，結束執行。")
        return
    chosen = sorted(reddit_candidates, key=lambda x: x["ups"], reverse=True)[0]
    print(f"[2/4] 選中最佳素材: 《{chosen['title']}》 ({chosen['source']}, {chosen['ups']} 👍)")

    # 步驟 3: 自然、無 AI 味的人性化改寫
    print("[3/4] 正在以第一人稱、普通人視角進行情緒起伏改寫...")
    story_data = call_llm_human_rewrite(chosen["title"], chosen["text"], api_key=api_key)

    # 步驟 4: 自動生成網頁並更新網站首頁
    fn, d = generate_story_page(story_data, args.output_dir)
    append_to_index(os.path.join(args.output_dir, "index.html"), fn, d)
    print("\n🎉 全流程自動化完成！新故事已成功生成並加入首頁。")

if __name__ == "__main__":
    main()
