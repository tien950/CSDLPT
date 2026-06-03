<div align="center">

# HỆ THỐNG ĐĂNG KÝ HỌC PHẦN NHIỀU CƠ SỞ

### Bài tập lớn môn Cơ sở dữ liệu phân tán

---

**Giảng viên hướng dẫn:** Kim Ngọc Bách

| Nhóm lớp | Nhóm bài tập lớn |
|:---------:|:-----------------:|
| 10 | 07 |

</div>

---

## 👥 Danh sách thành viên

| STT | Họ và tên | Mã sinh viên |
|:---:|-----------|:------------:|
| 1 | Kiều Trường Giang | B23DCCN254 |
| 2 | Lê Bùi Quốc Huy | B23DCCN387 |
| 3 | Giang Thủy Tiên | B23DCCN814 |

---

## 1. Giới thiệu đề tài

### 1.1 Mô tả bài toán

Hệ thống đăng ký học phần phân tán phục vụ cho một trường đại học có **3 cơ sở** đào tạo:

| Cơ sở | Mã cơ sở | Vai trò | IP (Radmin VPN) |
|-------|:--------:|---------|:------------:|
| Hà Đông | `HQHD` | **Publisher** (Server chính) | `26.28.246.97` |
| Hòa Lạc | `HQHL` | Subscriber (Chi nhánh) | `26.54.47.104` |
| TP. Hồ Chí Minh | `HQHCM` | Subscriber (Chi nhánh) | `26.213.180.63` |

Sinh viên có thể đăng ký học phần tại cơ sở mình hoặc **đăng ký chéo** sang cơ sở khác. Hệ thống đảm bảo tính nhất quán dữ liệu giữa các cơ sở thông qua **giao dịch phân tán** (2-Phase Commit).

### 1.2 Công nghệ sử dụng

| Lớp | Công nghệ |
|-----|-----------|
| Frontend | React.js (Vite) |
| Backend | Node.js + Express |
| Cơ sở dữ liệu | Microsoft SQL Server |
| Mạng nội bộ | Radmin VPN | 

---

## 2. Kiến trúc hệ thống

### 2.1 Mô hình phân tán

```
                    ┌─────────────────────┐
                    │   CƠ SỞ HÀ ĐÔNG    │
                    │   (Publisher/Main)   │
                    │   SQL Server HQHD   │
                    │   Backend :4000     │
                    │   Frontend :5173    │
                    └────────┬────────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
              ▼                             ▼
┌─────────────────────┐         ┌─────────────────────┐
│   CƠ SỞ HÒA LẠC    │         │  CƠ SỞ TP. HCM     │
│   (Subscriber)      │         │  (Subscriber)       │
│   SQL Server HQHL   │         │  SQL Server HQHCM   │
│   Backend :4000     │         │  Backend :4000      │
│   Frontend :5173    │         │  Frontend :5173     │
└─────────────────────┘         └─────────────────────┘
```

- **Máy chủ Hà Đông (HQHD)**: Đóng vai trò Publisher, quản lý tập trung, chạy các truy vấn phân tán qua Linked Server, xử lý đăng ký chéo cơ sở.
- **Chi nhánh Hòa Lạc (HQHL) & TP. HCM (HQHCM)**: Đóng vai trò Subscriber, quản lý dữ liệu cục bộ, chuyển tiếp yêu cầu phân tán về HQHD.

### 2.2 Phân mảnh dữ liệu

#### Bảng nhân rộng (Replicated — có trên tất cả 3 node)

| Bảng | Mô tả |
|------|-------|
| `subject` | Danh mục học phần |
| `term` | Học kỳ |
| `timeslot` | Khung giờ học |
| `prerequisite` | Môn tiên quyết |
| `curriculum` | Chương trình đào tạo |
| `curriculum_subject` | Chi tiết chương trình |

#### Bảng phân mảnh ngang (Fragmented — mỗi node chỉ lưu dữ liệu cơ sở mình)

| Bảng | Mô tả | Khóa phân mảnh |
|------|-------|-----------------|
| `headquarter` | Cơ sở đào tạo | `ID_headquarter` |
| `department` | Khoa/phòng ban | qua `ID_headquarter` |
| `room` | Phòng học | qua `ID_headquarter` |
| `teacher` | Giảng viên | qua `department` |
| `student` | Sinh viên | qua `department` |
| `class` | Lớp học phần | qua `teacher` |
| `session` | Buổi học | qua `class` + `room` |
| `registration` | Đăng ký học phần | qua `student` + `class` |

---

## 3. Chức năng hệ thống

### 3.1 Phân quyền (4 vai trò)

| Vai trò | Quyền hạn |
|---------|-----------|
| `sinhvien` | Xem lớp học phần, đăng ký/hủy đăng ký, xem thời khóa biểu |
| `giangvien` | Xem lớp được giao, danh sách sinh viên, thời khóa biểu dạy |
| `quantrivien` (chi nhánh) | Quản lý CRUD dữ liệu cục bộ, báo cáo nhanh, tra cứu sinh viên |
| `quantrivien` (HQHD) | Tất cả quyền trên + giám sát node, truy vấn phân tán, thống kê toàn hệ thống |

### 3.2 Sinh viên

| Chức năng | Mô tả |
|-----------|-------|
| Xem danh sách lớp học phần | Lọc theo cơ sở, hiển thị thời khóa biểu, sĩ số, chỗ còn lại |
| Đăng ký cùng cơ sở | Giao dịch đơn (1 node), sử dụng `usp_RegisterClass` với UPDLOCK |
| Đăng ký chéo cơ sở |  sử dụng `usp_RegisterCrossCampusClass` |
| Hủy đăng ký | Cập nhật trạng thái `CANCELLED`, giảm sĩ số lớp |
| Xem kết quả đăng ký | Danh sách các lớp đã đăng ký với trạng thái |
| Xem thời khóa biểu | Lịch học chi tiết: ngày, ca, phòng, giảng viên |

### 3.3 Giảng viên

| Chức năng | Mô tả |
|-----------|-------|
| Tổng quan | Xem danh sách lớp được phân công, số sinh viên đăng ký |

### 3.4 Quản trị viên

| Chức năng | Phạm vi | Mô tả |
|-----------|---------|-------|
| Quản lý dữ liệu (CRUD) | Tất cả admin | Thêm/sửa/xóa dữ liệu trên 11 bảng, chọn cơ sở (admin HQHD) |
| Giám sát cơ sở | Chỉ admin HQHD | Kiểm tra trạng thái online/offline của 3 node |
| Báo cáo nhanh | Tất cả admin | Thống kê lớp HP theo học kỳ với stored procedure |
| Tra cứu sinh viên | Tất cả admin | Tra cứu đăng ký và thời khóa biểu theo mã sinh viên |
| **7 truy vấn phân tán** | Chỉ admin HQHD | Sử dụng `OPENQUERY` qua Linked Server (chi tiết bên dưới) |

### 3.5 Bảy truy vấn phân tán (chạy trên HQHD)

| Mã | Truy vấn | Kỹ thuật |
|:--:|----------|----------|
| Q1 | Thống kê số sinh viên đã đăng ký theo cơ sở | `UNION ALL` + `OPENQUERY` 3 node |
| Q2 | Học phần có nhiều sinh viên đăng ký nhất | `UNION ALL` + `OPENQUERY` + `GROUP BY` + `TOP 1` |
| Q3 | Danh sách sinh viên đăng ký chéo cơ sở | `UNION ALL` + `OPENQUERY`, lọc `student_campus <> class_campus` |
| Q4 | Tỷ lệ lấp đầy lớp học phần toàn hệ thống | `UNION ALL` + `OPENQUERY`, tính `% = registered / max * 100` |
| Q5 | Số lớp học phần mở theo khoa | `UNION ALL` + `OPENQUERY` + `GROUP BY department` |
| Q6 | Danh sách lớp học phần còn chỗ | `UNION ALL` + `OPENQUERY`, lọc `registered < max` |
| Q7 | Khối lượng giảng dạy của giảng viên | `UNION ALL` + `OPENQUERY` + `GROUP BY teacher` |

> Tất cả truy vấn đều sử dụng `COLLATE DATABASE_DEFAULT` để xử lý xung đột collation giữa các node.



## 4. Hướng dẫn cài đặt và chạy

### 4.1 Yêu cầu hệ thống

- **Node.js** >= 18
- **npm** >= 9
- **Microsoft SQL Server** 2019 trở lên (3 instance trên 3 máy)
- **Radmin VPN** hoặc mạng nội bộ kết nối 3 máy
- Mỗi máy cần mở **port 4000** (backend) và **port 1433** (SQL Server)

### 4.2 Thiết lập cơ sở dữ liệu

> Thực hiện trên **từng máy SQL Server** (HQHD, HQHL, HQHCM):

```sql
-- Bước 1: Tạo database và bảng
-- Chạy file: SQL SERVER/Tao_sql.sql

-- Bước 2: Chèn dữ liệu mẫu
-- Chạy file: SQL SERVER/Data.sql

-- Bước 3: Tạo stored procedures
-- Chạy file: SQL SERVER/Procedures.sql

-- Bước 4: Tạo triggers
-- Chạy file: SQL SERVER/trigger.sql
```

**Thiết lập Linked Server (chỉ trên máy chủ HQHD):**

```sql
-- Linked Server đến Hòa Lạc
EXEC sp_addlinkedserver @server = 'LINK_HL', ...
-- Linked Server đến TP. HCM
EXEC sp_addlinkedserver @server = 'Link_HoChiMinh', ...
```

### 4.3 Cài đặt ứng dụng

```bash
# Clone repository
git clone https://g...content-available-to-author-only...b.com/tien950/CSDLPT.git
cd CSDLPT

# Cài đặt dependencies backend (thư mục gốc)
npm install

# Cài đặt dependencies frontend
cd frontend
npm install
cd ..
```

### 4.4 Cấu hình file `.env`

Tạo file `.env` ở thư mục gốc. Mỗi máy chỉ cấu hình kết nối database **cục bộ** bằng nhóm biến `LOCAL_*`.

#### Máy chủ Hà Đông (HQHD)

```env
LOCAL_NODE=HQHD
LOCAL_SERVER=26.28.246.97
LOCAL_INSTANCE=CSDLPT_NHOM7
LOCAL_DATABASE=DkyTinChi
LOCAL_USER=sa
LOCAL_PASSWORD=123456

HQHD_API_BASE=http://26.28.246.97:4000
HQHL_API_BASE=http://26.54.47.104:4000
HQHCM_API_BASE=http://26.213.180.63:4000

VITE_API_LOCAL=http://localhost:4000
VITE_API_HQHD=http://26.28.246.97:4000
VITE_API_HQHL=http://26.54.47.104:4000
VITE_API_HQHCM=http://26.213.180.63:4000

JWT_SECRET=leona3859@
```

#### Máy chi nhánh Hòa Lạc (HQHL)

```env
LOCAL_NODE=HQHL
LOCAL_SERVER=26.54.47.104
LOCAL_INSTANCE=CSDLPTNHOM7
LOCAL_DATABASE=CSDL_HL
LOCAL_USER=sa
LOCAL_PASSWORD=<mật khẩu>

HQHD_API_BASE=http://26.28.246.97:4000
HQHL_API_BASE=http://26.54.47.104:4000
HQHCM_API_BASE=http://26.213.180.63:4000

VITE_API_LOCAL=http://localhost:4000
VITE_API_HQHD=http://26.28.246.97:4000
VITE_API_HQHL=http://26.54.47.104:4000
VITE_API_HQHCM=http://26.213.180.63:4000

JWT_SECRET=leona3859@
```

#### Máy chi nhánh TP. HCM (HQHCM)

```env
LOCAL_NODE=HQHCM
LOCAL_SERVER=26.213.180.63
LOCAL_INSTANCE=CSDLPTNHOM07
LOCAL_DATABASE=DkiTinChi_HCM
LOCAL_USER=sa
LOCAL_PASSWORD=<mật khẩu>

HQHD_API_BASE=http://26.28.246.97:4000
HQHL_API_BASE=http://26.54.47.104:4000
HQHCM_API_BASE=http://26.213.180.63:4000

VITE_API_LOCAL=http://localhost:4000
VITE_API_HQHD=http://26.28.246.97:4000
VITE_API_HQHL=http://26.54.47.104:4000
VITE_API_HQHCM=http://26.213.180.63:4000

JWT_SECRET=leona3859@
```

### 4.5 Khởi động ứng dụng

Trên **mỗi máy**, mở 2 terminal:

```bash
# Terminal 1: Khởi động Backend (Node.js + Express)
npm run server

# Terminal 2: Khởi động Frontend (React + Vite)
cd frontend
npm run dev
```

Truy cập ứng dụng: **http://localhost:5173**

---

## 5. Tài khoản demo

| Username | Password | Vai trò | Cơ sở |
|----------|----------|---------|-------|
| `b22cntt005` | `123456` | Sinh viên | Hà Đông |
| `b22attt005` | `123456` | Sinh viên | Hòa Lạc |
| `b22attt001` | `123456` | Sinh viên | TP. HCM |
| `gv_hd_01` | `gv123` | Giảng viên | Hà Đông |
| `qtv_01` | `qtv123` | Quản trị viên | Hà Đông (trung tâm) |



<div align="center">

**Nhóm  07 — Nhóm Lớp 10 — Môn Cơ sở dữ liệu phân tán**

Học viện Công nghệ Bưu chính Viễn thông

</div>
