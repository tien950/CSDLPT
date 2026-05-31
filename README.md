# Hệ Thống Đăng Ký Học Phần Phân Tán

Hệ thống quản lý đăng ký học phần phân tán cho 3 cơ sở đại học tại Việt Nam: **Hà Đông**, **Hòa Lạc**, và **TP. Hồ Chí Minh**.

## 🎯 Tổng Quan

### Kiến Trúc Hệ Thống
- **1 Server Chính** (Publisher) tại Hà Đông
- **2 Server Chi Nhánh** (Subscribers) tại Hòa Lạc & TP. Hồ Chí Minh
- **3 Database SQL Server** độc lập, sử dụng **2-Phase Commit (2PC)** cho giao dịch xuyên cơ sở

### Công Nghệ
| Lớp | Công Nghệ |
|-----|-----------|
| Frontend | React.js (Vite) |
| Backend | Node.js + Express |
| Database | SQL Server (3 instances) |
| Auth | JWT + 4 Roles |
| Port | Backend: 4000, Frontend: 5173 |

## 📋 Các Bảng Dữ Liệu

### Bảng Nhân Rộng (Replicated - trên ALL 3 nodes)
```
subject           - Môn học
term              - Học kỳ
timeslot          - Khung giờ học
prerequisite      - Môn tiên quyết
curriculum        - Chương trình đào tạo
curriculum_subject - Chi tiết chương trình
```

### Bảng Phân Mảnh (Fragmented - mỗi node chỉ lưu dữ liệu của cơ sở mình)
```
headquarter - Cơ sở (ID_headquarter = HQHD|HQHL|HQHCM)
department  - Phòng ban (theo cơ sở)
room        - Phòng học (theo cơ sở)
teacher     - Giảng viên (qua department)
student     - Sinh viên (qua department)
class       - Lớp học (qua teacher)
session     - Buổi học (qua class/room)
registration - Đăng ký (qua student/class)
```

## 🚀 Cài Đặt & Chạy

### 1. Clone & Cài Dependencies
```bash
cd csdlpt
npm install
cd frontend
npm install
```

### 2. Cấu Hình File `.env`
```env
# SQL Server IPs
HQHD_SERVER=26.28.246.97
HQHL_SERVER=26.54.47.104
HQHCM_SERVER=26.213.180.63

# Credentials
HQHD_USER=sa
HQHD_PASSWORD=your_password
HQHL_USER=sa
HQHL_PASSWORD=your_password
HQHCM_USER=sa
HQHCM_PASSWORD=your_password

# JWT Secret
JWT_SECRET=your_secret_key_here
```

### 3. Khởi Động
```bash
# Terminal 1: Backend (Node.js)
npm run server

# Terminal 2: Frontend (React)
cd frontend
npm run dev
```

Truy cập: **http://localhost:5173**

## 👥 Tài Khoản Demo

| Username | Password | Role | Cơ Sở |
|----------|----------|------|--------|
| b22cntt005 | 123456 | Sinh viên | Hà Đông |
| b22attt005 | 123456 | Sinh viên | Hòa Lạc |
| b22attt001 | 123456 | Sinh viên | TP. Hồ Chí Minh |
| gv_hd_01 | gv123 | Giảng viên | Hà Đông |
| nv_hl_01 | nv123 | Nhân viên | Hòa Lạc |
| qtv_01 | qtv123 | Quản trị viên | Hà Đông |

## 📱 Chức Năng Sinh Viên

### 1. Xem Danh Sách Môn Học
- Chọn cơ sở từ dropdown
- Hiển thị tất cả lớp học mở đăng ký
- Xem thời khóa biểu (ngày, giờ, phòng học)

### 2. Đăng Ký Môn Học
- **Cùng cơ sở**: Giao dịch đơn lẻ (1 node)
- **Khác cơ sở**: 2-Phase Commit (2 nodes)

### 3. Xem Lớp Đã Đăng Ký
- Danh sách môn học đã đăng ký
- Trạng thái: REGISTERED / CANCELLED

### 4. Hủy Đăng Ký
- Nút × để hủy đăng ký
- Xác nhận trước hủy

## 🔑 API Endpoints

### Authentication
```
POST /api/auth/login
  Body: { username, password }
  Response: { success, token, user: { id, role, maCS } }
```

### Học Phần
```
GET /api/hocphan/available?maCS=HQHD|HQHL|HQHCM
  Response: { success, data: [...classes], maCS }

GET /api/hocphan/schedule/:classId?maCS=HQHD|HQHL|HQHCM
  Response: { success, data: [...sessions] }
```

### Đăng Ký
```
POST /api/dangky
  Body: { maLop, maCSLop }
  Response: { success, message }

GET /api/sinhvien/registrations
  Response: { success, data: [...registrations] }

POST /api/dangky/cancel
  Body: { maDangKy }
  Response: { success, message }
```

## 🔄 Quy Trình Đăng Ký Chéo (2-Phase Commit)

### Local Registration (cùng cơ sở)
```
1. Xác thực sinh viên ở cơ sở của sinh viên
2. Kiểm tra lớp học có sẵn
3. Kiểm tra chưa đăng ký
4. INSERT registration + UPDATE number_of_registration
5. COMMIT
```

### Cross-Campus Registration (khác cơ sở)
```
Phase 1 (PREPARE):
  - Xác thực sinh viên ở cơ sở của sinh viên (node A)
  - Kiểm tra lớp học ở cơ sở của lớp (node B)
  
Phase 2 (COMMIT):
  - INSERT registration ở node A
  - UPDATE number_of_registration ở node B
  
Phase 2 (ROLLBACK on failure):
  - Nếu node B thất bại → DELETE registration ở node A
```

## 📊 Quyền Hạn (Roles)

| Role | Permissions |
|------|-------------|
| **sinhvien** | Xem/cập nhật info cá nhân, đăng ký/hủy lớp, xem TKB |
| **giangvien** | Xem lớp được giao, danh sách sinh viên, TKB dạy |
| **nhanvien** | Quản lý SV/GV tại cơ sở, mở lớp, xếp lịch, báo cáo |
| **quantrivien** | Truy cập toàn bộ, quản lý danh mục, giám sát node, báo cáo toàn trường |

## 🛠️ Cấu Trúc Thư Mục

```
backend/
├── config/
│   ├── db.js            - Kết nối SQL Server (3 nodes)
│   ├── nodes.js         - Cấu hình node + env loading
│   ├── demo-users.js    - Tài khoản demo
│   └── cors.js          - CORS config
├── middleware/
│   └── auth.js          - JWT auth + role guard
├── routes/
│   ├── auth.js          - Login endpoint
│   ├── dangky.js        - Registration (local + 2PC)
│   ├── hocphan.js       - Classes & schedule
│   ├── sinhvien.js      - Student data
│   ├── giangvien.js     - Teacher data
│   ├── nhanvien.js      - Staff data
│   └── quantrivien.js   - Admin data
├── utils/
│   └── db.js            - Helper functions
└── server.js            - Express app entry

frontend/
├── src/
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── SinhVien/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── DanhSachDangKy.jsx   - Main registration UI
│   │   │   └── ThoiKhoaBieu.jsx
│   │   ├── GiangVien/
│   │   ├── NhanVien/
│   │   └── QuanTri/
│   ├── components/
│   │   └── NodeStatusBar.jsx - Monitor 3 nodes
│   └── App.jsx           - Main routing
└── index.html
```

## ⚙️ Cấu Hình Database

### Từng Node
```sql
-- HQHD (26.28.246.97)
Database: QLDangKy_HQHD
User: sa
Instance: CSDLPTNHOM7

-- HQHL (26.54.47.104)
Database: QLDangKy_HQHL
User: sa
Instance: CSDLPTNHOM7

-- HQHCM (26.213.180.63)
Database: QLDangKy_HQHCM
User: sa
Instance: CSDLPTNHOM07
```

### ID Cơ Sở (Node Keys)
- `HQHD` = Hà Đông (Publisher)
- `HQHL` = Hòa Lạc (Subscriber)
- `HQHCM` = TP. Hồ Chí Minh (Subscriber)

## 🐛 Troubleshooting

### "Node đang offline"
- Kiểm tra IP & password trong `.env`
- Kiểm tra SQL Server service đang chạy
- Kiểm tra firewall cho port SQL Server (1433)
- Kiểm tra instance name đúng

### "Không tìm thấy sinh viên"
- Đảm bảo sinh viên tồn tại trong cơ sở dữ liệu
- Kiểm tra ID sinh viên trong bảng `student`
- Kiểm tra `ID_department` sinh viên có tồn tại

### "Lớp học phần đã đủ sĩ số"
- Kiểm tra `max_students` và `number_of_registration`
- `number_of_registration` không được vượt `max_students`

### "Thiếu mã lớp hoặc mã cơ sở"
- Khi đăng ký, phải gửi: `{ maLop, maCSLop }`
- `maCSLop` là cơ sở của lớp học (HQHD/HQHL/HQHCM)

## 📝 Logs

### Backend Console
```
[DB] Connecting to HQHD...
[DB] Connection pool ready for HQHD
[DB] Querying node HQHL
[DB] Connection failed for HQHCM: ...
```

Mỗi request log node được query để debug multi-node operations.

## 🔒 Bảo Mật

- ✅ Parameterized queries (ngăn SQL injection)
- ✅ JWT token validation
- ✅ Role-based access control (RBAC)
- ✅ Transaction isolation (2PC)
- ⚠️ TODO: HTTPS, Input validation, Rate limiting

## 📞 Liên Hệ & Support

Nếu gặp vấn đề:
1. Kiểm tra logs backend
2. Kiểm tra SQL Server connectivity
3. Xem phần Troubleshooting trên
4. Kiểm tra `.env` config đúng

---

**Phiên Bản**: 1.0  
**Ngôn Ngữ**: Tiếng Việt  
**Cuối cập nhật**: 2026-05-31
