#!/bin/bash
set -e

echo "====================================================="
echo "🚀 BẮT ĐẦU KHỞI ĐỘNG NAVGUARD"
echo "====================================================="

# 1. Khởi động Database (Postgres + Redis)
echo "⏳ [1/3] Đang khởi động Database (Docker)..."
cd ~/navguard/server
docker compose up -d
sleep 2 # Chờ 2 giây để DB sẵn sàng

# 2. Build Extension và Sync sang Windows
echo "⏳ [2/3] Đang build Extension và sync sang Windows..."
cd ~/navguard/extension
pnpm build > /dev/null 2>&1
~/navguard/scripts/sync-to-windows.sh > /dev/null 2>&1
echo "✅ Đã build xong. (Nhớ bấm Reload ở chrome://extensions)"

# 3. Khởi động Server API
echo "⏳ [3/3] Đang khởi động Server API..."
echo "====================================================="
echo "✅ HỆ THỐNG ĐÃ SẴN SÀNG!"
echo "👉 Server đang chạy tại: http://localhost:3000"
echo "👉 Nhấn Ctrl+C để tắt Server."
echo "====================================================="
cd ~/navguard/server
pnpm dev
