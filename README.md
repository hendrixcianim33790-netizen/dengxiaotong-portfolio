# Deng Xiaotong · Portfolio

静态个人作品集。纯 HTML / CSS / JS,无框架、无构建步骤 —— 克隆下来直接丢到任意静态托管即可。

## 在线地址

`https://<你的用户名>.github.io/<仓库名>/`

## 本地预览

因为用到了 `data-folder` JSON 与素材懒加载,直接双击 `index.html` 用 `file://` 打开也能跑,但更推荐起个本地服务:

```bash
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000
```

## 部署到 GitHub Pages

```bash
# 1. 在 GitHub 新建一个空仓库(不要勾选 README),然后:
cd deploy
git init -b main
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git add -A
git commit -m "portfolio: initial deploy"
git push -u origin main

# 2. 打开仓库 Settings → Pages → Source 选 main / (root),保存
# 3. 等 1~2 分钟,地址就是 https://<你的用户名>.github.io/<仓库名>/
```

仓库根目录已经放了 `.nojekyll`,跳过 Jekyll 处理,避免下划线开头的文件被忽略。

## 目录结构

```
.
├── index.html                    # 唯一页面,五个 section 全在这里
├── .nojekyll                     # 关掉 Jekyll
├── glass-folder.css / .js        # 作品区的玻璃文件夹组件
├── spotlight-card.css / .js      # 数据区的聚光卡片组件
├── stagger-testimonials.css / .js# 经历区的错落卡片阵组件
└── assets/
    ├── hero.jpg                  # 首屏背景
    ├── neon-texture.jpg          # 霓虹噪点纹理
    ├── resume.pdf                # 简历下载
    └── works/                    # 9 条 mp4 + 32 张 webp 缩略图
```

## 素材加载约定

文件夹的素材清单写在 `index.html` 里每个 `.folder-cell` 的 `data-folder` 属性上,是一段 JSON:

```json
{
  "label": "投放视频 · 钩子与叙事",
  "meta": "9 条 / 前 3 秒决定生死",
  "art": "assets/works/xxx.webp",
  "files": [
    { "name": "xxx", "image": "assets/works/xxx.webp", "media": "video" }
  ]
}
```

`media: "video"` 时,弹窗会取 `image` 字段的路径、去掉 `.webp` 后缀换成 `.mp4` 作为视频源,`.webp` 本身留作封面图。所以**每个视频都必须同时存在同名 `.mp4` 和 `.webp`**,只放一个会 404。

缩略图走 `data-src` 懒加载,首屏不会请求任何 mp4。

## 改内容的位置

- **首屏 / 数据 / 作品 / 经历 / TMI** —— 都在 `index.html` 里,搜对应 section id:`#roles` `#data` `#works` `#exp` `#tmi`
- **文件夹里的素材清单** —— `index.html` 中搜 `data-folder=`
- **配色** —— `index.html` 的 `<style>` 里 `:root` 的 CSS 变量(HSL 空格分量格式,写法是 `hsl(var(--x)/.46)`,不是 `hsla(var(--x),.46)`)
- **字体** —— `index.html` 的 `<head>` 里 Google Fonts 链接,目前是 Quicksand(圆体西文/数字)+ Noto Sans SC(中文)

改完记得刷新一下组件的 `?v=` 版本号(`glass-folder.css?v=2` 这种),否则浏览器会拿缓存里的旧文件。

## 已知约束

- 视频总时长较长,首屏刻意不预加载任何 mp4,点开文件夹才按需加载。
- 站点依赖 Google Fonts,离线环境下会回退到系统字体,布局不会崩。
