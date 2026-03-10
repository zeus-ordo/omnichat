# OmniChat Deployment Guide

本文件是 `omnichat.ordoai.co` 的部署與更新標準流程。

## 1. 目標環境

- Host: AWS Lightsail (Ubuntu)
- Domain: `omnichat.ordoai.co`
- Reverse Proxy: Nginx (Docker)
- Orchestration: `docker-compose`

## 2. 首次部署

1) 取得程式碼

```bash
git clone https://github.com/zeus-ordo/omnichat.git
cd omnichat
```

2) 建立環境變數

```bash
cp .env.example .env
```

至少設定：

- `DB_PASSWORD`
- `JWT_SECRET`
- `OPENAI_API_KEY`
- `RABBITMQ_PASSWORD`
- `VITE_API_URL`（目前建議 `http://omnichat.ordoai.co/api`，若 HTTPS 全部完成可改 `https://...`）

3) 啟動

```bash
sudo docker-compose up -d --build
```

## 3. 日常更新（標準流程）

```bash
cd ~/omnichat
git pull origin master
sudo docker-compose up -d --build admin-dashboard api nginx
```

若包含資料層或其他服務變更，可直接重建全部：

```bash
sudo docker-compose up -d --build
```

## 4. 快速健康檢查

```bash
sudo docker ps
curl -I http://omnichat.ordoai.co
curl -I https://omnichat.ordoai.co
curl -I http://localhost/health
```

## 5. HTTPS 設定摘要

1) Cloudflare DNS

- `A` 記錄：`omnichat` -> Lightsail 公網 IP

2) Nginx 憑證路徑

- `infrastructure/nginx/ssl/fullchain.pem`
- `infrastructure/nginx/ssl/privkey.pem`

3) Nginx 設定檔

- 使用 `infrastructure/nginx/conf.d/api.conf`

4) Cloudflare SSL Mode

- 自簽憑證時：`Full`
- 使用 Cloudflare Origin Certificate 且格式正確時：`Full (strict)`

## 6. 重要安全建議

- 不要把真實金鑰寫入 `docker-compose.yml`
- 金鑰只放 `.env`
- 已暴露過的金鑰必須輪替（尤其 OpenAI）
- 定期備份 PostgreSQL
