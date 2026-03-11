# OmniChat UAT Checklist

## 1) 註冊/登入

- [ ] 新帳號註冊成功，不出現紅色條狀錯誤
- [ ] 註冊失敗時顯示 Error Modal（非頁內警示）
- [ ] 登入成功後可進入 Dashboard
- [ ] 登入失敗時顯示 Error Modal

## 2) Bots 與 Knowledge Base

- [ ] Knowledge Base 上傳文件成功，列表可見
- [ ] Bots 新增機器人可選擇 Knowledge Base 文件
- [ ] 儲存後重整頁面，機器人仍存在
- [ ] 各機器人的 channel 設定互不影響

## 3) API Channel Webhook

- [ ] Bot 啟用 API channel
- [ ] 填入 `bearerToken` 與 `hmacSecret`
- [ ] 使用正確 `x-api-key` + `Authorization: Bearer ...` + `x-timestamp` + `x-signature` 可成功回覆
- [ ] 缺少/錯誤簽章時應回 401
- [ ] `GET /api/bots/:id/webhook/logs` 可看到成功與失敗紀錄

## 4) 小助手與設定管理

- [ ] 右下角小助手可展開對話
- [ ] Settings 中可儲存小助手設定
- [ ] owner/admin 可修改；非管理角色不可修改

## 5) 部署與健康檢查

- [ ] `docker-compose ps` 核心服務皆 up/healthy
- [ ] `/health` 回 200
- [ ] 執行 `scripts/smoke-test.sh` 成功
