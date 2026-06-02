# BAO CAO DU AN: HE THONG DANG KY HOC PHAN PHAN TAN

Cap nhat: 02/06/2026

## 1. Thong tin chung

- Ten de tai: He thong dang ky hoc phan phan tan
- Linh vuc: Co so du lieu phan tan, ung dung web quan ly dao tao
- Mo hinh trien khai: 3 co so dao tao, moi co so co database rieng
- Cac node trong he thong:
  - `HQHD`: Co so Ha Dong, dong vai tro gateway/trung tam
  - `HQHL`: Co so Hoa Lac
  - `HQHCM`: Co so TP. Ho Chi Minh

[CAN CHEN ANH 1: Anh bia bao cao gom ten truong, ten mon, ten de tai, nhom thuc hien, giao vien huong dan]

## 2. Ly do chon de tai

Dang ky hoc phan la nghiep vu quan trong trong cac truong dai hoc. Khi truong co nhieu co so dao tao, du lieu sinh vien, giang vien, phong hoc va lop hoc phan thuong phan tan theo tung co so. Neu tat ca du lieu deu tap trung vao mot may chu duy nhat, he thong de bi qua tai va phu thuoc vao mot diem loi duy nhat.

Vi vay, de tai xay dung mot he thong dang ky hoc phan theo mo hinh phan tan. Moi co so co database local de quan ly du lieu cua minh, dong thoi van cho phep sinh vien tra cuu va dang ky lop hoc phan o co so khac thong qua gateway trung tam.

## 3. Muc tieu du an

He thong duoc xay dung voi cac muc tieu chinh sau:

1. Ho tro sinh vien dang nhap, xem lop hoc phan dang mo, dang ky va huy dang ky hoc phan.
2. Ho tro sinh vien xem danh sach lop da dang ky va thoi khoa bieu ca nhan.
3. Ho tro giang vien xem thong tin giang day va lich day.
4. Ho tro quan tri vien quan ly du lieu dao tao tai co so cua minh.
5. Ho tro quan tri vien trung tam giam sat node va xem thong ke toan he thong.
6. Mo phong xu ly du lieu phan tan giua 3 co so: Ha Dong, Hoa Lac va TP. Ho Chi Minh.
7. Dam bao cac rang buoc nghiep vu dang ky nhu trung lich, trung hoc phan, si so lop va thoi gian dang ky.

## 4. Cong nghe su dung

### 4.1. Frontend

Frontend duoc code bang:

| Thanh phan | Cong nghe |
| --- | --- |
| Framework UI | React 18 |
| Build tool | Vite 5 |
| Ngon ngu | JavaScript JSX |
| Goi HTTP | Fetch API |
| Quan ly trang thai | React Hooks: `useState`, `useEffect`, `useMemo` |
| Luu phien dang nhap | `localStorage` |
| Port khi chay dev | `5173` |

Vai tro cua frontend:

- Hien thi giao dien dang nhap.
- Hien thi man hinh theo role cua nguoi dung.
- Goi API backend de lay du lieu.
- Luu token JWT sau khi dang nhap.
- Dieu huong request den API cua co so tuong ung hoac gateway `HQHD` khi can dang ky cheo co so.

Cac file frontend quan trong:

```text
frontend/src/App.jsx
frontend/src/main.jsx
frontend/src/config/api.js
frontend/src/pages/Login.jsx
frontend/src/pages/SinhVien/DanhSachDangKy.jsx
frontend/src/pages/SinhVien/XemThoiKhoaBieu.jsx
frontend/src/pages/GiangVien/TongQuan.jsx
frontend/src/pages/QuanTri/QuanLyDuLieu.jsx
frontend/src/pages/QuanTri/GiamSatNode.jsx
frontend/src/pages/QuanTri/ThongKe.jsx
frontend/src/components/NodeStatusBar.jsx
frontend/src/components/Pagination.jsx
```

[CAN CHEN ANH 2: Anh man hinh dang nhap cua he thong]
[CAN CHEN ANH 3: Anh giao dien sinh vien xem danh sach lop hoc phan]
[CAN CHEN ANH 4: Anh giao dien sinh vien xem lop da dang ky va huy dang ky]

### 4.2. Backend

Backend duoc code bang:

| Thanh phan | Cong nghe |
| --- | --- |
| Runtime | Node.js |
| Framework API | Express.js |
| Ngon ngu | JavaScript ES Module |
| Ket noi database | Thu vien `mssql` |
| Xac thuc | JWT voi thu vien `jsonwebtoken` |
| Cau hinh moi truong | `dotenv` |
| CORS | `cors` |
| Port mac dinh | `4000` |

Vai tro cua backend:

- Cung cap REST API cho frontend.
- Xac thuc nguoi dung bang JWT.
- Phan quyen theo role: sinh vien, giang vien, quan tri vien.
- Ket noi SQL Server local cua node dang chay.
- Goi stored procedure de xu ly nghiep vu dang ky hoc phan.
- Proxy request sang gateway hoac node khac khi can.
- Chuan hoa response tra ve frontend.
- Kiem tra tinh trang node thong qua API health.

Cac file backend quan trong:

```text
backend/server.js
backend/config/db.js
backend/config/nodes.js
backend/config/demo-users.js
backend/middleware/auth.js
backend/routes/auth.js
backend/routes/dangky.js
backend/routes/hocphan.js
backend/routes/sinhvien.js
backend/routes/giangvien.js
backend/routes/admin.js
backend/routes/thongke.js
backend/routes/nodes.js
backend/routes/internal.js
backend/utils/db.js
backend/utils/remoteApi.js
backend/utils/nodeProxy.js
backend/utils/tableCrud.js
backend/utils/queryCache.js
```

[CAN CHEN ANH 5: Anh terminal backend dang chay thanh cong o port 4000]

### 4.3. Database

Database su dung:

| Thanh phan | Cong nghe |
| --- | --- |
| He quan tri CSDL | Microsoft SQL Server |
| Mo hinh du lieu | Co so du lieu phan tan theo co so dao tao |
| Xu ly nghiep vu | Stored Procedure va Trigger |
| Node database | `HQHD`, `HQHL`, `HQHCM` |

Database luu cac bang nghiep vu nhu sinh vien, giang vien, hoc phan, lop hoc phan, phong hoc, lich hoc va dang ky hoc phan.

[CAN CHEN ANH 6: Anh SQL Server Management Studio hien thi 3 database/node]

## 5. Kien truc tong the he thong

He thong gom 3 lop chinh:

1. Frontend React: giao dien web cho sinh vien, giang vien va quan tri vien.
2. Backend Express: API server xu ly xac thuc, phan quyen, dieu phoi node va goi database.
3. SQL Server: database phan tan theo tung co so.

So do tong quan:

```text
Nguoi dung
   |
   v
Frontend React + Vite
   |
   v
  
Backend Node.js + Express
   |
   +-------------------+-------------------+
   |                   |                   |
   v                   v                   v
SQL Server HQHD    SQL Server HQHL    SQL Server HQHCM
```

Trong do:

- Sinh vien dang nhap tai co so nao thi backend local cua co so do xu ly du lieu sinh vien.
- Khi dang ky lop cung co so, request di den node local.
- Khi dang ky lop khac co so, request di qua gateway `HQHD`.
- Quan tri vien trung tam `HQHD` co the xem thong ke va tinh trang cac node.

[CAN CHEN ANH 7: So do kien truc 3 lop Frontend - Backend - Database]
[CAN CHEN ANH 8: So do 3 node HQHD, HQHL, HQHCM va huong request dang ky cheo]

## 6. Mo hinh phan tan

He thong duoc thiet ke theo mo hinh nhieu node/co so. Moi node backend chi ket noi truc tiep den database local cua minh thong qua nhom bien moi truong `LOCAL_*`.

### 6.1. Cac node

| Ma node | Co so | Vai tro |
| --- | --- | --- |
| `HQHD` | Ha Dong | Gateway/trung tam, xu ly nghiep vu tong hop va dang ky cheo |
| `HQHL` | Hoa Lac | Node chi nhanh, quan ly du lieu local Hoa Lac |
| `HQHCM` | TP. Ho Chi Minh | Node chi nhanh, quan ly du lieu local TP. HCM |

### 6.2. Nguyen tac ket noi

- `LOCAL_NODE` xac dinh backend dang chay tai node nao.
- `LOCAL_SERVER`, `LOCAL_INSTANCE`, `LOCAL_DATABASE`, `LOCAL_USER`, `LOCAL_PASSWORD` chi cau hinh database local.
- `HQHD_API_BASE`, `HQHL_API_BASE`, `HQHCM_API_BASE` dung de backend/frontend biet dia chi API cac node.
- Frontend co bien `VITE_API_HQHD`, `VITE_API_HQHL`, `VITE_API_HQHCM` de goi dung API theo co so.

### 6.3. Luong xu ly local va cheo co so

Dang ky cung co so:

```text
Sinh vien HQHL -> Frontend -> API HQHL -> DB HQHL
```

Dang ky khac co so:

```text
Sinh vien HQHL -> Frontend -> API/Gateway HQHD -> DB/procedure trung tam HQHD
```

Cach thiet ke nay giup he thong van co the xu ly dang ky cheo thong qua node trung tam, giam viec frontend phai biet chi tiet logic phan tan ben trong.

## 7. Cau truc thu muc du an

```text
CSDLPT/
  backend/
    config/
      db.js
      demo-users.js
      nodes.js
    middleware/
      auth.js
    routes/
      admin.js
      auth.js
      coso.js
      dangky.js
      giangvien.js
      hocphan.js
      internal.js
      lichhoc.js
      lophocphan.js
      nodes.js
      phonghoc.js
      sinhvien.js
      thoikhoabieu.js
      thongke.js
    utils/
      db.js
      nodeProxy.js
      queryCache.js
      remoteApi.js
      tableCrud.js
    server.js

  frontend/
    src/
      components/
        NodeStatusBar.jsx
        Pagination.jsx
      config/
        api.js
      pages/
        Login.jsx
        GiangVien/TongQuan.jsx
        QuanTri/GiamSatNode.jsx
        QuanTri/QuanLyDuLieu.jsx
        QuanTri/ThongKe.jsx
        SinhVien/DangKyHocPhan.jsx
        SinhVien/DanhSachDangKy.jsx
        SinhVien/XemThoiKhoaBieu.jsx
      App.jsx
      main.jsx
      styles.css

  package.json
  PROJECT_DOCUMENTATION.md
  README.md
```

## 8. Chuc nang he thong

### 8.1. Chuc nang chung

- Dang nhap he thong.
- Xac thuc bang JWT.
- Hien thi giao dien theo role nguoi dung.
- Kiem tra tinh trang API/database node.
- Hien thi loi nghiep vu tu backend cho nguoi dung.

### 8.2. Chuc nang sinh vien

Sinh vien co cac chuc nang:

1. Xem danh sach lop hoc phan dang mo.
2. Chon co so de xem lop hoc phan.
3. Xem lich hoc cua lop hoc phan.
4. Dang ky lop hoc phan.
5. Dang ky lop hoc phan khac co so.
6. Xem danh sach hoc phan da dang ky.
7. Huy dang ky hoc phan.
8. Xem thoi khoa bieu ca nhan.

[CAN CHEN ANH 9: Anh sinh vien chon co so de xem lop hoc phan]
[CAN CHEN ANH 10: Anh thong bao dang ky thanh cong hoac that bai]
[CAN CHEN ANH 11: Anh thoi khoa bieu sinh vien]

### 8.3. Chuc nang giang vien

Giang vien co cac chuc nang:

1. Dang nhap vao he thong.
2. Xem tong quan thong tin giang day.
3. Xem lop hoc phan phu trach.
4. Xem lich day theo du lieu lop hoc phan va session.

[CAN CHEN ANH 12: Anh man hinh tong quan giang vien]

### 8.4. Chuc nang quan tri vien

Quan tri vien co cac chuc nang:

1. Quan ly du lieu theo bang database.
2. Them, sua, xoa du lieu trong cac bang duoc phep.
3. Tim kiem nhanh trong bang.
4. Phan trang du lieu.
5. Quan ly du lieu theo co so.
6. Xem thong ke dang ky.
7. Giam sat tinh trang node neu la quan tri vien trung tam `HQHD`.

[CAN CHEN ANH 13: Anh giao dien quan ly du lieu cua quan tri vien]
[CAN CHEN ANH 14: Anh giao dien thong ke]
[CAN CHEN ANH 15: Anh giao dien giam sat node]

## 9. Phan quyen nguoi dung

| Role | Mo ta | Quyen chinh |
| --- | --- | --- |
| `sinhvien` | Sinh vien | Xem lop mo, dang ky, huy dang ky, xem lop da dang ky, xem thoi khoa bieu |
| `giangvien` | Giang vien | Xem thong tin giang day, lop phu trach, lich day |
| `quantrivien` | Quan tri vien | Quan ly du lieu co so, thong ke, giam sat node neu thuoc `HQHD` |

Backend su dung middleware:

```text
authenticate: kiem tra JWT hop le
requireRole([...]): kiem tra role co duoc phep goi API hay khong
```

## 10. Thiet ke co so du lieu

### 10.1. Cac bang chinh

| Bang | Chuc nang |
| --- | --- |
| `headquarter` | Luu thong tin co so dao tao |
| `department` | Luu thong tin khoa/phong ban |
| `student` | Luu thong tin sinh vien |
| `teacher` | Luu thong tin giang vien |
| `subject` | Luu thong tin hoc phan |
| `term` | Luu thong tin hoc ky va thoi gian dang ky |
| `timeslot` | Luu ca hoc |
| `room` | Luu phong hoc |
| `[class]` | Luu lop hoc phan |
| `[session]` | Luu buoi hoc/lich hoc cua lop |
| `registration` | Luu du lieu dang ky hoc phan |
| `curriculum` | Luu chuong trinh dao tao |
| `curriculum_subject` | Luu hoc phan trong chuong trinh |
| `prerequisite` | Luu hoc phan tien quyet |

### 10.2. Quan he xac dinh co so

```text
Co so sinh vien:
student -> department -> headquarter

Co so giang vien:
teacher -> department -> headquarter

Co so lop hoc phan:
class -> teacher -> department -> headquarter

Co so phong hoc:
room -> headquarter
```

[CAN CHEN ANH 16: So do ERD cac bang chinh]
[CAN CHEN ANH 17: Anh quan he student - department - headquarter]

### 10.3. Rang buoc nghiep vu quan trong

- Sinh vien chi duoc dang ky lop dang mo.
- Sinh vien chi duoc dang ky trong thoi gian mo dang ky cua hoc ky.
- Khong duoc dang ky trung mot lop.
- Khong duoc dang ky nhieu lop cua cung mot hoc phan trong cung hoc ky.
- Khong duoc dang ky lop bi trung lich.
- Khong duoc dang ky neu lop da du si so.
- Phong hoc phai co suc chua phu hop voi lop.

## 11. Stored Procedure va Trigger

### 11.1. Stored Procedure

| Procedure | Muc dich |
| --- | --- |
| `usp_GetClassesByCampus` | Lay danh sach lop hoc phan theo co so |
| `usp_CheckRegisterCondition` | Kiem tra dieu kien dang ky |
| `usp_RegisterClass` | Dang ky lop cung co so |
| `usp_RegisterCrossCampusClass` | Dang ky lop khac co so qua gateway `HQHD` |
| `usp_CancelRegistration` | Huy dang ky hoc phan |
| `usp_GetRegistrationResult` | Lay ket qua dang ky cua sinh vien |
| `usp_GetStudentTimetable` | Lay thoi khoa bieu sinh vien |
| `usp_StatsClassRegistrationByTerm` | Thong ke lop hoc phan theo hoc ky |
| `usp_StatsRegisteredStudentsByCampus` | Thong ke sinh vien dang ky theo co so |
| `usp_CheckCrossCampusRegistration` | Thong ke dang ky cheo co so |

### 11.2. Trigger

| Trigger | Bang | Chuc nang |
| --- | --- | --- |
| `trg_check_duplicate_subject_registration` | `registration` | Chan dang ky trung hoc phan trong cung hoc ky |
| `trg_check_schedule_conflict` | `registration` | Chan trung lich hoc |
| `trg_check_class_capacity` | `registration` | Chan vuot si so lop |
| `trg_check_room_capacity` | `[session]` | Chan xep lop vao phong khong du suc chua |

Backend khong thay the trigger. Backend goi procedure, procedure thao tac du lieu, trigger kiem tra rang buoc cuoi cung trong database.

[CAN CHEN ANH 18: Anh SQL Server hien thi danh sach stored procedure]
[CAN CHEN ANH 19: Anh SQL Server hien thi trigger trong database]

## 12. Cac API chinh

### 12.1. Xac thuc

```http
POST /api/auth/login
```

Body:

```json
{
  "username": "b22cntt005",
  "password": "123456"
}
```

Response:

```json
{
  "success": true,
  "token": "...",
  "user": {
    "id": "...",
    "role": "sinhvien",
    "maCS": "HQHD"
  }
}
```

### 12.2. Hoc phan va lop hoc phan

```http
GET /api/hocphan/available?maCS=HQHD
GET /api/hocphan/classes?maCS=HQHL
GET /api/hocphan/schedules?maCS=HQHCM&classIds=L01,L02
```

### 12.3. Dang ky hoc phan

```http
POST /api/dangky
```

Body:

```json
{
  "maLop": "L02_INT1358",
  "maCSLop": "HQHL"
}
```

Backend lay sinh vien tu JWT, khong tin client gui ma sinh vien.

### 12.4. Huy dang ky

```http
POST /api/dangky/cancel
```

Body:

```json
{
  "maDangKy": "REG000001"
}
```

### 12.5. Tra cuu sinh vien

```http
GET /api/sinhvien/registrations
GET /api/sinhvien/schedule
GET /api/thoikhoabieu?ID_student=...&ID_headquarter=...
```

### 12.6. Quan tri va thong ke

```http
GET /api/admin/tables
GET /api/admin/meta/:table
GET /api/admin/:table
POST /api/admin/:table
PUT /api/admin/:table
DELETE /api/admin/:table

GET /api/thongke/overview
GET /api/thongke/lophocphan?ID_term=...&ID_headquarter=...
GET /api/thongke/sinhvien-theo-coso?ID_headquarter=...
GET /api/thongke/dangky-cheo
```

[CAN CHEN ANH 20: Anh Postman hoac browser test API health/login]

## 13. Quy trinh nghiep vu dang ky hoc phan

### 13.1. Dang ky cung co so

Vi du: sinh vien Hoa Lac dang ky lop Hoa Lac.

```text
Frontend -> API HQHL -> DB HQHL
```

Cac buoc xu ly:

1. Frontend gui request `POST /api/dangky` kem `maLop` va `maCSLop`.
2. Backend xac thuc JWT de lay thong tin sinh vien.
3. Backend kiem tra ma lop va co so lop.
4. Backend lay thong tin lop hoc phan.
5. Backend goi `usp_CheckRegisterCondition`.
6. Backend sinh ma dang ky dang `REGxxxxxx`.
7. Backend goi `usp_RegisterClass` de ghi du lieu.
8. Database trigger kiem tra rang buoc cuoi cung.
9. Backend xoa cache sinh vien.
10. Backend tra ket qua ve frontend.

### 13.2. Dang ky khac co so

Vi du: sinh vien Hoa Lac dang ky lop TP. HCM.

```text
Frontend -> Gateway HQHD -> DB/procedure trung tam HQHD
```

Ly do di qua `HQHD`:

- `HQHD` dong vai tro gateway trung tam.
- Frontend goi `gatewayFetch('/api/dangky')` khi co so lop khac co so sinh vien.
- Backend may tram cung co co che proxy ve `HQHD` neu phat hien dang ky cheo.
- Procedure `usp_RegisterCrossCampusClass` xu ly dang ky cheo.

[CAN CHEN ANH 21: Sequence diagram dang ky cung co so]
[CAN CHEN ANH 22: Sequence diagram dang ky cheo co so qua HQHD]

### 13.3. Huy dang ky

```text
Frontend -> API local cua sinh vien -> DB local -> usp_CancelRegistration
```

Cac buoc xu ly:

1. Sinh vien bam nut huy dang ky.
2. Frontend hoi xac nhan.
3. Frontend gui `maDangKy` len backend.
4. Backend kiem tra ban ghi dang ky co thuoc sinh vien dang dang nhap hay khong.
5. Backend goi `usp_CancelRegistration`.
6. Database cap nhat trang thai va si so lop.
7. Backend xoa cache va tra ket qua.

## 14. Cache va xu ly offline

Backend co module `queryCache.js` de cache mot so ket qua hay duoc truy van lap lai:

- Danh sach dang ky cua sinh vien.
- Thoi khoa bieu sinh vien.
- Danh sach lop mo.

Sau khi dang ky hoac huy dang ky, backend goi xoa cache de dam bao du lieu hien thi moi nhat.

Khi database hoac node loi, backend co the tra response dang:

```json
{
  "success": false,
  "message": "Node HQHL hien khong kha dung",
  "node": "HQHL",
  "offline": true
}
```

[CAN CHEN ANH 23: Anh thong bao node offline tren giao dien]

## 15. Cau hinh moi truong

File `.env` dung de cau hinh node hien tai va dia chi cac API node.

Vi du cau hinh may tram Hoa Lac:

```env
LOCAL_NODE=HQHL
LOCAL_SERVER=26.54.47.104
LOCAL_INSTANCE=CSDLPTNHOM7
LOCAL_DATABASE=CSDL_HL
LOCAL_USER=sa
LOCAL_PASSWORD=123456

DB_POOL_MIN=2
DB_POOL_MAX=30
DB_POOL_IDLE_TIMEOUT_MS=300000
DB_CONNECTION_TIMEOUT_MS=5000
DB_REQUEST_TIMEOUT_MS=10000
DB_CANCEL_TIMEOUT_MS=1000

HQHD_API_BASE=http://26.28.246.97:4000
HQHL_API_BASE=http://26.54.47.104:4000
HQHCM_API_BASE=http://26.213.180.63:4000

VITE_API_LOCAL=http://localhost:4000
VITE_API_HQHD=http://26.28.246.97:4000
VITE_API_HQHL=http://26.54.47.104:4000
VITE_API_HQHCM=http://26.213.180.63:4000

JWT_SECRET=your-secret-key
```

Luu y:

- Sua `.env` xong phai restart backend.
- `LOCAL_*` chi tro den database local cua node hien tai.
- Khong nen dua password that vao bao cao chinh thuc neu nop cong khai.

## 16. Huong dan cai dat va chay project

### 16.1. Cai dependencies

Tai thu muc goc project:

```bash
npm install
```

Neu frontend co `package.json` rieng:

```bash
cd frontend
npm install
```

### 16.2. Chay backend

Tai thu muc goc project:

```bash
npm run server
```

Backend chay tai:

```text
http://localhost:4000
```

### 16.3. Chay frontend

Tai thu muc goc project:

```bash
npm run dev
```

Hoac:

```bash
npm run dev:frontend
```

Frontend chay tai:

```text
http://localhost:5173
```

### 16.4. Build frontend

```bash
npm run build:frontend
```

[CAN CHEN ANH 24: Anh frontend chay o http://localhost:5173]
[CAN CHEN ANH 25: Anh backend log request thanh cong]

## 17. Scripts trong package.json

| Lenh | Chuc nang |
| --- | --- |
| `npm run server` | Chay backend Express |
| `npm run dev` | Chay frontend Vite |
| `npm run dev:frontend` | Chay frontend Vite |
| `npm run build:frontend` | Build frontend |
| `npm run preview:frontend` | Preview ban build frontend |

## 18. Kiem thu chuc nang

| STT | Chuc nang | Du lieu kiem thu | Ket qua mong doi |
| --- | --- | --- | --- |
| 1 | Dang nhap | Tai khoan sinh vien hop le | Dang nhap thanh cong, nhan JWT |
| 2 | Xem lop mo | Chon `HQHD`, `HQHL`, `HQHCM` | Hien thi danh sach lop dang mo |
| 3 | Dang ky cung co so | Sinh vien va lop cung co so | Dang ky thanh cong neu du dieu kien |
| 4 | Dang ky cheo co so | Sinh vien chon lop o co so khac | Request di qua `HQHD`, tra ket qua thanh cong/that bai |
| 5 | Dang ky trung lop | Dang ky lai lop da dang ky | He thong bao loi nghiep vu |
| 6 | Dang ky trung lich | Chon lop trung lich voi lop da dang ky | He thong chan dang ky |
| 7 | Dang ky khi lop day | Lop het cho trong | He thong khong cho dang ky |
| 8 | Huy dang ky | Chon lop da dang ky | Trang thai doi sang huy, si so cap nhat |
| 9 | Xem thoi khoa bieu | Sinh vien co lop da dang ky | Hien thi lich hoc ca nhan |
| 10 | Quan ly du lieu | Quan tri vien them/sua/xoa | Du lieu cap nhat dung node |
| 11 | Thong ke | Quan tri vien xem bao cao | Hien thi so lieu thong ke |
| 12 | Giam sat node | Tat mot node/database | Giao dien bao node offline |

[CAN CHEN ANH 26: Bang ket qua test hoac anh test dang ky thanh cong]
[CAN CHEN ANH 27: Anh test loi trung lich/trung hoc phan]

## 19. Loi thuong gap va cach khac phuc

### 19.1. Backend khong ket noi duoc SQL Server

Nguyen nhan:

- Sai `LOCAL_SERVER`, `LOCAL_INSTANCE`, `LOCAL_DATABASE`.
- Sai user/password SQL Server.
- SQL Server service chua chay.
- Firewall chan ket noi.

Cach khac phuc:

- Kiem tra lai `.env`.
- Thu query `SELECT 1` trong SQL Server Management Studio.
- Kiem tra SQL Server Browser va TCP/IP.

### 19.2. Request bi timeout hoac 503

Nguyen nhan:

- Database bi lock/nghen.
- Query/procedure chay cham.
- Bang `registration` hoac `[session]` bi lock.

Cach kiem tra:

```sql
SELECT 1;
SELECT TOP 1 * FROM registration;
SELECT TOP 1 * FROM [session];
```

### 19.3. Dang ky tra 400 Bad Request

Day thuong la loi nghiep vu, khong phai loi frontend.

Nguyen nhan co the la:

- Lop da du si so.
- Lop khong mo dang ky.
- Ngoai thoi gian dang ky.
- Da dang ky lop do.
- Da dang ky mon do o lop khac trong cung hoc ky.
- Trung lich hoc.
- Dang ky cheo nhung `HQHD` thieu procedure hoac thieu du lieu.

### 19.4. Procedure khong ton tai

Can cai procedure tren dung node:

- `usp_GetClassesByCampus`: nen co tren cac node.
- `usp_RegisterCrossCampusClass`: can co tren `HQHD`.
- `usp_CheckCrossCampusRegistration`: can co tren `HQHD`.

## 20. Danh gia ket qua dat duoc

He thong da dat duoc cac ket qua:

1. Xay dung duoc ung dung web co frontend React va backend Express.
2. Ket noi duoc SQL Server theo node local.
3. Co co che dang nhap va phan quyen bang JWT.
4. Sinh vien co the xem lop mo, dang ky, huy dang ky va xem thoi khoa bieu.
5. Quan tri vien co the quan ly du lieu va xem thong ke.
6. He thong co mo hinh 3 node phan tan: `HQHD`, `HQHL`, `HQHCM`.
7. Co xu ly dang ky cung co so va dang ky cheo co so thong qua gateway `HQHD`.
8. Rang buoc nghiep vu duoc dat o database bang stored procedure va trigger.
9. Co co che cache va xu ly loi node offline.

## 21. Han che

Mot so han che hien tai:

1. Giao dien chua toi uu hoan toan cho moi kich thuoc man hinh.
2. Dang ky cheo hien di qua gateway `HQHD`, chua phai mo hinh 2PC truc tiep giua hai node doc lap.
3. Can dong bo stored procedure va trigger thu cong tren dung node.
4. Chua co he thong migration database tu dong.
5. Chua co test tu dong cho frontend/backend.
6. Chua co HTTPS, rate limiting va audit log day du cho moi thao tac quan trong.

## 22. Huong phat trien

Co the phat trien them:

1. Viet bo script migration SQL de cai bang, procedure va trigger dong bo.
2. Them unit test va integration test cho API dang ky.
3. Them audit log cho thao tac them/sua/xoa va dang ky hoc phan.
4. Cai tien giao dien thong ke bang bieu do.
5. Them export danh sach dang ky ra Excel/PDF.
6. Cai tien co che dong bo du lieu giua cac node.
7. Them retry va circuit breaker khi node khac offline.
8. Trien khai HTTPS va quan ly secret an toan hon.

## 23. Ket luan

Project la he thong dang ky hoc phan phan tan cho 3 co so dao tao. He thong su dung React + Vite cho frontend, Node.js + Express cho backend va SQL Server cho database. Backend dong vai tro dieu phoi request, xac thuc nguoi dung, phan quyen, goi stored procedure va proxy request khi can. Database dam nhan phan lon rang buoc nghiep vu thong qua stored procedure va trigger.

Ket qua dat duoc cho thay he thong co the xu ly cac nghiep vu co ban cua dang ky hoc phan, dong thoi mo phong duoc bai toan du lieu phan tan giua nhieu co so. Diem quan trong khi van hanh la phai cau hinh dung node, dong bo procedure/trigger tren dung database va dam bao SQL Server cua tung co so hoat dong on dinh.

## 24. Phu luc: vi tri anh can chen

Danh sach anh nen chen vao bao cao:

| So anh | Noi dung anh | Vi tri nen chen |
| --- | --- | --- |
| 1 | Bia bao cao | Muc 1 |
| 2 | Man hinh dang nhap | Muc 4.1 |
| 3 | Sinh vien xem lop mo | Muc 4.1 hoac 8.2 |
| 4 | Sinh vien xem lop da dang ky | Muc 4.1 hoac 8.2 |
| 5 | Terminal backend port 4000 | Muc 4.2 |
| 6 | SQL Server 3 database/node | Muc 4.3 |
| 7 | So do kien truc tong the | Muc 5 |
| 8 | So do 3 node phan tan | Muc 5 |
| 9 | Chon co so xem lop | Muc 8.2 |
| 10 | Thong bao dang ky thanh cong/that bai | Muc 8.2 |
| 11 | Thoi khoa bieu sinh vien | Muc 8.2 |
| 12 | Man hinh giang vien | Muc 8.3 |
| 13 | Quan ly du lieu admin | Muc 8.4 |
| 14 | Thong ke | Muc 8.4 |
| 15 | Giam sat node | Muc 8.4 |
| 16 | ERD database | Muc 10.2 |
| 17 | Quan he student-department-headquarter | Muc 10.2 |
| 18 | Stored procedure tren SQL Server | Muc 11.1 |
| 19 | Trigger tren SQL Server | Muc 11.2 |
| 20 | Test API login/health bang Postman | Muc 12 |
| 21 | Sequence dang ky cung co so | Muc 13.1 |
| 22 | Sequence dang ky cheo co so | Muc 13.2 |
| 23 | Node offline | Muc 14 |
| 24 | Frontend localhost:5173 | Muc 16 |
| 25 | Backend log request | Muc 16 |
| 26 | Test dang ky thanh cong | Muc 18 |
| 27 | Test loi trung lich/trung hoc phan | Muc 18 |
