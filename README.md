# OmniBot AI - Multi-tenant Chatbot SaaS

一個基於 AI 的多租戶客服機器人系統。

## 功能特性

- 🤖 **多租戶架構** - 每個客戶有獨立的數據隔離 (Schema 隔離)
- 💬 **多渠道支持** - 網站 Widget、 LINE、 Facebook Messenger、 REST API
- 🧠 **AI 對話** - 支援 GPT-4o、 Claude 等主流 AI 模型
- 📚 **知識庫 (RAG)** - 上傳文檔讓 AI 進行問答
- 📊 **分析儀表板** - 對話統計和使用分析

## 快速開始

### 1. 複製環境變量

```bash
cp .env.example .env
```

### 2. 編輯 .env 文件

填入必要的 API Key：
- `OPENAI_API_KEY` - OpenAI API Key
- `ANTHROPIC_API_KEY` - Anthropic API Key (可選)
- `LINE_CHANNEL_ACCESS_TOKEN` - LINE Bot Token (可選)
- `LINE_CHANNEL_SECRET` - LINE Channel Secret (可選)

### 3. 啟動服務

```bash
docker-compose up -d
```

### 4. 訪問服務

| 服務 | URL | 預設帳號 |
|------|-----|----------|
| Admin Dashboard | http://localhost/admin | admin@demo.com / admin123 |
| API Docs | http://localhost/api/docs | - |
| Qdrant Dashboard | http://localhost:6333/dashboard | - |
| RabbitMQ Dashboard | http://localhost:15672 | omnibot / omnibot_rabbitmq_pass |

## 架構

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Compose                         │
├─────────────┬─────────────┬─────────────┬───────────────┤
│   API       │  AI Engine  │   Admin     │   Widget      │
│  (NestJS)   │ (FastAPI)   │ (React)     │  (React)      │
└──────┬──────┴──────┬──────┴──────┬──────┴───────┬───────┘
       │             │             │              │
       ▼             ▼             ▼              ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  PostgreSQL │ │    Redis    │ │   Qdrant    │ │  RabbitMQ   │
│  (Database) │ │   (Cache)   │ │  (Vectors)  │ │   (Queue)   │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```

## 服務說明

### API 服務 (Port 3000)
- NestJS 後端 API
- 多租戶認證 (API Key + JWT)
- 對話管理
- 頻道 Webhook

### AI Engine (Port 8000)
- Python FastAPI
- LLM 路由 (GPT/Claude)
- RAG 向量搜尋
- Embedding 生成

### Admin Dashboard (Port 5173)
- React + Tailwind CSS
- 對話管理
- 知識庫上傳
- 頻道配置
- 系統設定

### Chat Widget (Port 5174)
- 可嵌入網站的聊天元件
- 即時對話

## 開發

### 本地開發模式

```bash
# 啟動數據庫和快取
docker-compose up -d postgres redis qdrant rabbitmq

# 進入 API 目錄
cd services/api
npm install
npm run start:dev

# 進入 AI Engine 目錄
cd services/ai-engine
pip install -r requirements.txt
uvicorn app.main:app --reload

# 進入 Admin Dashboard
cd services/admin-dashboard
pnpm install
pnpm dev
```

## 環境變量

| 變量 | 說明 | 預設值 |
|------|------|--------|
| `DB_USER` | PostgreSQL 用戶名 | omnibot |
| `DB_PASSWORD` | PostgreSQL 密碼 | omnibot_secure_pass |
| `JWT_SECRET` | JWT 密鑰 | (需設定) |
| `OPENAI_API_KEY` | OpenAI API Key | - |
| `ANTHROPIC_API_KEY` | Anthropic API Key | - |
| `DEFAULT_MODEL` | 預設 AI 模型 | gpt-4o |

## API 使用

### 認證

```bash
# 登入
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -H "X-API-Key: demo_api_key_12345" \
  -d '{"email": "admin@demo.com", "password": "admin123"}'

# 回應
{
  "access_token": "eyJhbG...",
  "user": { "id": "...", "email": "admin@demo.com", "role": "owner" }
}
```

### 對話

```bash
# 發送訊息
curl -X POST http://localhost/api/conversations/:id/messages \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"content": "Hello!"}'
```

## 部署

### 生產環境

1. 修改 `.env` 中的所有密碼
2. 配置 HTTPS/SSL
3. 使用 Kubernetes 或 Docker Swarm 進行擴展

更多部署與維運文件：
- `DEPLOY.md`
- `RUNBOOK.md`

## License

MIT
