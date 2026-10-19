#!/bin/bash
# ============================================================
#  一键部署到 GitHub Pages
#  仓库已 git init + commit 好,这里只做「建仓库 → push → 开 Pages」
# ============================================================
set -e

SRC="$(cd "$(dirname "$0")" && pwd)"
REPO="${1:?用法: ./deploy.sh <仓库名>}"
DESC="邓晓桐的作品集 — 投放视频 / 创意图 / 落地页素材,以及内容投放与 AI 素材生产两个方向的实践"

echo "▸ 校验 GitHub 授权…"
source /root/.codebuddy/skills/github-connector/scripts/get_token.sh github >/dev/null

LOGIN=$(curl -s -H "Authorization: Bearer $GITHUB_TOKEN" https://api.github.com/user \
        | python3 -c "import json,sys; print(json.load(sys.stdin)['login'])")
echo "  已授权账号:$LOGIN"

REMOTE="https://oauth2:${GITHUB_TOKEN}@github.com/${LOGIN}/${REPO}.git"

echo "▸ 检查仓库 ${LOGIN}/${REPO} 是否已存在…"
EXISTS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $GITHUB_TOKEN" \
         "https://api.github.com/repos/${LOGIN}/${REPO}")

if [ "$EXISTS" = "404" ]; then
  echo "  不存在,创建中(含 gitignore / license)…"
  curl -s -X POST -H "Authorization: Bearer $GITHUB_TOKEN" \
    -H "Content-Type: application/json" \
    "https://api.github.com/user/repos" \
    -d "{\"name\":\"${REPO}\",\"description\":\"${DESC}\",\"private\":false,\"has_issues\":true,\"has_projects\":false,\"has_wiki\":false}" \
    | python3 -c "import json,sys; d=json.load(sys.stdin); print('  已创建:', d.get('full_name') or d.get('message'))"
  sleep 2
else
  echo "  已存在,直接使用"
fi

echo "▸ 推送代码…"
cd "$SRC"
git remote remove origin 2>/dev/null || true
git remote add origin "$REMOTE"
git push -u origin main

echo "▸ 开启 Pages(source = main / root)…"
curl -s -X POST -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.github.com/repos/${LOGIN}/${REPO}/pages" \
  -d '{"source":{"branch":"main","path":"/"}}' \
  | python3 -c "
import json,sys
d=json.load(sys.stdin)
if 'html_url' in d:
    print('  Pages 已开启:', 'https://%s.github.io/%s/' % (d.get('cname') or d['url'].split('//')[1].split('.')[0], '${REPO}'))
else:
    print('  返回:', d.get('message', d))
"

URL="https://${LOGIN}.github.io/${REPO}/"
echo
echo "✅ 部署完成(首次构建约 1~2 分钟)"
echo "   ${URL}"
echo "   仓库: https://github.com/${LOGIN}/${REPO}"
