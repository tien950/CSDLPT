-- Trigger kiểm tra đăng ký trùng học phần
-- Trigger này dùng để kiểm tra trường hợp một sinh viên đăng ký nhiều lớp học phần khác nhau nhưng thuộc cùng một môn học trong cùng một học kỳ. Điều này giúp tránh việc sinh viên học trùng một học phần nhiều lần trong cùng kỳ.

USE DkyTinChi;
GO

CREATE OR ALTER TRIGGER trg_check_duplicate_subject_registration
ON registration
AFTER INSERT, UPDATE
                                  AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS
    (
        SELECT 1
        FROM inserted i
        JOIN [class] c_new
            ON i.ID_class = c_new.ID_class
        JOIN registration r
            ON r.ID_student = i.ID_student
           AND r.registration_status = 'REGISTERED'
           AND r.ID_registration <> i.ID_registration
        JOIN [class] c_old
            ON r.ID_class = c_old.ID_class
        WHERE i.registration_status = 'REGISTERED'
          AND c_new.ID_subject = c_old.ID_subject
          AND c_new.ID_term = c_old.ID_term
    )
BEGIN
        RAISERROR(N'Đăng ký thất bại: Sinh viên đã đăng ký học phần này trong cùng học kỳ.', 16, 1);
ROLLBACK TRANSACTION;
RETURN;
END
END;
GO

-- Nhận xét:
-- Trigger đã phát hiện trường hợp sinh viên đăng ký trùng học phần trong cùng học kỳ và tự động hủy thao tác ghi dữ liệu không hợp lệ.
--
-- Trigger kiểm tra trùng lịch học
-- Trigger này kiểm tra trường hợp sinh viên đăng ký một lớp học phần có lịch học trùng với lớp học phần đã đăng ký trước đó. Việc kiểm tra dựa trên ngày học và ca học của các buổi học trong bảng session.
USE DkyTinChi;
GO

CREATE OR ALTER TRIGGER trg_check_schedule_conflict
ON registration
AFTER INSERT, UPDATE
                                  AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS
    (
        SELECT 1
        FROM inserted i
        JOIN [session] s_new
            ON i.ID_class = s_new.ID_class
        JOIN registration r
            ON r.ID_student = i.ID_student
           AND r.registration_status = 'REGISTERED'
           AND r.ID_registration <> i.ID_registration
        JOIN [session] s_old
            ON r.ID_class = s_old.ID_class
           AND s_new.study_date = s_old.study_date
           AND s_new.ID_timeslot = s_old.ID_timeslot
        WHERE i.registration_status = 'REGISTERED'
    )
BEGIN
        RAISERROR(N'Đăng ký thất bại: Lịch học bị trùng với lớp học phần đã đăng ký.', 16, 1);
ROLLBACK TRANSACTION;
RETURN;
END
END;
GO


-- Nhận xét:
-- Trigger giúp đảm bảo mỗi sinh viên không thể đăng ký hai lớp học phần có lịch học trùng nhau.
--
-- Trigger kiểm tra sĩ số lớp học phần
-- Trigger này kiểm tra số lượng đăng ký thực tế của lớp học phần so với sĩ số tối đa max_students. Nếu số lượng sinh viên đăng ký vượt quá giới hạn, hệ thống sẽ hủy thao tác.

USE DkyTinChi;
GO

CREATE OR ALTER TRIGGER trg_check_class_capacity
ON registration
AFTER INSERT, UPDATE
                                  AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS
    (
        SELECT 1
        FROM [class] c
        JOIN
        (
            SELECT ID_class, COUNT(*) AS total_registered
            FROM registration
            WHERE registration_status = 'REGISTERED'
            GROUP BY ID_class
        ) x
            ON c.ID_class = x.ID_class
        WHERE x.total_registered > c.max_students
    )
BEGIN
        RAISERROR(N'Đăng ký thất bại: Lớp học phần đã vượt quá sĩ số tối đa.', 16, 1);
ROLLBACK TRANSACTION;
RETURN;
END
END;
GO

-- Kiểm thử Trigger
--
-- Nhận xét:
-- Trigger hỗ trợ đảm bảo số lượng sinh viên đăng ký không vượt quá sĩ số tối đa của lớp học phần.
--
-- Trigger kiểm tra sức chứa
-- Trigger này kiểm tra sức chứa phòng học khi thêm hoặc cập nhật lịch học. Nếu sĩ số tối đa của lớp học phần lớn hơn sức chứa phòng, hệ thống không cho phép xếp lớp vào phòng đó.

USE DkyTinChi;
GO

CREATE OR ALTER TRIGGER trg_check_room_capacity
ON [session]
AFTER INSERT, UPDATE
                                  AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS
    (
        SELECT 1
        FROM inserted i
        JOIN [class] c
            ON i.ID_class = c.ID_class
        JOIN room r
            ON i.ID_room = r.ID_room
        WHERE c.max_students > r.capacity
    )
BEGIN
        RAISERROR(N'Cập nhật lịch học thất bại: Sức chứa phòng nhỏ hơn sĩ số tối đa của lớp học phần.', 16, 1);
ROLLBACK TRANSACTION;
RETURN;
END
END;
GO

-- Nhận xét:
-- Trigger giúp đảm bảo việc xếp lịch học phù hợp với sức chứa phòng học tại từng cơ sở.
