# NavGuard — Manual Test Checklist

Chạy toàn bộ trước khi release. Đánh dấu [x] khi pass.

## Chuẩn bị

- [ ] Chrome đã load extension từ `C:\navguard-extension`
- [ ] Mở DevTools SW (giữ mở suốt quá trình test)
- [ ] Reset storage: SW console → `chrome.storage.local.clear()`
- [ ] Reload extension

## A. Same-origin (Level 0)

- [ ] Vào `https://example.com`
- [ ] F5
- [ ] Click link nội bộ (nếu có) → **không toast**, chuyển ngay
- [ ] SW log: `Decision: { level: 0 }`

## B. Cross-origin (Level 2)

- [ ] Vào `https://example.com`
- [ ] Click link **More information...**
- [ ] Toast đỏ hiện góc trên phải
- [ ] Toast có: icon ⚠️, "Trang này muốn mở **iana.org**", lý do, 2 nút
- [ ] Trang KHÔNG chuyển
- [ ] SW log: `Decision: { level: 2 }`

## C. Cho phép (allowlist)

- [ ] Bấm **Cho phép** trên toast
- [ ] Toast mất, trang chuyển sang `iana.org`
- [ ] SW log: `ALLOW_ONCE` + `allowlist = 1`
- [ ] Quay lại `example.com`, F5, click link
- [ ] **Không toast**, chuyển ngay
- [ ] SW log: `Decision: { level: 0, reason: ['allowlisted domain'] }`

## D. Chặn (blocklist)

- [ ] SW console: `chrome.storage.local.clear()`
- [ ] Vào `example.com`, F5, click link
- [ ] Bấm **Chặn** trên toast
- [ ] SW log: `BLOCK` + `blocklist = 1`
- [ ] Quay lại `example.com`, F5, click link
- [ ] **Interstitial** hiện ra (trang tối, cảnh báo đỏ)
- [ ] SW log: `Decision: { level: 3, action: 'interstitial' }`

## E. Interstitial — Quay lại an toàn

- [ ] Trên interstitial, bấm **← Quay lại an toàn**
- [ ] Trở về `example.com`

## F. Interstitial — Proceed

- [ ] Click link lại → interstitial
- [ ] Nút đỏ **disabled** với text "(3s)"
- [ ] Đợi 3s → nút enable, text đổi thành "Tôi hiểu rủi ro, vẫn tiếp tục"
- [ ] Tick checkbox "Tôi xác nhận..."
- [ ] Bấm nút đỏ
- [ ] Chuyển sang `iana.org`
- [ ] SW log: `ALLOW_FROM_INTERSTITIAL`

## G. Window.open hook

- [ ] Trong Console tab example.com, gõ: `window.open('https://google.com')`
- [ ] SW log: `Hook: HOOK_WINDOW_OPEN`
- [ ] Tab mới mở

## H. Meta refresh hook

- [ ] Trong Console tab example.com, chạy JS chèn meta refresh (xem screenshot)
- [ ] SW log: `Hook: HOOK_META_REFRESH`

## I. Popup UI

- [ ] Click icon NavGuard trên thanh extension
- [ ] Popup hiện, header có `X log · Y allow · Z block`
- [ ] Tab **Log** hiện danh sách log với badge mức + URL + trạng thái
- [ ] Tab **Cho phép** hiện allowlist
- [ ] Tab **Chặn** hiện blocklist
- [ ] Bấm **Xóa** trên 1 entry → entry mất, header update
- [ ] Bấm **Xóa log** → log trống
- [ ] Bấm **Reset tất cả** → tất cả trống

## J. Overlay detection

- [ ] Tạo file HTML local với overlay trong suốt
- [ ] Mở qua python3 http.server 8000
- [ ] Click vào overlay → interstitial (level 3)
- [ ] Lý do: "Bạn có thể đã bấm vào lớp phủ trong suốt"

## K. Stress test

- [ ] Mở 10 tab khác nhau
- [ ] Click nhiều link trong 1 phút
- [ ] Không có lag, không có lỗi SW
- [ ] DevTools SW console không có lỗi đỏ

## L. Persistence

- [ ] Đóng Chrome hoàn toàn
- [ ] Mở lại Chrome
- [ ] Allowlist/blocklist vẫn còn
- [ ] Log vẫn còn
- [ ] Mở example.com, click link đã allow → không toast

## Kết quả

- Pass: ___/___
- Fail: ___
- Ghi chú: ___
