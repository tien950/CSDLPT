-- Procedure kiểm tra điều kiện đăng ký học phần
-- Procedure này dùng để kiểm tra các điều kiện cơ bản trước khi sinh viên đăng ký lớp học phần, bao gồm: sinh viên tồn tại, lớp học phần tồn tại, lớp đang mở, còn thời gian đăng ký, không đăng ký trùng, không trùng lịch và lớp còn chỗ.
-- Tham số @ID_headquarter dùng để lọc theo cơ sở.

USE DkyTinChi;
GO

CREATE OR ALTER PROCEDURE usp_CheckRegisterCondition
    @ID_student varchar(20),
    @ID_class varchar(20),
    @ID_headquarter varchar(20) = NULL
    AS
BEGIN
    SET NOCOUNT ON;

    -- 1. Kiểm tra sinh viên có tồn tại và thuộc cơ sở được chọn hay không
    IF NOT EXISTS (
        SELECT 1
        FROM student st
        JOIN department d
            ON st.ID_department = d.ID_department COLLATE DATABASE_DEFAULT
        WHERE st.ID_student = @ID_student COLLATE DATABASE_DEFAULT
          AND (
                @ID_headquarter IS NULL
                OR d.ID_headquarter = @ID_headquarter COLLATE DATABASE_DEFAULT
              )
    )
BEGIN
SELECT 0 AS is_valid, N'Sinh viên không tồn tại hoặc không thuộc cơ sở được chọn.' AS message;
RETURN;
END;

    -- 2. Kiểm tra lớp học phần có mở, đúng hạn, và thuộc cơ sở hay không
    IF NOT EXISTS (
        SELECT 1
        FROM [class] c
        JOIN term t
            ON c.ID_term = t.ID_term COLLATE DATABASE_DEFAULT
        JOIN teacher te
            ON c.ID_teacher = te.ID_teacher COLLATE DATABASE_DEFAULT
        JOIN department d
            ON te.ID_department = d.ID_department COLLATE DATABASE_DEFAULT
        WHERE c.ID_class = @ID_class COLLATE DATABASE_DEFAULT
          AND c.class_status = 'OPEN' COLLATE DATABASE_DEFAULT
          AND GETDATE() BETWEEN t.reg_open AND t.reg_close
          AND (
                @ID_headquarter IS NULL
                OR d.ID_headquarter = @ID_headquarter COLLATE DATABASE_DEFAULT
              )
    )
BEGIN
SELECT 0 AS is_valid, N'Lớp không mở đăng ký, ngoài thời gian đăng ký hoặc không thuộc cơ sở được chọn.' AS message;
RETURN;
END;

    -- 3. Kiểm tra sinh viên đã đăng ký lớp này chưa
    IF EXISTS (
        SELECT 1
        FROM registration
        WHERE ID_student = @ID_student COLLATE DATABASE_DEFAULT
          AND ID_class = @ID_class COLLATE DATABASE_DEFAULT
          AND registration_status = 'REGISTERED' COLLATE DATABASE_DEFAULT
    )
BEGIN
SELECT 0 AS is_valid, N'Sinh viên đã đăng ký lớp học phần này.' AS message;
RETURN;
END;

    -- 4. Kiểm tra lịch học có bị trùng không
    IF EXISTS (
        SELECT 1
        FROM registration r
        JOIN [session] s_old
            ON r.ID_class = s_old.ID_class COLLATE DATABASE_DEFAULT
        JOIN [session] s_new
            ON s_old.study_date = s_new.study_date
           AND s_old.ID_timeslot = s_new.ID_timeslot COLLATE DATABASE_DEFAULT
        WHERE r.ID_student = @ID_student COLLATE DATABASE_DEFAULT
          AND r.registration_status = 'REGISTERED' COLLATE DATABASE_DEFAULT
          AND s_new.ID_class = @ID_class COLLATE DATABASE_DEFAULT
    )
BEGIN
SELECT 0 AS is_valid, N'Lịch học bị trùng với lớp học phần đã đăng ký.' AS message;
RETURN;
END;

    -- 5. Kiểm tra sĩ số lớp
    IF EXISTS (
        SELECT 1
        FROM [class]
        WHERE ID_class = @ID_class COLLATE DATABASE_DEFAULT
          AND number_of_registration >= max_students
    )
BEGIN
SELECT 0 AS is_valid, N'Lớp học phần đã đủ sĩ số.' AS message;
RETURN;
END;

    -- 6. Nếu vượt qua tất cả các kiểm tra
SELECT 1 AS is_valid, N'Đủ điều kiện đăng ký học phần.' AS message;
END;
GO


-- Procedure đăng ký học phần
-- Procedure này là nghiệp vụ quan trọng nhất của hệ thống. Procedure thực hiện kiểm tra sinh viên, lớp học phần, thời gian đăng ký, đăng ký trùng, trùng lịch và sĩ số lớp. Quá trình đăng ký được đặt trong Transaction. Khi cập nhật sĩ số lớp học phần, hệ thống sử dụng UPDLOCK và ROWLOCK để tránh nhiều sinh viên đăng ký đồng thời làm vượt quá sĩ số.

USE DkyTinChi;
GO

CREATE OR ALTER PROCEDURE usp_RegisterClass
    @ID_registration varchar(20),
    @ID_student varchar(20),
    @ID_class varchar(20),
    @ID_headquarter varchar(20) = NULL
    AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

BEGIN TRY
BEGIN TRAN;

        -- 1. Kiểm tra sinh viên
        IF NOT EXISTS (
            SELECT 1
            FROM student st
            JOIN department d
                ON st.ID_department = d.ID_department COLLATE DATABASE_DEFAULT
            WHERE st.ID_student = @ID_student COLLATE DATABASE_DEFAULT
              AND (
                    @ID_headquarter IS NULL
                    OR d.ID_headquarter = @ID_headquarter COLLATE DATABASE_DEFAULT
                  )
        )
BEGIN
            THROW 50001, N'Sinh viên không tồn tại hoặc không thuộc cơ sở được chọn.', 1;
END;

        -- 2. Kiểm tra lớp học phần
        IF NOT EXISTS (
            SELECT 1
            FROM [class] c
            JOIN term t
                ON c.ID_term = t.ID_term COLLATE DATABASE_DEFAULT
            JOIN teacher te
                ON c.ID_teacher = te.ID_teacher COLLATE DATABASE_DEFAULT
            JOIN department d
                ON te.ID_department = d.ID_department COLLATE DATABASE_DEFAULT
            WHERE c.ID_class = @ID_class COLLATE DATABASE_DEFAULT
              AND c.class_status = 'OPEN' COLLATE DATABASE_DEFAULT
              AND GETDATE() BETWEEN t.reg_open AND t.reg_close
              AND (
                    @ID_headquarter IS NULL
                    OR d.ID_headquarter = @ID_headquarter COLLATE DATABASE_DEFAULT
                  )
        )
BEGIN
            THROW 50002, N'Lớp không mở đăng ký, ngoài thời gian đăng ký hoặc không thuộc cơ sở được chọn.', 1;
END;

        -- 3. Kiểm tra trùng lặp đăng ký
        IF EXISTS (
            SELECT 1
            FROM registration
            WHERE ID_student = @ID_student COLLATE DATABASE_DEFAULT
              AND ID_class = @ID_class COLLATE DATABASE_DEFAULT
              AND registration_status = 'REGISTERED' COLLATE DATABASE_DEFAULT
        )
BEGIN
            THROW 50003, N'Sinh viên đã đăng ký lớp học phần này.', 1;
END;

        -- 4. Kiểm tra trùng lịch học
        IF EXISTS (
            SELECT 1
            FROM registration r
            JOIN [session] s_old
                ON r.ID_class = s_old.ID_class COLLATE DATABASE_DEFAULT
            JOIN [session] s_new
                ON s_old.study_date = s_new.study_date
               AND s_old.ID_timeslot = s_new.ID_timeslot COLLATE DATABASE_DEFAULT
            WHERE r.ID_student = @ID_student COLLATE DATABASE_DEFAULT
              AND r.registration_status = 'REGISTERED' COLLATE DATABASE_DEFAULT
              AND s_new.ID_class = @ID_class COLLATE DATABASE_DEFAULT
        )
BEGIN
            THROW 50004, N'Lịch học bị trùng với lớp học phần đã đăng ký.', 1;
END;

        -- 5. Cập nhật sĩ số với khóa ROWLOCK, UPDLOCK (Xử lý đồng thời)
UPDATE c
SET number_of_registration = number_of_registration + 1
    FROM [class] c WITH (UPDLOCK, ROWLOCK)
    JOIN teacher te
ON c.ID_teacher = te.ID_teacher COLLATE DATABASE_DEFAULT
    JOIN department d
    ON te.ID_department = d.ID_department COLLATE DATABASE_DEFAULT
WHERE c.ID_class = @ID_class COLLATE DATABASE_DEFAULT
  AND c.class_status = 'OPEN' COLLATE DATABASE_DEFAULT
  AND c.number_of_registration < c.max_students
  AND (
    @ID_headquarter IS NULL
   OR d.ID_headquarter = @ID_headquarter COLLATE DATABASE_DEFAULT
    );

IF @@ROWCOUNT = 0
BEGIN
            THROW 50005, N'Lớp học phần đã đủ sĩ số.', 1;
END;

        -- 6. Lưu thông tin đăng ký
INSERT INTO registration (
    ID_registration,
    ID_student,
    ID_class,
    registered_at,
    registration_status
)
VALUES (
           @ID_registration,
           @ID_student,
           @ID_class,
           GETDATE(),
           'REGISTERED'
       );

COMMIT;
END TRY
BEGIN CATCH
IF @@TRANCOUNT > 0
            ROLLBACK; -- Rollback khi giao dịch thất bại

        THROW;
END CATCH
END;
GO

-- Kiểm thử Procedure
--
-- Chạy
EXEC usp_RegisterClass
    @ID_registration = 'REG_TEST_HD_001',
    @ID_student = 'B22ATTT003',
    @ID_class = 'L01_BUS1301',
    @ID_headquarter = 'HQHD';
=> Đăng ký học phần thành công
Sau đó kiểm tra

=> Kiểm thử đăng ký thành công -> sĩ số đã đầy, sẽ không đăng ký được nữa

Procedure hủy đăng ký học phần
Procedure này xử lý nghiệp vụ hủy đăng ký học phần. Khi hủy đăng ký, hệ thống cập nhật trạng thái đăng ký từ REGISTERED sang CANCELLED, ghi thời gian hủy và giảm sĩ số lớp học phần. Toàn bộ quá trình được thực hiện trong Transaction để đảm bảo dữ liệu nhất quán.
USE DkyTinChi;
GO

CREATE OR ALTER PROCEDURE usp_CancelRegistration
    @ID_registration varchar(20),
    @ID_headquarter varchar(20) = NULL
    AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

BEGIN TRY
BEGIN TRAN;

        DECLARE @ID_class varchar(20);

SELECT @ID_class = reg.ID_class
FROM registration reg WITH (UPDLOCK, ROWLOCK)
        JOIN [class] c
ON reg.ID_class = c.ID_class
    JOIN teacher te
    ON c.ID_teacher = te.ID_teacher
    JOIN department d
    ON te.ID_department = d.ID_department
WHERE reg.ID_registration = @ID_registration
  AND reg.registration_status = 'REGISTERED'
  AND (
    @ID_headquarter IS NULL
   OR d.ID_headquarter = @ID_headquarter
    );

IF @ID_class IS NULL
BEGIN
            THROW 50101, N'Không tìm thấy đăng ký hợp lệ để hủy.', 1;
END;

UPDATE registration
SET registration_status = 'CANCELLED',
    cancelled_at = GETDATE()
WHERE ID_registration = @ID_registration
  AND registration_status = 'REGISTERED';

UPDATE c
SET number_of_registration = number_of_registration - 1
    FROM [class] c WITH (UPDLOCK, ROWLOCK)
WHERE c.ID_class = @ID_class
  AND c.number_of_registration > 0;

COMMIT;
END TRY
BEGIN CATCH
IF @@TRANCOUNT > 0
            ROLLBACK;

        THROW;
END CATCH
END;
GO


--
-- Kiểm thử Procedure
--
-- Chạy trước lệnh
EXEC usp_CancelRegistration
    @ID_registration = 'REG_TEST_HD_001',
    @ID_headquarter = 'HQHD';
-- để hủy đăng ký của bản ghi vừa thành công vừa trên luôn
-- Kiểm tra lại
--
--
-- Nhận xét :
-- Procedure đã hủy đăng ký và giảm sĩ số lớp xuống 1 đơn vị
--
-- Procedure tra cứu kết quả đăng ký học phần
-- Procedure này dùng để tra cứu danh sách học phần mà một sinh viên đã đăng ký, bao gồm mã lớp, tên học phần, số tín chỉ, học kỳ, giảng viên phụ trách và trạng thái đăng ký.Nếu truyền @ID_student, xem một sinh viên. Nếu không truyền @ID_student, xem toàn bộ dữ liệu hiện có. Nếu truyền @ID_headquarter, lọc theo cơ sở.

USE DkyTinChi;
GO

CREATE OR ALTER PROCEDURE usp_GetRegistrationResult
    @ID_student varchar(20) = NULL,
    @ID_headquarter varchar(20) = NULL
    AS
BEGIN
    SET NOCOUNT ON;

SELECT
    hq.ID_headquarter AS N'Mã cơ sở',
    hq.name_headquarter AS N'Cơ sở',
    r.ID_registration AS N'Mã đăng ký',
    st.ID_student AS N'Mã sinh viên',
    st.name_student AS N'Tên sinh viên',
    c.ID_class AS N'Mã lớp học phần',
    sub.ID_subject AS N'Mã học phần',
    sub.name_subject AS N'Tên học phần',
    sub.number_of_credit AS N'Số tín chỉ',
    t.name_term AS N'Học kỳ',
    te.name_teacher AS N'Giảng viên',
    r.registered_at AS N'Thời gian đăng ký',
    r.cancelled_at AS N'Thời gian hủy',
    r.registration_status AS N'Trạng thái'
FROM registration r
         JOIN student st
              ON r.ID_student = st.ID_student COLLATE DATABASE_DEFAULT
         JOIN department d
              ON st.ID_department = d.ID_department COLLATE DATABASE_DEFAULT
         JOIN headquarter hq
              ON d.ID_headquarter = hq.ID_headquarter COLLATE DATABASE_DEFAULT
         JOIN [class] c
ON r.ID_class = c.ID_class COLLATE DATABASE_DEFAULT
    JOIN subject sub
    ON c.ID_subject = sub.ID_subject COLLATE DATABASE_DEFAULT
    JOIN term t
    ON c.ID_term = t.ID_term COLLATE DATABASE_DEFAULT
    JOIN teacher te
    ON c.ID_teacher = te.ID_teacher COLLATE DATABASE_DEFAULT
WHERE (
    @ID_student IS NULL
   OR st.ID_student = @ID_student COLLATE DATABASE_DEFAULT
    )
  AND (
    @ID_headquarter IS NULL
   OR hq.ID_headquarter = @ID_headquarter COLLATE DATABASE_DEFAULT
    )
ORDER BY hq.ID_headquarter, st.ID_student, r.registered_at DESC;
END;
GO

--
-- Procedure xem thời khóa biểu sinh viên
-- Procedure này dùng để tra cứu thời khóa biểu của một sinh viên dựa trên các lớp học phần mà sinh viên đã đăng ký thành công.Nếu chạy ở máy chủ Hà Đông không truyền @ID_headquarter, có thể xem toàn bộ dữ liệu hiện có.

USE DkyTinChi;
GO

CREATE OR ALTER PROCEDURE usp_GetStudentTimetable
    @ID_student varchar(20) = NULL,
    @ID_headquarter varchar(20) = NULL
    AS
BEGIN
    SET NOCOUNT ON;

SELECT
    hq_st.ID_headquarter AS N'Mã cơ sở sinh viên',
    hq_st.name_headquarter AS N'Cơ sở sinh viên',
    st.ID_student AS N'Mã sinh viên',
    st.name_student AS N'Tên sinh viên',
    c.ID_class AS N'Mã lớp học phần',
    sub.name_subject AS N'Tên học phần',
    ss.study_date AS N'Ngày học',
    ss.day_of_week AS N'Thứ',
    ts.shift_no AS N'Ca học',
    ts.start_time AS N'Giờ bắt đầu',
    ts.end_time AS N'Giờ kết thúc',
    r.name_room AS N'Phòng học',
    hq_room.name_headquarter AS N'Cơ sở học',
    te.name_teacher AS N'Giảng viên'
FROM registration reg
         JOIN student st
              ON reg.ID_student = st.ID_student COLLATE DATABASE_DEFAULT
         JOIN department d_st
              ON st.ID_department = d_st.ID_department COLLATE DATABASE_DEFAULT
         JOIN headquarter hq_st
              ON d_st.ID_headquarter = hq_st.ID_headquarter COLLATE DATABASE_DEFAULT
         JOIN [class] c
ON reg.ID_class = c.ID_class COLLATE DATABASE_DEFAULT
    JOIN subject sub
    ON c.ID_subject = sub.ID_subject COLLATE DATABASE_DEFAULT
    JOIN [session] ss
    ON c.ID_class = ss.ID_class COLLATE DATABASE_DEFAULT
    JOIN timeslot ts
    ON ss.ID_timeslot = ts.ID_timeslot COLLATE DATABASE_DEFAULT
    JOIN room r
    ON ss.ID_room = r.ID_room COLLATE DATABASE_DEFAULT
    JOIN headquarter hq_room
    ON r.ID_headquarter = hq_room.ID_headquarter COLLATE DATABASE_DEFAULT
    JOIN teacher te
    ON c.ID_teacher = te.ID_teacher COLLATE DATABASE_DEFAULT
WHERE reg.registration_status = 'REGISTERED' COLLATE DATABASE_DEFAULT
  AND (
    @ID_student IS NULL
   OR st.ID_student = @ID_student COLLATE DATABASE_DEFAULT
    )
  AND (
    @ID_headquarter IS NULL
   OR hq_st.ID_headquarter = @ID_headquarter COLLATE DATABASE_DEFAULT
    )
ORDER BY hq_st.ID_headquarter, st.ID_student, ss.study_date, ts.start_time;
END;
GO


-- Procedure thống kê tình trạng đăng ký lớp học phần theo học kỳ
-- Procedure này thống kê tình trạng đăng ký của các lớp học phần trong một học kỳ, bao gồm số lượng đã đăng ký, sĩ số tối đa và tỷ lệ lấp đầy.

USE DkyTinChi;
GO

CREATE OR ALTER PROCEDURE usp_StatsClassRegistrationByTerm
    @ID_term varchar(20),
    @ID_headquarter varchar(20) = NULL
    AS
BEGIN
    SET NOCOUNT ON;

SELECT
    hq.ID_headquarter AS N'Mã cơ sở',
    hq.name_headquarter AS N'Cơ sở',
    c.ID_class AS N'Mã lớp học phần',
    sub.ID_subject AS N'Mã học phần',
    sub.name_subject AS N'Tên học phần',
    te.name_teacher AS N'Giảng viên phụ trách',
    c.max_students AS N'Sĩ số tối đa',
    c.number_of_registration AS N'Số lượng đã đăng ký',
    CAST(
            c.number_of_registration * 100.0 / NULLIF(c.max_students, 0)
        AS decimal(5,2)
    ) AS N'Tỷ lệ lấp đầy (%)',
    c.class_status AS N'Trạng thái lớp'
FROM [class] c
    JOIN subject sub
ON c.ID_subject = sub.ID_subject COLLATE DATABASE_DEFAULT
    JOIN teacher te
    ON c.ID_teacher = te.ID_teacher COLLATE DATABASE_DEFAULT
    JOIN department d
    ON te.ID_department = d.ID_department COLLATE DATABASE_DEFAULT
    JOIN headquarter hq
    ON d.ID_headquarter = hq.ID_headquarter COLLATE DATABASE_DEFAULT
WHERE c.ID_term = @ID_term COLLATE DATABASE_DEFAULT
  AND (
    @ID_headquarter IS NULL
   OR hq.ID_headquarter = @ID_headquarter COLLATE DATABASE_DEFAULT
    )
ORDER BY hq.ID_headquarter, c.number_of_registration DESC, c.ID_class;
END;
GO


-- Procedure kiểm tra đăng ký chéo cơ sở
-- Procedure này dùng để xác định các trường hợp sinh viên đăng ký lớp học phần thuộc cơ sở khác với cơ sở quản lý sinh viên. Cơ sở của sinh viên được xác định thông qua khoa của sinh viên. Cơ sở của lớp học phần được xác định thông qua khoa của giảng viên phụ trách lớp.

USE DkyTinChi;
GO

CREATE OR ALTER PROCEDURE usp_CheckCrossCampusRegistration
    AS
BEGIN
    SET NOCOUNT ON;

SELECT
    r.ID_registration AS N'Mã đăng ký',
    st.ID_student AS N'Mã sinh viên',
    st.name_student AS N'Tên sinh viên',
    hq_st.name_headquarter AS N'Cơ sở sinh viên',
    c.ID_class AS N'Mã lớp học phần',
    sub.name_subject AS N'Tên học phần',
    hq_cl.name_headquarter AS N'Cơ sở mở lớp',
    r.registered_at AS N'Thời gian đăng ký'
FROM registration r
         JOIN student st
              ON r.ID_student = st.ID_student COLLATE DATABASE_DEFAULT
         JOIN department d_st
              ON st.ID_department = d_st.ID_department COLLATE DATABASE_DEFAULT
         JOIN headquarter hq_st
              ON d_st.ID_headquarter = hq_st.ID_headquarter COLLATE DATABASE_DEFAULT
         JOIN [class] c
ON r.ID_class = c.ID_class COLLATE DATABASE_DEFAULT
    JOIN subject sub
    ON c.ID_subject = sub.ID_subject COLLATE DATABASE_DEFAULT
    JOIN teacher te
    ON c.ID_teacher = te.ID_teacher COLLATE DATABASE_DEFAULT
    JOIN department d_te
    ON te.ID_department = d_te.ID_department COLLATE DATABASE_DEFAULT
    JOIN headquarter hq_cl
    ON d_te.ID_headquarter = hq_cl.ID_headquarter COLLATE DATABASE_DEFAULT
WHERE r.registration_status = 'REGISTERED' COLLATE DATABASE_DEFAULT
  AND hq_st.ID_headquarter <> hq_cl.ID_headquarter COLLATE DATABASE_DEFAULT
ORDER BY hq_st.name_headquarter, hq_cl.name_headquarter, st.ID_student;
END;
GO


-- 	Nhận xét:
-- Procedure hỗ trợ phát hiện và thống kê các trường hợp đăng ký chéo cơ sở.
--
-- Procedure thống kê sinh viên đăng ký theo cơ sở
-- Procedure này thống kê số lượng sinh viên đã đăng ký học phần theo từng cơ sở đào tạo. Procedure sử dụng tham số @ID_headquarter để lọc theo cơ sở cụ thể hoặc không sử dụng để thống kê tất cả cơ sở

USE DkyTinChi;
GO

CREATE OR ALTER PROCEDURE usp_StatsRegisteredStudentsByCampus
    @ID_headquarter varchar(20) = NULL
    AS
BEGIN
    SET NOCOUNT ON;

SELECT
    hq.ID_headquarter AS N'Mã cơ sở',
    hq.name_headquarter AS N'Cơ sở',
    COUNT(DISTINCT r.ID_student) AS N'Số sinh viên đã đăng ký'
FROM headquarter hq
         JOIN department d
              ON hq.ID_headquarter = d.ID_headquarter COLLATE DATABASE_DEFAULT
         JOIN student st
              ON d.ID_department = st.ID_department COLLATE DATABASE_DEFAULT
         LEFT JOIN registration r
                   ON st.ID_student = r.ID_student COLLATE DATABASE_DEFAULT
                       AND r.registration_status = 'REGISTERED' COLLATE DATABASE_DEFAULT
WHERE @ID_headquarter IS NULL
   OR hq.ID_headquarter = @ID_headquarter COLLATE DATABASE_DEFAULT
GROUP BY hq.ID_headquarter, hq.name_headquarter
ORDER BY hq.ID_headquarter;
END;
GO



-- Procedure lấy danh sách lớp học phần theo cơ sở
-- Procedure này dùng để lấy danh sách các lớp học phần đang mở tại một cơ sở đào tạo cụ thể. Kết quả bao gồm thông tin lớp học phần, học phần, giảng viên, phòng học, ca học, ngày học và sĩ số hiện tại. Procedure này phục vụ bước hiển thị danh sách lớp học phần khi sinh viên muốn đăng ký lớp ở cơ sở khác.

USE DkyTinChi;
GO

CREATE OR ALTER PROCEDURE usp_GetClassesByCampus
    @ID_headquarter varchar(20),
    @ID_term varchar(20) = NULL,
    @ID_subject varchar(20) = NULL
    AS
BEGIN
    SET NOCOUNT ON;

SELECT
    h.ID_headquarter AS N'Mã cơ sở',
    h.name_headquarter AS N'Cơ sở mở lớp',
    c.ID_class AS N'Mã lớp học phần',
    sub.ID_subject AS N'Mã học phần',
    sub.name_subject AS N'Tên học phần',
    sub.number_of_credit AS N'Số tín chỉ',
    te.ID_teacher AS N'Mã giảng viên',
    te.name_teacher AS N'Giảng viên',
    c.group_number AS N'Nhóm lớp',
    c.number_of_registration AS N'Số lượng đã đăng ký',
    c.max_students AS N'Sĩ số tối đa',
    c.max_students - c.number_of_registration AS N'Số chỗ còn lại',
    c.class_status AS N'Trạng thái lớp',
    ss.study_date AS N'Ngày học',
    ss.day_of_week AS N'Thứ',
    ts.shift_no AS N'Ca học',
    ts.start_time AS N'Giờ bắt đầu',
    ts.end_time AS N'Giờ kết thúc',
    r.ID_room AS N'Mã phòng',
    r.name_room AS N'Phòng học'
FROM [class] c
    JOIN subject sub
ON c.ID_subject = sub.ID_subject COLLATE DATABASE_DEFAULT
    JOIN teacher te
    ON c.ID_teacher = te.ID_teacher COLLATE DATABASE_DEFAULT
    JOIN department d
    ON te.ID_department = d.ID_department COLLATE DATABASE_DEFAULT
    JOIN headquarter h
    ON d.ID_headquarter = h.ID_headquarter COLLATE DATABASE_DEFAULT
    JOIN [session] ss
    ON c.ID_class = ss.ID_class COLLATE DATABASE_DEFAULT
    JOIN room r
    ON ss.ID_room = r.ID_room COLLATE DATABASE_DEFAULT
    JOIN timeslot ts
    ON ss.ID_timeslot = ts.ID_timeslot COLLATE DATABASE_DEFAULT
WHERE h.ID_headquarter = @ID_headquarter COLLATE DATABASE_DEFAULT
  AND c.class_status = 'OPEN' COLLATE DATABASE_DEFAULT
  AND c.number_of_registration < c.max_students
  AND (
    @ID_term IS NULL
   OR c.ID_term = @ID_term COLLATE DATABASE_DEFAULT
    )
  AND (
    @ID_subject IS NULL
   OR c.ID_subject = @ID_subject COLLATE DATABASE_DEFAULT
    )
ORDER BY sub.ID_subject, c.ID_class, ss.study_date, ts.start_time;
END;
GO


-- Procedure đăng ký chéo cơ sở
-- Procedure này xử lý nghiệp vụ sinh viên đăng ký lớp học phần thuộc cơ sở khác với cơ sở quản lý sinh viên. Cơ sở của sinh viên được xác định thông qua khoa của sinh viên. Cơ sở mở lớp được xác định thông qua khoa của giảng viên phụ trách lớp.
-- Procedure thực hiện kiểm tra sinh viên, lớp học phần, đăng ký trùng, trùng học phần trong cùng học kỳ, trùng lịch học, sĩ số lớp và xác định đây có phải đăng ký chéo cơ sở hay không. Toàn bộ thao tác được đặt trong Transaction. Khi cập nhật sĩ số lớp học phần, hệ thống sử dụng UPDLOCK, HOLDLOCK và ROWLOCK để tránh tình trạng nhiều sinh viên đăng ký đồng thời làm vượt quá sĩ số.
USE DkyTinChi;
GO

CREATE OR ALTER PROCEDURE usp_RegisterCrossCampusClass
    @ID_registration varchar(20),
    @ID_student varchar(20),
    @ID_class varchar(20)
    AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

BEGIN TRY
BEGIN TRAN;

        DECLARE
@student_site varchar(20),
            @class_site varchar(20);

SELECT @student_site = d.ID_headquarter
FROM student st
         JOIN department d
              ON st.ID_department = d.ID_department COLLATE DATABASE_DEFAULT
WHERE st.ID_student = @ID_student COLLATE DATABASE_DEFAULT;

IF @student_site IS NULL
BEGIN
            THROW 51001, N'Sinh viên không tồn tại.', 1;
END;

SELECT @class_site = d.ID_headquarter
FROM [class] c
    JOIN teacher te
ON c.ID_teacher = te.ID_teacher COLLATE DATABASE_DEFAULT
    JOIN department d
    ON te.ID_department = d.ID_department COLLATE DATABASE_DEFAULT
WHERE c.ID_class = @ID_class COLLATE DATABASE_DEFAULT;

IF @class_site IS NULL
BEGIN
            THROW 51002, N'Lớp học phần không tồn tại.', 1;
END;

        IF @student_site = @class_site
BEGIN
            THROW 51003, N'Đây không phải đăng ký chéo cơ sở.', 1;
END;

        IF EXISTS (
            SELECT 1
            FROM registration
            WHERE ID_registration = @ID_registration COLLATE DATABASE_DEFAULT
        )
BEGIN
            THROW 51004, N'Mã đăng ký đã tồn tại.', 1;
END;

        IF NOT EXISTS (
            SELECT 1
            FROM [class] c
            JOIN term t
                ON c.ID_term = t.ID_term COLLATE DATABASE_DEFAULT
            WHERE c.ID_class = @ID_class COLLATE DATABASE_DEFAULT
              AND c.class_status = 'OPEN' COLLATE DATABASE_DEFAULT
              AND GETDATE() BETWEEN t.reg_open AND t.reg_close
        )
BEGIN
            THROW 51005, N'Lớp không mở đăng ký hoặc ngoài thời gian đăng ký.', 1;
END;

        IF EXISTS (
            SELECT 1
            FROM registration
            WHERE ID_student = @ID_student COLLATE DATABASE_DEFAULT
              AND ID_class = @ID_class COLLATE DATABASE_DEFAULT
              AND registration_status = 'REGISTERED' COLLATE DATABASE_DEFAULT
        )
BEGIN
            THROW 51006, N'Sinh viên đã đăng ký lớp học phần này.', 1;
END;

        IF EXISTS (
            SELECT 1
            FROM registration r
            JOIN [class] c_old
                ON r.ID_class = c_old.ID_class COLLATE DATABASE_DEFAULT
            JOIN [class] c_new
                ON c_new.ID_class = @ID_class COLLATE DATABASE_DEFAULT
            WHERE r.ID_student = @ID_student COLLATE DATABASE_DEFAULT
              AND r.registration_status = 'REGISTERED' COLLATE DATABASE_DEFAULT
              AND c_old.ID_subject = c_new.ID_subject COLLATE DATABASE_DEFAULT
              AND c_old.ID_term = c_new.ID_term COLLATE DATABASE_DEFAULT
        )
BEGIN
            THROW 51007, N'Sinh viên đã đăng ký học phần này trong cùng học kỳ.', 1;
END;

        IF EXISTS (
            SELECT 1
            FROM registration r
            JOIN [session] s_old
                ON r.ID_class = s_old.ID_class COLLATE DATABASE_DEFAULT
            JOIN [session] s_new
                ON s_old.study_date = s_new.study_date
               AND s_old.ID_timeslot = s_new.ID_timeslot COLLATE DATABASE_DEFAULT
            WHERE r.ID_student = @ID_student COLLATE DATABASE_DEFAULT
              AND r.registration_status = 'REGISTERED' COLLATE DATABASE_DEFAULT
              AND s_new.ID_class = @ID_class COLLATE DATABASE_DEFAULT
        )
BEGIN
            THROW 51008, N'Lịch học bị trùng với lớp học phần đã đăng ký.', 1;
END;

UPDATE c
SET number_of_registration = number_of_registration + 1
    FROM [class] c WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
WHERE c.ID_class = @ID_class COLLATE DATABASE_DEFAULT
  AND c.class_status = 'OPEN' COLLATE DATABASE_DEFAULT
  AND c.number_of_registration < c.max_students;

IF @@ROWCOUNT = 0
BEGIN
            THROW 51009, N'Lớp học phần đã đủ sĩ số.', 1;
END;

INSERT INTO registration
(
    ID_registration,
    ID_student,
    ID_class,
    registered_at,
    registration_status
)
VALUES
    (
        @ID_registration,
        @ID_student,
        @ID_class,
        GETDATE(),
        'REGISTERED'
    );

COMMIT;
END TRY
BEGIN CATCH
IF @@TRANCOUNT > 0
            ROLLBACK;

        THROW;
END CATCH
END;
GO
