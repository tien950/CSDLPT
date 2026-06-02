USE DkyTinChi;
GO

/* =========================================================
   XÓA DỮ LIỆU CŨ
========================================================= */

DELETE FROM registration;
DELETE FROM [session];
DELETE FROM [class];
DELETE FROM student;
DELETE FROM teacher;
DELETE FROM room;
DELETE FROM prerequisite;
DELETE FROM curriculum_subject;
DELETE FROM timeslot;
DELETE FROM term;
DELETE FROM subject;
DELETE FROM curriculum;
DELETE FROM department;
DELETE FROM headquarter;
GO

/* =========================================================
   1. HEADQUARTER
========================================================= */

INSERT INTO headquarter(ID_headquarter, name_headquarter, address)
VALUES
('HQHD',  N'Trụ sở chính Hà Đông', N'96A Trần Phú, Hà Đông, Hà Nội'),
('HQHL',  N'Cơ sở Hòa Lạc', N'Khu Công nghệ cao Hòa Lạc, Hà Nội'),
('HQHCM', N'Cơ sở TP. Hồ Chí Minh', N'Quận 9, TP. Hồ Chí Minh');
GO

/* =========================================================
   2. DEPARTMENT
   Quy ước:
   1: Hà Đông
   2: Hòa Lạc
   3: TP. Hồ Chí Minh
========================================================= */

INSERT INTO department(ID_department, name_department, ID_headquarter)
VALUES
('D_HD_CNTT',  N'Công nghệ thông tin 1', 'HQHD'),
('D_HD_ATTT',  N'An toàn thông tin 1', 'HQHD'),
('D_HD_DTVT',  N'Điện tử viễn thông 1', 'HQHD'),
('D_HD_QTKD',  N'Quản trị kinh doanh 1', 'HQHD'),

('D_HL_CNTT',  N'Công nghệ thông tin 2', 'HQHL'),
('D_HL_ATTT',  N'An toàn thông tin 2', 'HQHL'),
('D_HL_DTVT',  N'Điện tử viễn thông 2', 'HQHL'),
('D_HL_QTKD',  N'Quản trị kinh doanh 2', 'HQHL'),

('D_HCM_CNTT', N'Công nghệ thông tin 3', 'HQHCM'),
('D_HCM_ATTT', N'An toàn thông tin 3', 'HQHCM'),
('D_HCM_DTVT', N'Điện tử viễn thông 3', 'HQHCM'),
('D_HCM_QTKD', N'Quản trị kinh doanh 3', 'HQHCM');
GO

/* =========================================================
   3. SUBJECT
========================================================= */

INSERT INTO subject(ID_subject, name_subject, number_of_credit)
VALUES
('BAS1102', N'Kinh tế chính trị Mác - Lênin', 2),
('BAS1105', N'Tư tưởng Hồ Chí Minh', 2),
('BAS1201', N'Giải tích 1', 3),
('BAS1202', N'Giải tích 2', 3),
('BAS1203', N'Đại số', 3),
('BAS1224', N'Vật lý 1', 3),
('BAS1231', N'Lý thuyết xác suất và thống kê toán', 3),

('INT1306', N'Cơ sở dữ liệu', 3),
('INT1310', N'Hệ quản trị cơ sở dữ liệu', 3),
('INT1313', N'Cơ sở dữ liệu phân tán', 3),
('INT1316', N'Lập trình Java', 3),
('INT1327', N'Công nghệ phần mềm', 3),
('INT1332', N'Lập trình hướng đối tượng', 3),
('INT1339', N'Ngôn ngữ lập trình C++', 3),
('INT1340', N'Thiết kế đồ họa', 2),
('INT1345', N'Kiến trúc hệ thống máy tính', 3),
('INT1358', N'Lập trình Web', 3),
('INT1359', N'Lập trình di động', 3),
('INT1367', N'Lập trình Android', 3),
('INT1408', N'Trí tuệ nhân tạo', 3),
('INT1416', N'Cơ sở dữ liệu phân tán nâng cao', 3),
('INT1434', N'Phân tích và thiết kế hệ thống', 3),

('NET1301', N'Mạng máy tính', 3),
('NET1402', N'Quản trị mạng', 3),
('SEC1301', N'An toàn thông tin', 3),
('SEC1401', N'Mật mã học', 3),

('ELE1301', N'Cơ sở điện tử viễn thông', 3),
('ELE1401', N'Internet of Things', 3),

('BUS1301', N'Marketing căn bản', 2),
('BUS1302', N'Quản trị doanh nghiệp', 3),
('BUS1401', N'Thương mại điện tử', 3),
('LOG1301', N'Logistics', 3);
GO

/* =========================================================
   4. CURRICULUM
========================================================= */

INSERT INTO curriculum(ID_curriculum, curriculum_name, total_credits_required)
VALUES
('CUR_CNTT', N'Chương trình Công nghệ thông tin', 130),
('CUR_ATTT', N'Chương trình An toàn thông tin', 132),
('CUR_KTPM', N'Chương trình Kỹ thuật phần mềm', 130),
('CUR_DTVT', N'Chương trình Điện tử viễn thông', 135),
('CUR_QTKD', N'Chương trình Quản trị kinh doanh', 125),
('CUR_TMDT', N'Chương trình Thương mại điện tử', 128);
GO

/* =========================================================
   5. CURRICULUM_SUBJECT
========================================================= */

INSERT INTO curriculum_subject(ID_curriculum, ID_subject, is_required)
VALUES
('CUR_CNTT', 'BAS1201', 1),
('CUR_CNTT', 'BAS1202', 1),
('CUR_CNTT', 'INT1306', 1),
('CUR_CNTT', 'INT1310', 1),
('CUR_CNTT', 'INT1313', 1),
('CUR_CNTT', 'INT1316', 1),
('CUR_CNTT', 'INT1327', 1),
('CUR_CNTT', 'INT1332', 1),
('CUR_CNTT', 'INT1339', 1),
('CUR_CNTT', 'INT1358', 1),
('CUR_CNTT', 'INT1408', 0),
('CUR_CNTT', 'INT1434', 1),

('CUR_ATTT', 'BAS1231', 1),
('CUR_ATTT', 'INT1306', 1),
('CUR_ATTT', 'NET1301', 1),
('CUR_ATTT', 'NET1402', 1),
('CUR_ATTT', 'SEC1301', 1),
('CUR_ATTT', 'SEC1401', 1),
('CUR_ATTT', 'INT1313', 0),

('CUR_KTPM', 'INT1306', 1),
('CUR_KTPM', 'INT1316', 1),
('CUR_KTPM', 'INT1327', 1),
('CUR_KTPM', 'INT1332', 1),
('CUR_KTPM', 'INT1358', 1),
('CUR_KTPM', 'INT1434', 1),

('CUR_DTVT', 'BAS1224', 1),
('CUR_DTVT', 'ELE1301', 1),
('CUR_DTVT', 'ELE1401', 1),
('CUR_DTVT', 'NET1301', 1),
('CUR_DTVT', 'INT1345', 1),

('CUR_QTKD', 'BAS1102', 1),
('CUR_QTKD', 'BUS1301', 1),
('CUR_QTKD', 'BUS1302', 1),
('CUR_QTKD', 'LOG1301', 1),
('CUR_QTKD', 'BUS1401', 0),

('CUR_TMDT', 'BUS1301', 1),
('CUR_TMDT', 'BUS1302', 1),
('CUR_TMDT', 'BUS1401', 1),
('CUR_TMDT', 'INT1358', 1),
('CUR_TMDT', 'INT1306', 1),
('CUR_TMDT', 'LOG1301', 0);
GO

/* =========================================================
   6. PREREQUISITE
========================================================= */

INSERT INTO prerequisite(ID_subject, ID_prereq_subject, min_grade, note)
VALUES
('INT1310', 'INT1306', 4.0, N'Phải qua Cơ sở dữ liệu'),
('INT1313', 'INT1306', 4.0, N'Phải qua Cơ sở dữ liệu trước khi học CSDL phân tán'),
('INT1316', 'INT1332', 4.0, N'Phải qua Lập trình hướng đối tượng'),
('INT1327', 'INT1332', 4.0, N'Phải qua Lập trình hướng đối tượng'),
('INT1358', 'INT1332', 4.0, N'Phải qua Lập trình hướng đối tượng'),
('INT1367', 'INT1359', 4.0, N'Phải qua Lập trình di động'),
('INT1408', 'BAS1231', 4.0, N'Phải qua Xác suất thống kê'),
('INT1434', 'INT1306', 4.0, N'Phải có kiến thức về Cơ sở dữ liệu'),
('NET1402', 'NET1301', 4.0, N'Phải qua Mạng máy tính'),
('SEC1301', 'NET1301', 4.0, N'Phải qua Mạng máy tính'),
('SEC1401', 'SEC1301', 4.0, N'Phải qua An toàn thông tin'),
('ELE1401', 'ELE1301', 4.0, N'Phải qua Cơ sở điện tử viễn thông'),
('BUS1401', 'BUS1301', 4.0, N'Phải qua Marketing căn bản'),
('LOG1301', 'BUS1302', 4.0, N'Phải qua Quản trị doanh nghiệp');
GO

/* =========================================================
   7. TERM
   reg_open/reg_close bao quanh GETDATE để demo đăng ký được
========================================================= */

INSERT INTO term
(
    ID_term,
    name_term,
    year_start,
    term_no,
    start_date,
    end_date,
    reg_open,
    reg_close
)
VALUES
('HK251', N'Học kỳ 1 năm học 2025-2026', 2025, 1, '2025-08-15', '2025-12-30', DATEADD(DAY, -30, GETDATE()), DATEADD(DAY, 60, GETDATE())),
('HK252', N'Học kỳ 2 năm học 2025-2026', 2025, 2, '2026-02-15', '2026-06-30', DATEADD(DAY, -30, GETDATE()), DATEADD(DAY, 60, GETDATE())),
('HK253', N'Học kỳ phụ năm học 2025-2026', 2025, 3, '2026-07-01', '2026-08-10', DATEADD(DAY, -30, GETDATE()), DATEADD(DAY, 60, GETDATE())),
('HK261', N'Học kỳ 1 năm học 2026-2027', 2026, 1, '2026-08-15', '2026-12-30', DATEADD(DAY, -30, GETDATE()), DATEADD(DAY, 60, GETDATE())),
('HK262', N'Học kỳ 2 năm học 2026-2027', 2026, 2, '2027-02-15', '2027-06-30', DATEADD(DAY, -30, GETDATE()), DATEADD(DAY, 60, GETDATE()));
GO

/* =========================================================
   8. TIMESLOT
========================================================= */

INSERT INTO timeslot(ID_timeslot, shift_no, start_time, end_time)
VALUES
('TS01', 1, '07:00', '09:00'),
('TS02', 2, '09:15', '11:15'),
('TS03', 3, '13:00', '15:00'),
('TS04', 4, '15:15', '17:15'),
('TS05', 5, '18:00', '20:00'),
('TS06', 6, '20:15', '21:45');
GO

/* =========================================================
   9. TEACHER
   ID: GV001 -> GV036
========================================================= */

INSERT INTO teacher(ID_teacher, name_teacher, degree, address_teacher, phone_teacher, gender_teacher, ID_department)
VALUES
('GV001', N'Nguyễn Văn Thành', N'Tiến sĩ', N'Hà Đông, Hà Nội', '0902000001', N'Nam', 'D_HD_CNTT'),
('GV002', N'Lê Thị Mai', N'Thạc sĩ', N'Hà Đông, Hà Nội', '0902000002', N'Nữ', 'D_HD_CNTT'),
('GV003', N'Trần Văn Hùng', N'Tiến sĩ', N'Hà Đông, Hà Nội', '0902000003', N'Nam', 'D_HD_CNTT'),
('GV004', N'Phạm Minh Đức', N'Thạc sĩ', N'Hà Đông, Hà Nội', '0902000004', N'Nam', 'D_HD_ATTT'),
('GV005', N'Hoàng Thu Trang', N'Tiến sĩ', N'Hà Đông, Hà Nội', '0902000005', N'Nữ', 'D_HD_ATTT'),
('GV006', N'Đặng Văn Nam', N'Thạc sĩ', N'Hà Đông, Hà Nội', '0902000006', N'Nam', 'D_HD_ATTT'),
('GV007', N'Vũ Hoàng Anh', N'Tiến sĩ', N'Hà Đông, Hà Nội', '0902000007', N'Nam', 'D_HD_DTVT'),
('GV008', N'Ngô Bảo Châu', N'Thạc sĩ', N'Hà Đông, Hà Nội', '0902000008', N'Nữ', 'D_HD_DTVT'),
('GV009', N'Bùi Quang Vinh', N'Thạc sĩ', N'Hà Đông, Hà Nội', '0902000009', N'Nam', 'D_HD_DTVT'),
('GV010', N'Lý Hải Yến', N'Thạc sĩ', N'Hà Đông, Hà Nội', '0902000010', N'Nữ', 'D_HD_QTKD'),
('GV011', N'Phan Thanh Bình', N'Tiến sĩ', N'Hà Đông, Hà Nội', '0902000011', N'Nam', 'D_HD_QTKD'),
('GV012', N'Đỗ Mỹ Linh', N'Thạc sĩ', N'Hà Đông, Hà Nội', '0902000012', N'Nữ', 'D_HD_QTKD'),

('GV013', N'Trịnh Xuân Thành', N'Tiến sĩ', N'Hòa Lạc, Hà Nội', '0902000013', N'Nam', 'D_HL_CNTT'),
('GV014', N'Mai Văn Phan', N'Thạc sĩ', N'Hòa Lạc, Hà Nội', '0902000014', N'Nam', 'D_HL_CNTT'),
('GV015', N'Lê Quang Diệu', N'Thạc sĩ', N'Hòa Lạc, Hà Nội', '0902000015', N'Nữ', 'D_HL_CNTT'),
('GV016', N'Nguyễn Kim Chi', N'Thạc sĩ', N'Hòa Lạc, Hà Nội', '0902000016', N'Nữ', 'D_HL_ATTT'),
('GV017', N'Vương Đình Huệ', N'Tiến sĩ', N'Hòa Lạc, Hà Nội', '0902000017', N'Nam', 'D_HL_ATTT'),
('GV018', N'Trần Cẩm Tú', N'Thạc sĩ', N'Hòa Lạc, Hà Nội', '0902000018', N'Nữ', 'D_HL_ATTT'),
('GV019', N'Hồ Đức Phúc', N'Tiến sĩ', N'Hòa Lạc, Hà Nội', '0902000019', N'Nam', 'D_HL_DTVT'),
('GV020', N'Nguyễn Văn Thắng', N'Thạc sĩ', N'Hòa Lạc, Hà Nội', '0902000020', N'Nam', 'D_HL_DTVT'),
('GV021', N'Lâm Thị Hồng', N'Thạc sĩ', N'Hòa Lạc, Hà Nội', '0902000021', N'Nữ', 'D_HL_DTVT'),
('GV022', N'Đào Văn Minh', N'Tiến sĩ', N'Hòa Lạc, Hà Nội', '0902000022', N'Nam', 'D_HL_QTKD'),
('GV023', N'Phạm Thùy Dương', N'Thạc sĩ', N'Hòa Lạc, Hà Nội', '0902000023', N'Nữ', 'D_HL_QTKD'),
('GV024', N'Hoàng Gia Bảo', N'Thạc sĩ', N'Hòa Lạc, Hà Nội', '0902000024', N'Nam', 'D_HL_QTKD'),

('GV025', N'Nguyễn Thị Thanh', N'Tiến sĩ', N'TP. Hồ Chí Minh', '0902000025', N'Nữ', 'D_HCM_CNTT'),
('GV026', N'Phạm Quốc Cường', N'Thạc sĩ', N'TP. Hồ Chí Minh', '0902000026', N'Nam', 'D_HCM_CNTT'),
('GV027', N'Đinh Tuấn Kiệt', N'Thạc sĩ', N'TP. Hồ Chí Minh', '0902000027', N'Nam', 'D_HCM_CNTT'),
('GV028', N'Bùi Thị Lan Anh', N'Tiến sĩ', N'TP. Hồ Chí Minh', '0902000028', N'Nữ', 'D_HCM_ATTT'),
('GV029', N'Cao Minh Quân', N'Thạc sĩ', N'TP. Hồ Chí Minh', '0902000029', N'Nam', 'D_HCM_ATTT'),
('GV030', N'Đặng Hoàng Long', N'Thạc sĩ', N'TP. Hồ Chí Minh', '0902000030', N'Nam', 'D_HCM_ATTT'),
('GV031', N'Võ Thành Trung', N'Tiến sĩ', N'TP. Hồ Chí Minh', '0902000031', N'Nam', 'D_HCM_DTVT'),
('GV032', N'Lưu Khánh Linh', N'Thạc sĩ', N'TP. Hồ Chí Minh', '0902000032', N'Nữ', 'D_HCM_DTVT'),
('GV033', N'Chu Văn Khải', N'Thạc sĩ', N'TP. Hồ Chí Minh', '0902000033', N'Nam', 'D_HCM_DTVT'),
('GV034', N'Hà Minh Phương', N'Tiến sĩ', N'TP. Hồ Chí Minh', '0902000034', N'Nữ', 'D_HCM_QTKD'),
('GV035', N'Tạ Quang Huy', N'Thạc sĩ', N'TP. Hồ Chí Minh', '0902000035', N'Nam', 'D_HCM_QTKD'),
('GV036', N'Nguyễn Bảo Ngọc', N'Thạc sĩ', N'TP. Hồ Chí Minh', '0902000036', N'Nữ', 'D_HCM_QTKD');
GO

/* =========================================================
   10. STUDENT
   ID tự sinh:
   B + 2 số cuối year_of_admission + mã khoa + 3 số tăng dần
   year_of_admission = năm sinh + 18
========================================================= */

WITH student_source AS
(
    SELECT *
    FROM (VALUES
    (N'Hoàng Văn Dũng', '2004-05-15', N'Nam', N'Hà Đông, Hà Nội', 'D_HD_CNTT', 'CNTT', 'CUR_CNTT'),
    (N'Nguyễn Thị Lan', '2004-02-20', N'Nữ', N'Hà Đông, Hà Nội', 'D_HD_CNTT', 'CNTT', 'CUR_CNTT'),
    (N'Nguyễn Văn An', '2004-01-01', N'Nam', N'Hà Đông, Hà Nội', 'D_HD_CNTT', 'CNTT', 'CUR_KTPM'),
    (N'Lê Minh Tâm', '2004-10-10', N'Nam', N'Hà Đông, Hà Nội', 'D_HD_CNTT', 'CNTT', 'CUR_KTPM'),
    (N'Bùi Đức Chung', '2005-06-06', N'Nam', N'Hà Đông, Hà Nội', 'D_HD_CNTT', 'CNTT', 'CUR_CNTT'),
    (N'Mai Phương Thảo', '2005-03-12', N'Nữ', N'Hà Đông, Hà Nội', 'D_HD_CNTT', 'CNTT', 'CUR_KTPM'),

    (N'Phạm Thu Trang', '2004-11-15', N'Nữ', N'Hà Đông, Hà Nội', 'D_HD_ATTT', 'ATTT', 'CUR_ATTT'),
    (N'Võ Văn Kiệt', '2004-03-15', N'Nam', N'Hà Đông, Hà Nội', 'D_HD_ATTT', 'ATTT', 'CUR_ATTT'),
    (N'Trần Hải Đăng', '2005-08-21', N'Nam', N'Hà Đông, Hà Nội', 'D_HD_ATTT', 'ATTT', 'CUR_ATTT'),
    (N'Đặng Như Quỳnh', '2005-12-02', N'Nữ', N'Hà Đông, Hà Nội', 'D_HD_ATTT', 'ATTT', 'CUR_ATTT'),

    (N'Nguyễn Minh Phúc', '2004-07-12', N'Nam', N'Hà Đông, Hà Nội', 'D_HD_DTVT', 'DTVT', 'CUR_DTVT'),
    (N'Lê Gia Hân', '2004-09-09', N'Nữ', N'Hà Đông, Hà Nội', 'D_HD_DTVT', 'DTVT', 'CUR_DTVT'),
    (N'Phan Quốc Bảo', '2005-04-24', N'Nam', N'Hà Đông, Hà Nội', 'D_HD_DTVT', 'DTVT', 'CUR_DTVT'),
    (N'Đỗ Khánh Linh', '2005-06-30', N'Nữ', N'Hà Đông, Hà Nội', 'D_HD_DTVT', 'DTVT', 'CUR_DTVT'),

    (N'Trịnh Mỹ Linh', '2004-09-05', N'Nữ', N'Hà Đông, Hà Nội', 'D_HD_QTKD', 'QTKD', 'CUR_QTKD'),
    (N'Lý Thanh Tùng', '2004-07-19', N'Nam', N'Hà Đông, Hà Nội', 'D_HD_QTKD', 'QTKD', 'CUR_QTKD'),
    (N'Phạm Tuấn Anh', '2005-01-22', N'Nam', N'Hà Đông, Hà Nội', 'D_HD_QTKD', 'QTKD', 'CUR_TMDT'),
    (N'Ngô Thùy Dương', '2005-10-03', N'Nữ', N'Hà Đông, Hà Nội', 'D_HD_QTKD', 'QTKD', 'CUR_TMDT'),

    (N'Trần Thị Thanh Thúy', '2004-04-12', N'Nữ', N'Hòa Lạc, Hà Nội', 'D_HL_CNTT', 'CNTT', 'CUR_CNTT'),
    (N'Nguyễn Hoàng Hải', '2004-08-25', N'Nam', N'Hòa Lạc, Hà Nội', 'D_HL_CNTT', 'CNTT', 'CUR_KTPM'),
    (N'Đỗ Thành Nam', '2005-02-08', N'Nam', N'Hòa Lạc, Hà Nội', 'D_HL_CNTT', 'CNTT', 'CUR_CNTT'),
    (N'Vũ Minh Châu', '2005-11-19', N'Nữ', N'Hòa Lạc, Hà Nội', 'D_HL_CNTT', 'CNTT', 'CUR_KTPM'),
    (N'Phạm Quang Huy', '2004-06-13', N'Nam', N'Hòa Lạc, Hà Nội', 'D_HL_CNTT', 'CNTT', 'CUR_CNTT'),
    (N'Lê Ngọc Mai', '2005-05-27', N'Nữ', N'Hòa Lạc, Hà Nội', 'D_HL_CNTT', 'CNTT', 'CUR_KTPM'),

    (N'Bùi Đức Mạnh', '2004-12-20', N'Nam', N'Hòa Lạc, Hà Nội', 'D_HL_ATTT', 'ATTT', 'CUR_ATTT'),
    (N'Nguyễn Thảo Nhi', '2004-03-03', N'Nữ', N'Hòa Lạc, Hà Nội', 'D_HL_ATTT', 'ATTT', 'CUR_ATTT'),
    (N'Trần Quốc Khánh', '2005-09-18', N'Nam', N'Hòa Lạc, Hà Nội', 'D_HL_ATTT', 'ATTT', 'CUR_ATTT'),
    (N'Đặng Hải Yến', '2005-07-14', N'Nữ', N'Hòa Lạc, Hà Nội', 'D_HL_ATTT', 'ATTT', 'CUR_ATTT'),

    (N'Hoàng Trung Kiên', '2004-01-28', N'Nam', N'Hòa Lạc, Hà Nội', 'D_HL_DTVT', 'DTVT', 'CUR_DTVT'),
    (N'Phan Nhật Minh', '2004-10-22', N'Nam', N'Hòa Lạc, Hà Nội', 'D_HL_DTVT', 'DTVT', 'CUR_DTVT'),
    (N'Vũ Thu Hà', '2005-06-17', N'Nữ', N'Hòa Lạc, Hà Nội', 'D_HL_DTVT', 'DTVT', 'CUR_DTVT'),
    (N'Lê Quang Đại', '2005-12-11', N'Nam', N'Hòa Lạc, Hà Nội', 'D_HL_DTVT', 'DTVT', 'CUR_DTVT'),

    (N'Cao Thị Hương', '2004-02-14', N'Nữ', N'Hòa Lạc, Hà Nội', 'D_HL_QTKD', 'QTKD', 'CUR_QTKD'),
    (N'Nguyễn Gia Bảo', '2004-05-31', N'Nam', N'Hòa Lạc, Hà Nội', 'D_HL_QTKD', 'QTKD', 'CUR_TMDT'),
    (N'Trần Khánh Vy', '2005-08-03', N'Nữ', N'Hòa Lạc, Hà Nội', 'D_HL_QTKD', 'QTKD', 'CUR_QTKD'),
    (N'Đỗ Minh Nhật', '2005-04-09', N'Nam', N'Hòa Lạc, Hà Nội', 'D_HL_QTKD', 'QTKD', 'CUR_TMDT'),

    (N'Trần Phương Nam', '2004-02-15', N'Nam', N'TP. Hồ Chí Minh', 'D_HCM_CNTT', 'CNTT', 'CUR_CNTT'),
    (N'Phạm Minh Khôi', '2004-11-11', N'Nam', N'TP. Hồ Chí Minh', 'D_HCM_CNTT', 'CNTT', 'CUR_KTPM'),
    (N'Nguyễn Hà My', '2005-01-05', N'Nữ', N'TP. Hồ Chí Minh', 'D_HCM_CNTT', 'CNTT', 'CUR_CNTT'),
    (N'Lê Anh Khoa', '2005-09-22', N'Nam', N'TP. Hồ Chí Minh', 'D_HCM_CNTT', 'CNTT', 'CUR_KTPM'),
    (N'Võ Nhật Anh', '2004-07-07', N'Nam', N'TP. Hồ Chí Minh', 'D_HCM_CNTT', 'CNTT', 'CUR_CNTT'),
    (N'Đặng Thùy Linh', '2005-06-16', N'Nữ', N'TP. Hồ Chí Minh', 'D_HCM_CNTT', 'CNTT', 'CUR_KTPM'),

    (N'Phạm Ngọc Hân', '2004-06-06', N'Nữ', N'TP. Hồ Chí Minh', 'D_HCM_ATTT', 'ATTT', 'CUR_ATTT'),
    (N'Ngô Gia Huy', '2004-12-24', N'Nam', N'TP. Hồ Chí Minh', 'D_HCM_ATTT', 'ATTT', 'CUR_ATTT'),
    (N'Lê Bảo Trâm', '2005-05-02', N'Nữ', N'TP. Hồ Chí Minh', 'D_HCM_ATTT', 'ATTT', 'CUR_ATTT'),
    (N'Trần Minh Quang', '2005-09-09', N'Nam', N'TP. Hồ Chí Minh', 'D_HCM_ATTT', 'ATTT', 'CUR_ATTT'),

    (N'Nguyễn Đức Long', '2004-03-19', N'Nam', N'TP. Hồ Chí Minh', 'D_HCM_DTVT', 'DTVT', 'CUR_DTVT'),
    (N'Lâm Khánh An', '2004-08-04', N'Nữ', N'TP. Hồ Chí Minh', 'D_HCM_DTVT', 'DTVT', 'CUR_DTVT'),
    (N'Tạ Minh Đức', '2005-02-27', N'Nam', N'TP. Hồ Chí Minh', 'D_HCM_DTVT', 'DTVT', 'CUR_DTVT'),
    (N'Bùi Thảo Nguyên', '2005-10-18', N'Nữ', N'TP. Hồ Chí Minh', 'D_HCM_DTVT', 'DTVT', 'CUR_DTVT'),

    (N'Hoàng Bảo Châu', '2004-01-13', N'Nữ', N'TP. Hồ Chí Minh', 'D_HCM_QTKD', 'QTKD', 'CUR_QTKD'),
    (N'Vũ Anh Tuấn', '2004-09-29', N'Nam', N'TP. Hồ Chí Minh', 'D_HCM_QTKD', 'QTKD', 'CUR_TMDT'),
    (N'Đinh Ngọc Ánh', '2005-03-07', N'Nữ', N'TP. Hồ Chí Minh', 'D_HCM_QTKD', 'QTKD', 'CUR_QTKD'),
    (N'Cao Trung Hiếu', '2005-11-25', N'Nam', N'TP. Hồ Chí Minh', 'D_HCM_QTKD', 'QTKD', 'CUR_TMDT')
    ) AS x(name_student, date_of_birth, gender_student, address_student, ID_department, dept_code, ID_curriculum)
),
numbered AS
(
    SELECT
        *,
        YEAR(CAST(date_of_birth AS date)) + 18 AS year_of_admission,
        ROW_NUMBER() OVER (
            PARTITION BY YEAR(CAST(date_of_birth AS date)) + 18, dept_code
            ORDER BY ID_department, name_student
        ) AS stt,
        ROW_NUMBER() OVER (ORDER BY ID_department, name_student) AS phone_no
    FROM student_source
)
INSERT INTO student
(
    ID_student,
    name_student,
    date_of_birth,
    gender_student,
    address_student,
    phone_student,
    year_of_admission,
    ID_department,
    ID_curriculum
)
SELECT
    'B'
        + RIGHT(CAST(year_of_admission AS varchar(4)), 2)
    + dept_code
    + RIGHT('000' + CAST(stt AS varchar(3)), 3),
    name_student,
    CAST(date_of_birth AS date),
    gender_student,
    address_student,
    '091' + RIGHT('0000000' + CAST(phone_no AS varchar(7)), 7),
    year_of_admission,
    ID_department,
    ID_curriculum
FROM numbered;
GO

/* =========================================================
   11. ROOM
========================================================= */

INSERT INTO room(ID_room, name_room, capacity, ID_headquarter)
VALUES
('R_A101_HD', N'A101', 60, 'HQHD'),
('R_A102_HD', N'A102', 50, 'HQHD'),
('R_A201_HD', N'A201', 70, 'HQHD'),
('R_B101_HD', N'B101', 45, 'HQHD'),
('R_B201_HD', N'B201', 80, 'HQHD'),
('R_C301_HD', N'C301', 40, 'HQHD'),

('R_A101_HL', N'A101', 60, 'HQHL'),
('R_A102_HL', N'A102', 50, 'HQHL'),
('R_A201_HL', N'A201', 70, 'HQHL'),
('R_B101_HL', N'B101', 45, 'HQHL'),
('R_B201_HL', N'B201', 80, 'HQHL'),
('R_C301_HL', N'C301', 40, 'HQHL'),

('R_A101_HCM', N'A101', 60, 'HQHCM'),
('R_A102_HCM', N'A102', 50, 'HQHCM'),
('R_A201_HCM', N'A201', 70, 'HQHCM'),
('R_B101_HCM', N'B101', 45, 'HQHCM'),
('R_B201_HCM', N'B201', 80, 'HQHCM'),
('R_C301_HCM', N'C301', 40, 'HQHCM');
GO

/* =========================================================
   12. CLASS
   ID lớp dạng: L01_INT1306, L02_INT1306...
========================================================= */

INSERT INTO [class]
(
    ID_class,
    ID_subject,
    ID_teacher,
    ID_term,
    group_number,
    min_students,
    max_students,
    number_of_registration,
    class_status
)
VALUES
('L01_INT1306', 'INT1306', 'GV001', 'HK251', 1, 10, 60, 0, 'OPEN'),
('L02_INT1306', 'INT1306', 'GV013', 'HK251', 2, 10, 60, 0, 'OPEN'),
('L03_INT1306', 'INT1306', 'GV025', 'HK251', 3, 10, 60, 0, 'OPEN'),

('L01_INT1313', 'INT1313', 'GV002', 'HK251', 1, 10, 50, 0, 'OPEN'),
('L02_INT1313', 'INT1313', 'GV014', 'HK251', 2, 10, 50, 0, 'OPEN'),
('L03_INT1313', 'INT1313', 'GV026', 'HK251', 3, 10, 50, 0, 'OPEN'),

('L01_INT1358', 'INT1358', 'GV003', 'HK251', 1, 10, 45, 0, 'OPEN'),
('L02_INT1358', 'INT1358', 'GV015', 'HK251', 2, 10, 45, 0, 'OPEN'),
('L03_INT1358', 'INT1358', 'GV027', 'HK251', 3, 10, 45, 0, 'OPEN'),

('L01_INT1332', 'INT1332', 'GV001', 'HK252', 1, 10, 50, 0, 'OPEN'),
('L02_INT1332', 'INT1332', 'GV013', 'HK252', 2, 10, 50, 0, 'OPEN'),
('L03_INT1332', 'INT1332', 'GV025', 'HK252', 3, 10, 50, 0, 'OPEN'),

('L01_INT1316', 'INT1316', 'GV002', 'HK252', 1, 10, 50, 0, 'OPEN'),
('L02_INT1316', 'INT1316', 'GV014', 'HK252', 2, 10, 50, 0, 'OPEN'),
('L03_INT1316', 'INT1316', 'GV026', 'HK252', 3, 10, 50, 0, 'OPEN'),

('L01_SEC1301', 'SEC1301', 'GV004', 'HK251', 1, 10, 45, 0, 'OPEN'),
('L02_SEC1301', 'SEC1301', 'GV016', 'HK251', 2, 10, 45, 0, 'OPEN'),
('L03_SEC1301', 'SEC1301', 'GV028', 'HK251', 3, 10, 45, 0, 'OPEN'),

('L01_NET1301', 'NET1301', 'GV005', 'HK251', 1, 10, 45, 0, 'OPEN'),
('L02_NET1301', 'NET1301', 'GV017', 'HK251', 2, 10, 45, 0, 'OPEN'),
('L03_NET1301', 'NET1301', 'GV029', 'HK251', 3, 10, 45, 0, 'OPEN'),

('L01_SEC1401', 'SEC1401', 'GV006', 'HK252', 1, 10, 40, 0, 'OPEN'),
('L02_SEC1401', 'SEC1401', 'GV018', 'HK252', 2, 10, 40, 0, 'OPEN'),
('L03_SEC1401', 'SEC1401', 'GV030', 'HK252', 3, 10, 40, 0, 'OPEN'),

('L01_ELE1301', 'ELE1301', 'GV007', 'HK251', 1, 10, 45, 0, 'OPEN'),
('L02_ELE1301', 'ELE1301', 'GV019', 'HK251', 2, 10, 45, 0, 'OPEN'),
('L03_ELE1301', 'ELE1301', 'GV031', 'HK251', 3, 10, 45, 0, 'OPEN'),

('L01_ELE1401', 'ELE1401', 'GV008', 'HK252', 1, 10, 40, 0, 'OPEN'),
('L02_ELE1401', 'ELE1401', 'GV020', 'HK252', 2, 10, 40, 0, 'OPEN'),
('L03_ELE1401', 'ELE1401', 'GV032', 'HK252', 3, 10, 40, 0, 'OPEN'),

('L01_BUS1301', 'BUS1301', 'GV010', 'HK251', 1, 10, 60, 0, 'OPEN'),
('L02_BUS1301', 'BUS1301', 'GV022', 'HK251', 2, 10, 60, 0, 'OPEN'),
('L03_BUS1301', 'BUS1301', 'GV034', 'HK251', 3, 10, 60, 0, 'OPEN'),

('L01_BUS1401', 'BUS1401', 'GV011', 'HK252', 1, 10, 60, 0, 'OPEN'),
('L02_BUS1401', 'BUS1401', 'GV023', 'HK252', 2, 10, 60, 0, 'OPEN'),
('L03_BUS1401', 'BUS1401', 'GV035', 'HK252', 3, 10, 60, 0, 'OPEN');
GO

/* =========================================================
   13. SESSION
   Note ghi chi tiết
========================================================= */

INSERT INTO [session](ID_session, study_date, day_of_week, note, ID_class, ID_room, ID_timeslot)
VALUES
('SESS_001', '2026-02-16', 2, N'Lý thuyết: Tổng quan cơ sở dữ liệu và mô hình quan hệ', 'L01_INT1306', 'R_A101_HD', 'TS01'),
('SESS_002', '2026-02-16', 2, N'Lý thuyết: Câu lệnh SELECT và truy vấn dữ liệu cơ bản', 'L02_INT1306', 'R_A101_HL', 'TS01'),
('SESS_003', '2026-02-16', 2, N'Thực hành: Tạo bảng, khóa chính, khóa ngoại trong SQL Server', 'L03_INT1306', 'R_A101_HCM', 'TS01'),

('SESS_004', '2026-02-17', 3, N'Lý thuyết: Tổng quan cơ sở dữ liệu phân tán', 'L01_INT1313', 'R_A102_HD', 'TS02'),
('SESS_005', '2026-02-17', 3, N'Thực hành: Phân mảnh ngang và truy vấn dữ liệu phân tán', 'L02_INT1313', 'R_A102_HL', 'TS02'),
('SESS_006', '2026-02-17', 3, N'Thực hành: Mô phỏng đăng ký đồng thời bằng transaction', 'L03_INT1313', 'R_A102_HCM', 'TS02'),

('SESS_007', '2026-02-18', 4, N'Lý thuyết: HTML, CSS và cấu trúc ứng dụng Web', 'L01_INT1358', 'R_A201_HD', 'TS03'),
('SESS_008', '2026-02-18', 4, N'Thực hành: Xây dựng giao diện đăng ký học phần', 'L02_INT1358', 'R_A201_HL', 'TS03'),
('SESS_009', '2026-02-18', 4, N'Thực hành: Kết nối Web với SQL Server', 'L03_INT1358', 'R_A201_HCM', 'TS03'),

('SESS_010', '2026-02-19', 5, N'Lý thuyết: Lớp, đối tượng và tính đóng gói', 'L01_INT1332', 'R_B101_HD', 'TS04'),
('SESS_011', '2026-02-19', 5, N'Thực hành: Xây dựng lớp và phương thức trong OOP', 'L02_INT1332', 'R_B101_HL', 'TS04'),
('SESS_012', '2026-02-19', 5, N'Thực hành: Kế thừa và đa hình trong lập trình hướng đối tượng', 'L03_INT1332', 'R_B101_HCM', 'TS04'),

('SESS_013', '2026-02-20', 6, N'Lý thuyết: Cú pháp Java và lập trình hướng đối tượng', 'L01_INT1316', 'R_B201_HD', 'TS01'),
('SESS_014', '2026-02-20', 6, N'Thực hành: Xây dựng chương trình quản lý sinh viên bằng Java', 'L02_INT1316', 'R_B201_HL', 'TS01'),
('SESS_015', '2026-02-20', 6, N'Thực hành: Kết nối Java với SQL Server bằng JDBC', 'L03_INT1316', 'R_B201_HCM', 'TS01'),

('SESS_016', '2026-02-23', 2, N'Lý thuyết: Tổng quan an toàn thông tin và nguy cơ tấn công', 'L01_SEC1301', 'R_C301_HD', 'TS02'),
('SESS_017', '2026-02-23', 2, N'Thực hành: Phân tích rủi ro và chính sách bảo mật', 'L02_SEC1301', 'R_C301_HL', 'TS02'),
('SESS_018', '2026-02-23', 2, N'Thực hành: Kiểm tra lỗ hổng cơ bản trong hệ thống', 'L03_SEC1301', 'R_C301_HCM', 'TS02'),

('SESS_019', '2026-02-24', 3, N'Lý thuyết: Mô hình OSI, TCP/IP và địa chỉ IP', 'L01_NET1301', 'R_A101_HD', 'TS03'),
('SESS_020', '2026-02-24', 3, N'Thực hành: Cấu hình mạng LAN và kiểm tra kết nối', 'L02_NET1301', 'R_A101_HL', 'TS03'),
('SESS_021', '2026-02-24', 3, N'Thực hành: Cấu hình kết nối SQL Server qua mạng', 'L03_NET1301', 'R_A101_HCM', 'TS03'),

('SESS_022', '2026-02-25', 4, N'Lý thuyết: Hệ mật mã khóa đối xứng và bất đối xứng', 'L01_SEC1401', 'R_A102_HD', 'TS04'),
('SESS_023', '2026-02-25', 4, N'Thực hành: Mã hóa dữ liệu và kiểm tra chữ ký số', 'L02_SEC1401', 'R_A102_HL', 'TS04'),
('SESS_024', '2026-02-25', 4, N'Thực hành: Ứng dụng mật mã trong bảo vệ CSDL', 'L03_SEC1401', 'R_A102_HCM', 'TS04'),

('SESS_025', '2026-02-26', 5, N'Lý thuyết: Linh kiện điện tử và tín hiệu số', 'L01_ELE1301', 'R_A201_HD', 'TS01'),
('SESS_026', '2026-02-26', 5, N'Thực hành: Đo tín hiệu và mô phỏng mạch cơ bản', 'L02_ELE1301', 'R_A201_HL', 'TS01'),
('SESS_027', '2026-02-26', 5, N'Thực hành: Thiết kế mạch điện tử ứng dụng', 'L03_ELE1301', 'R_A201_HCM', 'TS01'),

('SESS_028', '2026-02-27', 6, N'Lý thuyết: Tổng quan IoT và kiến trúc hệ thống cảm biến', 'L01_ELE1401', 'R_B101_HD', 'TS02'),
('SESS_029', '2026-02-27', 6, N'Thực hành: Kết nối thiết bị IoT với máy chủ dữ liệu', 'L02_ELE1401', 'R_B101_HL', 'TS02'),
('SESS_030', '2026-02-27', 6, N'Thực hành: Thu thập dữ liệu IoT và lưu vào SQL Server', 'L03_ELE1401', 'R_B101_HCM', 'TS02'),

('SESS_031', '2026-03-02', 2, N'Lý thuyết: Khái niệm marketing và phân tích thị trường', 'L01_BUS1301', 'R_B201_HD', 'TS03'),
('SESS_032', '2026-03-02', 2, N'Thực hành: Xây dựng kế hoạch marketing sản phẩm số', 'L02_BUS1301', 'R_B201_HL', 'TS03'),
('SESS_033', '2026-03-02', 2, N'Thực hành: Phân tích hành vi khách hàng trực tuyến', 'L03_BUS1301', 'R_B201_HCM', 'TS03'),

('SESS_034', '2026-03-03', 3, N'Lý thuyết: Mô hình thương mại điện tử và thanh toán trực tuyến', 'L01_BUS1401', 'R_C301_HD', 'TS04'),
('SESS_035', '2026-03-03', 3, N'Thực hành: Thiết kế chức năng bán hàng trực tuyến', 'L02_BUS1401', 'R_C301_HL', 'TS04'),
('SESS_036', '2026-03-03', 3, N'Thực hành: Phân tích dữ liệu giao dịch thương mại điện tử', 'L03_BUS1401', 'R_C301_HCM', 'TS04');
GO

/* =========================================================
   14. REGISTRATION
   ID dạng REG001 -> REGxxx
========================================================= */

WITH reg_source AS
(
    SELECT ID_student, 'L01_INT1306' AS ID_class FROM student WHERE ID_department = 'D_HD_CNTT'
    UNION ALL SELECT ID_student, 'L01_INT1313' FROM student WHERE ID_department = 'D_HD_CNTT'
    UNION ALL SELECT ID_student, 'L01_SEC1301' FROM student WHERE ID_department = 'D_HD_ATTT'
    UNION ALL SELECT ID_student, 'L01_NET1301' FROM student WHERE ID_department = 'D_HD_ATTT'
    UNION ALL SELECT ID_student, 'L01_ELE1301' FROM student WHERE ID_department = 'D_HD_DTVT'
    UNION ALL SELECT ID_student, 'L01_ELE1401' FROM student WHERE ID_department = 'D_HD_DTVT'
    UNION ALL SELECT ID_student, 'L01_BUS1301' FROM student WHERE ID_department = 'D_HD_QTKD'
    UNION ALL SELECT ID_student, 'L01_BUS1401' FROM student WHERE ID_department = 'D_HD_QTKD'

    UNION ALL SELECT ID_student, 'L02_INT1306' FROM student WHERE ID_department = 'D_HL_CNTT'
    UNION ALL SELECT ID_student, 'L02_INT1313' FROM student WHERE ID_department = 'D_HL_CNTT'
    UNION ALL SELECT ID_student, 'L02_SEC1301' FROM student WHERE ID_department = 'D_HL_ATTT'
    UNION ALL SELECT ID_student, 'L02_NET1301' FROM student WHERE ID_department = 'D_HL_ATTT'
    UNION ALL SELECT ID_student, 'L02_ELE1301' FROM student WHERE ID_department = 'D_HL_DTVT'
    UNION ALL SELECT ID_student, 'L02_ELE1401' FROM student WHERE ID_department = 'D_HL_DTVT'
    UNION ALL SELECT ID_student, 'L02_BUS1301' FROM student WHERE ID_department = 'D_HL_QTKD'
    UNION ALL SELECT ID_student, 'L02_BUS1401' FROM student WHERE ID_department = 'D_HL_QTKD'

    UNION ALL SELECT ID_student, 'L03_INT1306' FROM student WHERE ID_department = 'D_HCM_CNTT'
    UNION ALL SELECT ID_student, 'L03_INT1313' FROM student WHERE ID_department = 'D_HCM_CNTT'
    UNION ALL SELECT ID_student, 'L03_SEC1301' FROM student WHERE ID_department = 'D_HCM_ATTT'
    UNION ALL SELECT ID_student, 'L03_NET1301' FROM student WHERE ID_department = 'D_HCM_ATTT'
    UNION ALL SELECT ID_student, 'L03_ELE1301' FROM student WHERE ID_department = 'D_HCM_DTVT'
    UNION ALL SELECT ID_student, 'L03_ELE1401' FROM student WHERE ID_department = 'D_HCM_DTVT'
    UNION ALL SELECT ID_student, 'L03_BUS1301' FROM student WHERE ID_department = 'D_HCM_QTKD'
    UNION ALL SELECT ID_student, 'L03_BUS1401' FROM student WHERE ID_department = 'D_HCM_QTKD'

    -- Đăng ký chéo cơ sở
    UNION ALL SELECT ID_student, 'L03_INT1358' FROM student WHERE ID_department = 'D_HD_CNTT'
    UNION ALL SELECT ID_student, 'L01_INT1358' FROM student WHERE ID_department = 'D_HCM_CNTT'
    UNION ALL SELECT ID_student, 'L02_SEC1401' FROM student WHERE ID_department = 'D_HD_ATTT'
    UNION ALL SELECT ID_student, 'L01_BUS1401' FROM student WHERE ID_department = 'D_HL_QTKD'
    UNION ALL SELECT ID_student, 'L02_BUS1401' FROM student WHERE ID_department = 'D_HCM_QTKD'
),
numbered AS
(
    SELECT
        ROW_NUMBER() OVER (ORDER BY ID_student, ID_class) AS rn,
        ID_student,
        ID_class
    FROM reg_source
)
INSERT INTO registration(ID_registration, ID_student, ID_class, registered_at, registration_status)
SELECT
    'REG' + RIGHT('000' + CAST(rn AS varchar(3)), 3),
    ID_student,
    ID_class,
    DATEADD(MINUTE, rn, GETDATE()),
    'REGISTERED'
FROM numbered;
GO

/* =========================================================
   15. CẬP NHẬT SĨ SỐ LỚP
========================================================= */

UPDATE c
SET number_of_registration = ISNULL(x.total_registered, 0)
    FROM [class] c
LEFT JOIN
(
    SELECT ID_class, COUNT(*) AS total_registered
    FROM registration
    WHERE registration_status = 'REGISTERED'
    GROUP BY ID_class
) x ON c.ID_class = x.ID_class;
GO

/* =========================================================
   16. KIỂM TRA NHANH
========================================================= */

SELECT 'headquarter' AS table_name, COUNT(*) AS total_rows FROM headquarter
UNION ALL SELECT 'department', COUNT(*) FROM department
UNION ALL SELECT 'subject', COUNT(*) FROM subject
UNION ALL SELECT 'curriculum', COUNT(*) FROM curriculum
UNION ALL SELECT 'curriculum_subject', COUNT(*) FROM curriculum_subject
UNION ALL SELECT 'prerequisite', COUNT(*) FROM prerequisite
UNION ALL SELECT 'term', COUNT(*) FROM term
UNION ALL SELECT 'timeslot', COUNT(*) FROM timeslot
UNION ALL SELECT 'teacher', COUNT(*) FROM teacher
UNION ALL SELECT 'student', COUNT(*) FROM student
UNION ALL SELECT 'room', COUNT(*) FROM room
UNION ALL SELECT 'class', COUNT(*) FROM [class]
UNION ALL SELECT 'session', COUNT(*) FROM [session]
          UNION ALL SELECT 'registration', COUNT(*) FROM registration;
GO

SELECT TOP 100
    ID_student,
    name_student,
       date_of_birth,
       year_of_admission,
       ID_department,
       ID_curriculum
FROM student
ORDER BY ID_student;
GO

SELECT TOP 100
    ID_registration,
    ID_student,
       ID_class,
       registered_at,
       registration_status
FROM registration
ORDER BY ID_registration;
GO

SELECT
    c.ID_class,
    c.ID_subject,
    c.max_students,
    c.number_of_registration,
    c.class_status
FROM [class] c
ORDER BY c.ID_class;
GO