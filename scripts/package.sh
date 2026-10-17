#!/bin/bash
set -e
cd "$(dirname "$0")/.."

echo "===== BUILD ====="
pnpm --filter extension build 2>&1 | tail -3

VERSION=$(node -p "require('./extension/package.json').version")
OUTFILE="navguard-v${VERSION}.zip"

echo ""
echo "===== ĐÓNG GÓI: ${OUTFILE} ====="
cd extension/dist
rm -f "../../${OUTFILE}"
zip -r "../../${OUTFILE}" . -x "*.map" -x "chunks/modulepreload*" > /dev/null
cd ../..

echo ""
echo "===== KẾT QUẢ ====="
ls -lh "${OUTFILE}"
unzip -l "${OUTFILE}" | head -20
echo ""
echo "File: $(pwd)/${OUTFILE}"
