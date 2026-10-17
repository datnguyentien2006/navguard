#!/bin/bash
set -e
cd "$(dirname "$0")/.."

TARGET="/mnt/c/navguard-extension"

echo "===== BUILD ====="
pnpm --filter extension build 2>&1 | tail -5

echo ""
echo "===== SYNC SANG C:\\navguard-extension ====="
rm -rf "$TARGET"
mkdir -p "$TARGET"
cp -r extension/dist/* "$TARGET/"

echo ""
echo "===== ĐÃ COPY ====="
ls -la "$TARGET/"
echo ""
echo "Giờ vào chrome://extensions/ → Reload NavGuard."
