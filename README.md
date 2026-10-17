# NavGuard — Chặn Redirect Quảng Cáo & Lừa Đảo

Dự án bảo vệ người dùng khỏi clickjacking, redirect độc hại, và quảng cáo xâm nhập bằng Phân tích tên miền thời gian thực.

## 🌟 Tính năng nổi bật
- **Smart Decision:** Tự động cho qua nếu tên miền uy tín (>1 năm tuổi), tự động chặn nếu là trang lừa đảo.
- **Phân tích RDAP:** Kiểm tra tuổi đời tên miền thời gian thực qua API Server.
- **Chặn Clickjacking:** Phát hiện lớp phủ trong suốt (Overlay) và chặn đứng.
- **Giao diện Glassmorphism:** Màn hình cảnh báo thiết kế hiện đại, font chữ chuẩn bảo mật.
- **Tùy biến mạnh mẽ:** Trang Options cho phép bật/tắt từng mức độ cảnh báo và Server API.
- **Quản lý danh sách:** Allowlist (Luôn cho qua), Blocklist (Luôn chặn) trực quan qua Popup.

## 📁 Cấu trúc dự án
- `extension/`: Chrome Extension (Manifest V3, TypeScript, Vite).
- `server/`: API Server (Fastify, PostgreSQL, Redis, RDAP).
- `docs/`: Tài liệu test.

## 🚀 Hướng dẫn khởi chạy

### Yêu cầu
- Node.js 20+, pnpm.
- Docker & Docker Compose.
- Chrome / Edge.

### Chạy 1 chạm (Khuyên dùng)
Mở WSL2 và chạy lệnh sau:
`~/navguard/scripts/start-all.sh`

Script này sẽ tự động bật Database, Build Extension và chạy Server API. 
*(Lưu ý: Sau khi script báo Build xong, bạn vào `chrome://extensions` bấm Reload NavGuard để cập nhật).*

### Chạy thủ công (Từng bước)
1. **Bật Database:** `cd ~/navguard/server && docker compose up -d`
2. **Chạy Server:** `cd ~/navguard/server && pnpm dev`
3. **Build Extension:** `cd ~/navguard/extension && pnpm build && ~/navguard/scripts/sync-to-windows.sh`
4. **Load vào Chrome:** Load unpacked thư mục `C:\navguard-extension`.

## 🧪 Test
Chạy unit test cho Extension:
`cd ~/navguard/extension && pnpm test`

## 🛡️ License
Private / Chưa public.
