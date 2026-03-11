# OmniChat Operations Runbook

本文件提供上線後日常維運、故障排除與緊急應對流程。

## 1. 服務總覽

- 反向代理: `nginx` (gateway)
- 管理後台: `omnibot-admin`
- API: `api`
- AI Engine: `ai-engine`
- DB/Cache/Queue: `postgres`, `redis`, `rabbitmq`, `qdrant`

## 2. 快速檢查 (5 分鐘)

```bash
cd ~/omnichat
sudo docker ps
curl -sS -I http://localhost/health
curl -sS -I http://localhost/
curl -sS -I http://localhost/assets/
curl -sS -I http://localhost/admin/assets/
```

預期:
- `/health` -> `200`
- `/` -> `200`
- `/assets/...` 與 `/admin/assets/...` 不應回 `301` 到 HTML 首頁

## 3. 常見故障與處理

### A) 後台白屏 + MIME 錯誤

症狀:
- Console 顯示 JS/CSS 被拒絕，`MIME type text/html`
- `assets/*.js` 回應不是 `application/javascript`

排查:
```bash
curl -sS -I http://localhost/
curl -sS -I http://localhost/assets/index-xxxxx.js
curl -sS -I http://localhost/admin/assets/index-xxxxx.js
sudo docker logs --tail=200 nginx
sudo docker logs --tail=200 omnibot-admin
```

修復要點:
- `infrastructure/nginx/conf.d/api.conf`
  - `/admin/assets/` 要能正確代理到 admin 靜態資源
  - `/admin/` 要能正確代理 SPA
- `services/admin-dashboard/nginx.conf`
  - `/admin` 不要做 301 連鎖跳轉（避免快取轉址污染）
  - `/admin/assets/` 與 `/assets/` 都要正確命中靜態檔

套用後重啟:
```bash
sudo docker-compose up -d --build nginx omnibot-admin
```

### B) HTTPS 啟動失敗 (PEM bad end line)

症狀:
- `nginx` log 出現 `PEM routines::bad end line`

排查:
```bash
ls -l infrastructure/nginx/ssl
sed -n '1,5p' infrastructure/nginx/ssl/fullchain.pem
sed -n '1,5p' infrastructure/nginx/ssl/privkey.pem
```

修復:
- 重新貼入完整 PEM，包含 `-----BEGIN ...-----` 與 `-----END ...-----`
- 確認沒有多貼空白或截斷
- 若使用自簽，Cloudflare SSL 模式用 `Full`
- 若使用 Origin Certificate，Cloudflare SSL 模式可用 `Full (strict)`

### C) 更新後連不上

排查:
```bash
sudo docker-compose config --quiet
sudo docker-compose ps
sudo docker logs --tail=200 nginx
sudo docker logs --tail=200 api
```

修復:
- 先只重建單一異常服務，再重建全體
```bash
sudo docker-compose up -d --build nginx
sudo docker-compose up -d --build
```

## 4. 版本更新標準流程

```bash
cd ~/omnichat
git fetch --all
git pull origin master
sudo docker-compose up -d --build admin-dashboard api nginx
```

若有 schema 或基礎設施變更:
```bash
sudo docker-compose up -d --build
```

## 5. Cloudflare 快取處理

當設定已改但外部結果仍舊值:
- 開啟 Cloudflare Development Mode (暫時)
- Purge Cache (至少 Purge by URL: `/`, `/admin`, `/assets/*`, `/admin/assets/*`)
- 再用 `curl -I https://omnichat.ordoai.co/...` 驗證

## 6. 觀測與紀錄

- 日誌保留最近錯誤片段:
```bash
sudo docker logs --tail=300 nginx > /tmp/nginx.tail.log
sudo docker logs --tail=300 omnibot-admin > /tmp/admin.tail.log
```
- 故障單最少記錄:
  - 發生時間 (UTC+8)
  - 影響範圍
  - 根因
  - 修復步驟
  - 後續預防措施

### Webhook 觀測

Bot API channel webhook 會寫入 `webhook_logs`，可由 API 查詢：

```bash
curl -sS "https://omnichat.ordoai.co/api/bots/<BOT_ID>/webhook/logs" \
  -H "Authorization: Bearer <ADMIN_JWT>"
```

Webhook 呼叫必需 headers：
- `x-api-key`: 租戶 API key
- `Authorization: Bearer <bot channel bearerToken>`
- `x-timestamp`: unix timestamp (seconds)
- `x-signature`: HMAC-SHA256 signature

簽章內容格式：
`{timestamp}.{botId}.{externalUserId}.{message}`

可用腳本產生簽章：

```bash
bash scripts/sign-webhook.sh <HMAC_SECRET> <BOT_ID> <USER_ID> <MESSAGE>
```

## 7. 資料庫備份與回復

### 手動備份

```bash
bash scripts/backup-db.sh
```

### 手動回復

```bash
bash scripts/restore-db.sh backups/omnibot_YYYYMMDD_HHMMSS.sql.gz
```

### 備份輪替（保留 14 天）

```bash
bash scripts/backup-rotation.sh 14
```

### 建議排程（crontab）

```bash
0 3 * * * cd ~/omnichat && bash scripts/backup-db.sh && bash scripts/backup-rotation.sh 14
```

## 8. 緊急回復 (Rollback)

1. 切回上一個可用 commit
2. 重建核心服務
3. 驗證首頁、登入、API health

```bash
cd ~/omnichat
git log --oneline -n 5
git checkout <last-known-good-commit>
sudo docker-compose up -d --build nginx admin-dashboard api
curl -sS -I http://localhost/health
curl -sS -I http://localhost/
```
