/* =========================================================
   TẠO LẠI CSDL DKYTINCHI
========================================================= */

USE master;
GO

IF DB_ID(N'DkyTinChi') IS NOT NULL
BEGIN
    ALTER DATABASE DkyTinChi SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE DkyTinChi;
END
GO

CREATE DATABASE DkyTinChi;
GO

USE DkyTinChi;
GO

/* =========================================================
   1. HEADQUARTER
   Lưu thông tin trụ sở/cơ sở đào tạo
========================================================= */

CREATE TABLE headquarter
(
    ID_headquarter varchar(20) NOT NULL,
    name_headquarter nvarchar(100) NOT NULL,
    address nvarchar(200) NOT NULL,

    -- Chống trùng mã trụ sở
    CONSTRAINT PK_headquarter PRIMARY KEY (ID_headquarter),

    -- Chống trùng tên trụ sở
    CONSTRAINT UQ_headquarter_name UNIQUE (name_headquarter)
);
GO

/* =========================================================
   2. DEPARTMENT
   Lưu thông tin khoa thuộc từng trụ sở
========================================================= */

CREATE TABLE department
(
    ID_department varchar(20) NOT NULL,
    name_department nvarchar(100) NOT NULL,
    ID_headquarter varchar(20) NOT NULL,

    -- Chống trùng mã khoa
    CONSTRAINT PK_department PRIMARY KEY (ID_department),

    -- Mỗi khoa phải thuộc một trụ sở hợp lệ
    CONSTRAINT FK_department_headquarter
        FOREIGN KEY (ID_headquarter)
            REFERENCES headquarter(ID_headquarter),

    -- Không trùng tên khoa trong cùng một trụ sở
    CONSTRAINT UQ_department_headquarter_name
        UNIQUE (ID_headquarter, name_department)
);
GO

/* =========================================================
   3. SUBJECT
   Danh mục môn học/học phần dùng chung toàn hệ thống
========================================================= */

CREATE TABLE subject
(
    ID_subject varchar(20) NOT NULL,
    name_subject nvarchar(100) NOT NULL,
    number_of_credit int NOT NULL,

    -- Chống trùng mã môn học
    CONSTRAINT PK_subject PRIMARY KEY (ID_subject),

    -- Chống trùng tên môn học
    CONSTRAINT UQ_subject_name UNIQUE (name_subject),

    -- Số tín chỉ phải lớn hơn 0
    CONSTRAINT CK_subject_credit CHECK (number_of_credit > 0)
);
GO

/* =========================================================
   4. CURRICULUM
   Chương trình đào tạo dùng chung toàn hệ thống
========================================================= */

CREATE TABLE curriculum
(
    ID_curriculum varchar(20) NOT NULL,
    curriculum_name nvarchar(100) NOT NULL,
    total_credits_required int NOT NULL,

    -- Chống trùng mã chương trình đào tạo
    CONSTRAINT PK_curriculum PRIMARY KEY (ID_curriculum),

    -- Chống trùng tên chương trình đào tạo
    CONSTRAINT UQ_curriculum_name UNIQUE (curriculum_name),

    -- Tổng tín chỉ yêu cầu phải lớn hơn 0
    CONSTRAINT CK_curriculum_total_credit CHECK (total_credits_required > 0)
);
GO

/* =========================================================
   5. CURRICULUM_SUBJECT
   Bảng trung gian giữa chương trình đào tạo và môn học
========================================================= */

CREATE TABLE curriculum_subject
(
    ID_curriculum varchar(20) NOT NULL,
    ID_subject varchar(20) NOT NULL,
    is_required bit NOT NULL,

    -- Một môn không được lặp trong cùng một chương trình đào tạo
    CONSTRAINT PK_curriculum_subject
        PRIMARY KEY (ID_curriculum, ID_subject),

    -- Chương trình đào tạo phải tồn tại
    CONSTRAINT FK_curriculum_subject_curriculum
        FOREIGN KEY (ID_curriculum)
            REFERENCES curriculum(ID_curriculum),

    -- Môn học phải tồn tại
    CONSTRAINT FK_curriculum_subject_subject
        FOREIGN KEY (ID_subject)
            REFERENCES subject(ID_subject)
);
GO

/* =========================================================
   6. PREREQUISITE
   Lưu môn học tiên quyết
========================================================= */

CREATE TABLE prerequisite
(
    ID_subject varchar(20) NOT NULL,
    ID_prereq_subject varchar(20) NOT NULL,
    min_grade float NULL,
    note nvarchar(200) NULL,

    -- Chống trùng cặp môn học - môn tiên quyết
    CONSTRAINT PK_prerequisite
        PRIMARY KEY (ID_subject, ID_prereq_subject),

    -- Môn học chính phải tồn tại
    CONSTRAINT FK_prerequisite_subject
        FOREIGN KEY (ID_subject)
            REFERENCES subject(ID_subject),

    -- Môn tiên quyết cũng phải tồn tại trong bảng subject
    CONSTRAINT FK_prerequisite_prereq_subject
        FOREIGN KEY (ID_prereq_subject)
            REFERENCES subject(ID_subject),

    -- Một môn không được là tiên quyết của chính nó
    CONSTRAINT CK_prerequisite_not_self
        CHECK (ID_subject <> ID_prereq_subject),

    -- Điểm tối thiểu nếu có phải nằm trong khoảng 0 đến 10
    CONSTRAINT CK_prerequisite_min_grade
        CHECK (min_grade IS NULL OR min_grade BETWEEN 0 AND 10)
);
GO

/* =========================================================
   7. TERM
   Lưu học kỳ, năm học, thời gian mở/đóng đăng ký
========================================================= */

CREATE TABLE term
(
    ID_term varchar(20) NOT NULL,
    name_term nvarchar(100) NOT NULL,
    year_start int NOT NULL,
    term_no int NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    reg_open datetime NOT NULL,
    reg_close datetime NOT NULL,

    -- Chống trùng mã học kỳ
    CONSTRAINT PK_term PRIMARY KEY (ID_term),

    -- Học kỳ chỉ nhận 1, 2 hoặc 3
    CONSTRAINT CK_term_no
        CHECK (term_no BETWEEN 1 AND 3),

    -- Ngày bắt đầu phải trước ngày kết thúc
    CONSTRAINT CK_term_date
        CHECK (start_date < end_date),

    -- Thời gian mở đăng ký phải trước thời gian đóng đăng ký
    CONSTRAINT CK_term_register_time
        CHECK (reg_open < reg_close)
);
GO

/* =========================================================
   8. TIMESLOT
   Lưu ca học dùng chung toàn hệ thống
========================================================= */

CREATE TABLE timeslot
(
    ID_timeslot varchar(20) NOT NULL,
    shift_no int NOT NULL,
    start_time time NOT NULL,
    end_time time NOT NULL,

    -- Chống trùng mã ca học
    CONSTRAINT PK_timeslot PRIMARY KEY (ID_timeslot),

    -- Chống trùng số ca học
    CONSTRAINT UQ_timeslot_shift_no
        UNIQUE (shift_no),

    -- Giờ bắt đầu phải trước giờ kết thúc
    CONSTRAINT CK_timeslot_time
        CHECK (start_time < end_time)
);
GO

/* =========================================================
   9. TEACHER
   Lưu thông tin giảng viên
========================================================= */

CREATE TABLE teacher
(
    ID_teacher varchar(20) NOT NULL,
    name_teacher nvarchar(100) NOT NULL,
    degree nvarchar(100) NULL,
    address_teacher nvarchar(200) NULL,
    phone_teacher varchar(15) NULL,
    gender_teacher nvarchar(10) NULL,
    ID_department varchar(20) NOT NULL,

    -- Chống trùng mã giảng viên
    CONSTRAINT PK_teacher PRIMARY KEY (ID_teacher),

    -- Giảng viên phải thuộc một khoa hợp lệ
    CONSTRAINT FK_teacher_department
        FOREIGN KEY (ID_department)
            REFERENCES department(ID_department)
);
GO

-- Chống trùng số điện thoại giảng viên nếu có nhập
CREATE UNIQUE INDEX UQ_teacher_phone
    ON teacher(phone_teacher)
    WHERE phone_teacher IS NOT NULL;
GO

/* =========================================================
   10. STUDENT
   Lưu thông tin sinh viên
========================================================= */

CREATE TABLE student
(
    ID_student varchar(20) NOT NULL,
    name_student nvarchar(100) NOT NULL,
    date_of_birth date NULL,
    gender_student nvarchar(10) NULL,
    address_student nvarchar(200) NULL,
    phone_student varchar(15) NULL,
    year_of_admission int NOT NULL,
    ID_department varchar(20) NOT NULL,
    ID_curriculum varchar(20) NOT NULL,

    -- Chống trùng mã sinh viên
    CONSTRAINT PK_student PRIMARY KEY (ID_student),

    -- Sinh viên phải thuộc một khoa hợp lệ
    CONSTRAINT FK_student_department
        FOREIGN KEY (ID_department)
            REFERENCES department(ID_department),

    -- Sinh viên phải theo một chương trình đào tạo hợp lệ
    CONSTRAINT FK_student_curriculum
        FOREIGN KEY (ID_curriculum)
            REFERENCES curriculum(ID_curriculum),

    -- Năm nhập học không quá nhỏ
    CONSTRAINT CK_student_year_admission
        CHECK (year_of_admission >= 2000)
);
GO

-- Chống trùng số điện thoại sinh viên nếu có nhập
CREATE UNIQUE INDEX UQ_student_phone
    ON student(phone_student)
    WHERE phone_student IS NOT NULL;
GO

/* =========================================================
   11. ROOM
   Lưu thông tin phòng học theo từng trụ sở
========================================================= */

CREATE TABLE room
(
    ID_room varchar(20) NOT NULL,
    name_room nvarchar(50) NOT NULL,
    capacity int NOT NULL,
    ID_headquarter varchar(20) NOT NULL,

    -- Chống trùng mã phòng
    CONSTRAINT PK_room PRIMARY KEY (ID_room),

    -- Phòng học phải thuộc một trụ sở hợp lệ
    CONSTRAINT FK_room_headquarter
        FOREIGN KEY (ID_headquarter)
            REFERENCES headquarter(ID_headquarter),

    -- Không trùng tên phòng trong cùng một trụ sở
    CONSTRAINT UQ_room_headquarter_name
        UNIQUE (ID_headquarter, name_room),

    -- Sức chứa phòng phải lớn hơn 0
    CONSTRAINT CK_room_capacity
        CHECK (capacity > 0)
);
GO

/* =========================================================
   12. CLASS
   Lưu lớp học phần được mở trong từng học kỳ
========================================================= */

CREATE TABLE [class]
(
    ID_class varchar(20) NOT NULL,
    ID_subject varchar(20) NOT NULL,
    ID_teacher varchar(20) NOT NULL,
    ID_term varchar(20) NOT NULL,
    group_number int NOT NULL,
    min_students int NOT NULL,
    max_students int NOT NULL,

    -- Số lượng sinh viên đã đăng ký, mặc định là 0
    number_of_registration int NOT NULL
    CONSTRAINT DF_class_number_of_registration DEFAULT 0,

    -- Trạng thái lớp học phần, mặc định là OPEN
    class_status varchar(20) NOT NULL
    CONSTRAINT DF_class_status DEFAULT 'OPEN',

    -- Chống trùng mã lớp học phần
    CONSTRAINT PK_class PRIMARY KEY (ID_class),

    -- Lớp học phần phải thuộc một môn học hợp lệ
    CONSTRAINT FK_class_subject
    FOREIGN KEY (ID_subject)
    REFERENCES subject(ID_subject),

    -- Lớp học phần phải có giảng viên phụ trách hợp lệ
    CONSTRAINT FK_class_teacher
    FOREIGN KEY (ID_teacher)
    REFERENCES teacher(ID_teacher),

    -- Lớp học phần phải thuộc một học kỳ hợp lệ
    CONSTRAINT FK_class_term
    FOREIGN KEY (ID_term)
    REFERENCES term(ID_term),

    -- Nhóm lớp học phần phải lớn hơn 0
    CONSTRAINT CK_class_group_number
    CHECK (group_number > 0),

    -- Sĩ số tối thiểu không được âm
    CONSTRAINT CK_class_min_students
    CHECK (min_students >= 0),

    -- Sĩ số tối đa phải lớn hơn 0
    CONSTRAINT CK_class_max_students
    CHECK (max_students > 0),

    -- Sĩ số tối thiểu không được lớn hơn sĩ số tối đa
    CONSTRAINT CK_class_min_max
    CHECK (min_students <= max_students),

    -- Số lượng đăng ký không được âm và không được vượt sĩ số tối đa
    CONSTRAINT CK_class_number_registration
    CHECK (number_of_registration >= 0 AND number_of_registration <= max_students),

    -- Trạng thái lớp chỉ được thuộc các giá trị hợp lệ
    CONSTRAINT CK_class_status
    CHECK (class_status IN ('OPEN', 'CLOSED', 'CANCELLED')),

    -- Chống trùng lớp cùng môn, cùng học kỳ, cùng nhóm
    CONSTRAINT UQ_class_subject_term_group
    UNIQUE (ID_subject, ID_term, group_number)
    );
GO

/* =========================================================
   13. SESSION
   Lưu lịch học/buổi học cụ thể của lớp học phần
========================================================= */

CREATE TABLE [session]
(
    ID_session varchar(20) NOT NULL,
    study_date date NOT NULL,
    day_of_week tinyint NOT NULL,
    note nvarchar(200) NULL,
    ID_class varchar(20) NOT NULL,
    ID_room varchar(20) NOT NULL,
    ID_timeslot varchar(20) NOT NULL,

    -- Chống trùng mã buổi học
    CONSTRAINT PK_session PRIMARY KEY (ID_session),

    -- Buổi học phải thuộc một lớp học phần hợp lệ
    CONSTRAINT FK_session_class
    FOREIGN KEY (ID_class)
    REFERENCES [class](ID_class),

    -- Buổi học phải diễn ra tại một phòng hợp lệ
    CONSTRAINT FK_session_room
    FOREIGN KEY (ID_room)
    REFERENCES room(ID_room),

    -- Buổi học phải thuộc một ca học hợp lệ
    CONSTRAINT FK_session_timeslot
    FOREIGN KEY (ID_timeslot)
    REFERENCES timeslot(ID_timeslot),

    -- Thứ trong tuần từ 2 đến 8
    CONSTRAINT CK_session_day_of_week
    CHECK (day_of_week BETWEEN 2 AND 8)
    );
GO

-- Một phòng không được xếp cho 2 lớp cùng ngày, cùng ca
CREATE UNIQUE INDEX UQ_session_room_time
    ON [session](ID_room, study_date, ID_timeslot);
GO

/* =========================================================
   14. REGISTRATION
   Lưu thông tin đăng ký học phần của sinh viên
========================================================= */

CREATE TABLE registration
(
    ID_registration varchar(20) NOT NULL,
    ID_student varchar(20) NOT NULL,
    ID_class varchar(20) NOT NULL,

    -- Thời gian đăng ký, mặc định là thời điểm hiện tại
    registered_at datetime NOT NULL
        CONSTRAINT DF_registration_registered_at DEFAULT GETDATE(),

    cancelled_at datetime NULL,

    -- Trạng thái đăng ký, mặc định là REGISTERED
    registration_status varchar(20) NOT NULL
        CONSTRAINT DF_registration_status DEFAULT 'REGISTERED',

    -- Chống trùng mã đăng ký
    CONSTRAINT PK_registration PRIMARY KEY (ID_registration),

    -- Đăng ký phải thuộc sinh viên hợp lệ
    CONSTRAINT FK_registration_student
        FOREIGN KEY (ID_student)
            REFERENCES student(ID_student),

    -- Đăng ký phải thuộc lớp học phần hợp lệ
    CONSTRAINT FK_registration_class
        FOREIGN KEY (ID_class)
            REFERENCES [class](ID_class),

    -- Trạng thái đăng ký chỉ nhận giá trị hợp lệ
    CONSTRAINT CK_registration_status
        CHECK (registration_status IN ('REGISTERED', 'CANCELLED')),

    -- Nếu có thời gian hủy thì thời gian hủy phải sau thời gian đăng ký
    CONSTRAINT CK_registration_cancelled_at
        CHECK (cancelled_at IS NULL OR cancelled_at >= registered_at)
);
GO

-- Chống sinh viên đăng ký trùng cùng một lớp học phần khi trạng thái còn REGISTERED
CREATE UNIQUE INDEX UQ_registration_active
    ON registration(ID_student, ID_class)
    WHERE registration_status = 'REGISTERED';
GO

/* =========================================================
   15. INDEX PHỤ TRỢ
   Tăng tốc join, thống kê và truy vấn phân tán
========================================================= */

CREATE INDEX IX_department_headquarter
    ON department(ID_headquarter);
GO

CREATE INDEX IX_teacher_department
    ON teacher(ID_department);
GO

CREATE INDEX IX_student_department
    ON student(ID_department);
GO

CREATE INDEX IX_student_curriculum
    ON student(ID_curriculum);
GO

CREATE INDEX IX_room_headquarter
    ON room(ID_headquarter);
GO

CREATE INDEX IX_class_subject
    ON [class](ID_subject);
GO

CREATE INDEX IX_class_teacher
    ON [class](ID_teacher);
GO

CREATE INDEX IX_class_term
    ON [class](ID_term);
GO

CREATE INDEX IX_session_class
    ON [session](ID_class);
GO

CREATE INDEX IX_registration_student
    ON registration(ID_student);
GO

CREATE INDEX IX_registration_class
    ON registration(ID_class);
GO

/* =========================================================
   16. PROCEDURE ĐĂNG KÝ HỌC PHẦN
   - Kiểm tra sinh viên tồn tại
   - Kiểm tra lớp đang OPEN
   - Kiểm tra còn trong thời gian đăng ký
   - Chống đăng ký trùng lớp
   - Chống trùng lịch học
   - Chống vượt sĩ số
   - Dùng TRANSACTION + UPDLOCK để xử lý đăng ký đồng thời
========================================================= */

CREATE OR ALTER PROCEDURE usp_RegisterClass
    @ID_registration varchar(20),
    @ID_student varchar(20),
    @ID_class varchar(20)
    AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

BEGIN TRY
BEGIN TRAN;

        -- Kiểm tra sinh viên có tồn tại không
        IF NOT EXISTS (
            SELECT 1
            FROM student
            WHERE ID_student = @ID_student
        )
BEGIN
            THROW 50001, N'Sinh viên không tồn tại.', 1;
END;

        -- Kiểm tra lớp có mở đăng ký và còn trong thời gian đăng ký không
        IF NOT EXISTS (
            SELECT 1
            FROM [class] c
            JOIN term t ON c.ID_term = t.ID_term
            WHERE c.ID_class = @ID_class
              AND c.class_status = 'OPEN'
              AND GETDATE() BETWEEN t.reg_open AND t.reg_close
        )
BEGIN
            THROW 50002, N'Lớp không mở đăng ký hoặc ngoài thời gian đăng ký.', 1;
END;

        -- Chống sinh viên đăng ký trùng cùng một lớp học phần
        IF EXISTS (
            SELECT 1
            FROM registration
            WHERE ID_student = @ID_student
              AND ID_class = @ID_class
              AND registration_status = 'REGISTERED'
        )
BEGIN
            THROW 50003, N'Sinh viên đã đăng ký lớp học phần này.', 1;
END;

        -- Chống sinh viên đăng ký 2 lớp bị trùng lịch học
        IF EXISTS (
            SELECT 1
            FROM registration r
            JOIN [session] s_old ON r.ID_class = s_old.ID_class
            JOIN [session] s_new ON s_old.study_date = s_new.study_date
                                  AND s_old.ID_timeslot = s_new.ID_timeslot
            WHERE r.ID_student = @ID_student
              AND r.registration_status = 'REGISTERED'
              AND s_new.ID_class = @ID_class
        )
BEGIN
            THROW 50004, N'Lịch học bị trùng với lớp học phần đã đăng ký.', 1;
END;

        -- Tăng sĩ số nếu lớp còn chỗ
        -- UPDLOCK khóa dòng lớp học phần để tránh đăng ký đồng thời làm vượt sĩ số
UPDATE c
SET number_of_registration = number_of_registration + 1
    FROM [class] c WITH (UPDLOCK, ROWLOCK)
WHERE c.ID_class = @ID_class
  AND c.class_status = 'OPEN'
  AND c.number_of_registration < c.max_students;

-- Nếu không update được dòng nào nghĩa là lớp đã đầy
IF @@ROWCOUNT = 0
BEGIN
            THROW 50005, N'Lớp học phần đã đủ sĩ số.', 1;
END;

        -- Thêm bản ghi đăng ký
INSERT INTO registration
(
    ID_registration,
    ID_student,
    ID_class
)
VALUES
    (
        @ID_registration,
        @ID_student,
        @ID_class
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

/* =========================================================
   17. PROCEDURE HỦY ĐĂNG KÝ
   - Chỉ hủy đăng ký đang REGISTERED
   - Cập nhật trạng thái CANCELLED
   - Ghi thời gian hủy
   - Giảm sĩ số lớp
   - Dùng TRANSACTION để đảm bảo nhất quán
========================================================= */

CREATE OR ALTER PROCEDURE usp_CancelRegistration
    @ID_registration varchar(20)
    AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

BEGIN TRY
BEGIN TRAN;

        DECLARE @ID_class varchar(20);

        -- Khóa bản ghi đăng ký cần hủy
SELECT @ID_class = ID_class
FROM registration WITH (UPDLOCK, ROWLOCK)
WHERE ID_registration = @ID_registration
  AND registration_status = 'REGISTERED';

-- Nếu không tìm thấy đăng ký hợp lệ thì báo lỗi
IF @ID_class IS NULL
BEGIN
            THROW 50101, N'Không tìm thấy đăng ký hợp lệ để hủy.', 1;
END;

        -- Cập nhật trạng thái hủy
UPDATE registration
SET registration_status = 'CANCELLED',
    cancelled_at = GETDATE()
WHERE ID_registration = @ID_registration;

-- Giảm sĩ số lớp sau khi hủy
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