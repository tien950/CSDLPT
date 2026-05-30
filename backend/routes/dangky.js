import express from 'express';
import sql from 'mssql';
import { getPool } from '../config/db.js';
import { isValidNode, normalizeNodeKey } from '../config/nodes.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { createRequest, isOfflineError, withNode } from '../utils/db.js';

const router = express.Router();

const ID_TYPE = sql.NVarChar(50);

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function sendError(res, error) {
  if (isOfflineError(error)) {
    const node = error.node ?? 'UNKNOWN';
    return res.status(503).json({
      success: false,
      message: `Node ${node} đang offline.`,
      node,
      status: 'offline'
    });
  }

  const status = error.status ?? 500;
  const message = error.message ?? 'Có lỗi xảy ra.';
  return res.status(status).json({
    success: false,
    message
  });
}

async function safeGetPool(nodeKey) {
  try {
    return await getPool(nodeKey);
  } catch (error) {
    throw withNode(nodeKey, error);
  }
}

async function runOnNode(nodeKey, task) {
  try {
    return await task();
  } catch (error) {
    throw withNode(nodeKey, error);
  }
}

async function ensureStudentExists(transaction, nodeKey, maSV) {
  const request = createRequest(nodeKey, transaction);
  request.input('maSV', ID_TYPE, maSV);
  const result = await request.query(`SELECT 1 AS ok FROM student WHERE ID_student = @maSV`);
  if (result.recordset.length === 0) {
    throw createHttpError(404, 'Không tìm thấy sinh viên.');
  }
}

async function ensureClassAvailable(transaction, nodeKey, maLop) {
  const request = createRequest(nodeKey, transaction);
  request.input('maLop', ID_TYPE, maLop);
  const result = await request.query(
    `SELECT max_students AS siSoToiDa,
            number_of_registration AS siSoDaDK,
            class_status AS trangThai
     FROM [class]
     WHERE ID_class = @maLop`
  );
  if (result.recordset.length === 0) {
    throw createHttpError(404, 'Không tìm thấy lớp học phần.');
  }
  const { siSoToiDa, siSoDaDK, trangThai } = result.recordset[0];
  if (trangThai && trangThai !== 'OPEN') {
    throw createHttpError(400, 'Lớp học phần đang đóng.');
  }
  if (siSoDaDK >= siSoToiDa) {
    throw createHttpError(400, 'Lớp học phần đã đủ sĩ số.');
  }
}

async function ensureNotRegistered(transaction, nodeKey, maSV, maLop) {
  const request = createRequest(nodeKey, transaction);
  request.input('maSV', ID_TYPE, maSV);
  request.input('maLop', ID_TYPE, maLop);
  const result = await request.query(
    `SELECT 1 AS daDangKy
     FROM registration
     WHERE ID_student = @maSV
       AND ID_class = @maLop
       AND cancelled_at IS NULL
       AND registration_status = 'REGISTERED'`
  );
  if (result.recordset.length > 0) {
    throw createHttpError(400, 'Sinh viên đã đăng ký lớp học phần này.');
  }
}

async function insertRegistration(transaction, nodeKey, maSV, maLop) {
  const request = createRequest(nodeKey, transaction);
  request.input('maSV', ID_TYPE, maSV);
  request.input('maLop', ID_TYPE, maLop);
  await request.query(
    `INSERT INTO registration (ID_registration, ID_student, ID_class, registered_at, registration_status)
     VALUES (LEFT(CONVERT(VARCHAR(36), NEWID()), 16), @maSV, @maLop, GETDATE(), 'REGISTERED')`
  );
}

async function incrementClassEnrolled(transaction, nodeKey, maLop) {
  const request = createRequest(nodeKey, transaction);
  request.input('maLop', ID_TYPE, maLop);
  await request.query(
    `UPDATE [class]
     SET number_of_registration = number_of_registration + 1
     WHERE ID_class = @maLop`
  );
}

async function deleteRegistration(nodeKey, maSV, maLop) {
  const pool = await safeGetPool(nodeKey);
  const request = createRequest(nodeKey, null, pool);
  request.input('maSV', ID_TYPE, maSV);
  request.input('maLop', ID_TYPE, maLop);
  await request.query(
    `DELETE FROM registration WHERE ID_student = @maSV AND ID_class = @maLop`
  );
}

router.post('/', authenticate, requireRole(['sinhvien']), async (req, res) => {
  const { maLop, maCSLop } = req.body ?? {};
  const maSV = req.user?.id;
  const maCS = normalizeNodeKey(req.user?.maCS);
  const maCSLopNormalized = normalizeNodeKey(maCSLop);

  if (!maSV || !maCS) {
    return res.status(400).json({
      success: false,
      message: 'Thiếu thông tin sinh viên trong token.'
    });
  }

  if (!maLop || !maCSLop) {
    return res.status(400).json({
      success: false,
      message: 'Thiếu mã lớp hoặc mã cơ sở lớp học phần.'
    });
  }

  if (!isValidNode(maCS) || !isValidNode(maCSLopNormalized)) {
    return res.status(400).json({
      success: false,
      message: 'Mã cơ sở không hợp lệ.'
    });
  }

  if (maCS === maCSLopNormalized) {
    let transaction;
    try {
      const pool = await safeGetPool(maCS);
      transaction = new sql.Transaction(pool);
      await transaction.begin();
      await runOnNode(maCS, () => ensureStudentExists(transaction, maCS, maSV));
      await runOnNode(maCS, () => ensureClassAvailable(transaction, maCS, maLop));
      await runOnNode(maCS, () => ensureNotRegistered(transaction, maCS, maSV, maLop));
      await runOnNode(maCS, () => insertRegistration(transaction, maCS, maSV, maLop));
      await runOnNode(maCS, () => incrementClassEnrolled(transaction, maCS, maLop));
      await transaction.commit();
      return res.json({
        success: true,
        data: {
          maSV,
          maLop,
          maCS
        }
      });
    } catch (error) {
      if (transaction) {
        await transaction.rollback().catch(() => undefined);
      }
      return sendError(res, error);
    }
  }

  let transactionStudent;
  let transactionClass;
  try {
    const poolStudent = await safeGetPool(maCS);
    const poolClass = await safeGetPool(maCSLopNormalized);

    transactionStudent = new sql.Transaction(poolStudent);
    transactionClass = new sql.Transaction(poolClass);

    await transactionStudent.begin();
    await transactionClass.begin();

    await runOnNode(maCS, () => ensureStudentExists(transactionStudent, maCS, maSV));
    await runOnNode(maCS, () => ensureNotRegistered(transactionStudent, maCS, maSV, maLop));
    await runOnNode(maCSLopNormalized, () => ensureClassAvailable(transactionClass, maCSLopNormalized, maLop));

    await runOnNode(maCS, () => insertRegistration(transactionStudent, maCS, maSV, maLop));
    await runOnNode(maCSLopNormalized, () => incrementClassEnrolled(transactionClass, maCSLopNormalized, maLop));

    await transactionStudent.commit();
    try {
      await transactionClass.commit();
    } catch (error) {
      await runOnNode(maCS, () => deleteRegistration(maCS, maSV, maLop)).catch(() => undefined);
      throw error;
    }

    return res.json({
      success: true,
      data: {
        maSV,
        maLop,
        maCS,
        maCSLop: maCSLopNormalized
      }
    });
  } catch (error) {
    if (transactionStudent) {
      await transactionStudent.rollback().catch(() => undefined);
    }
    if (transactionClass) {
      await transactionClass.rollback().catch(() => undefined);
    }
    return sendError(res, error);
  }
});

router.post('/cancel', authenticate, requireRole(['sinhvien']), async (req, res) => {
  const { maDangKy } = req.body ?? {};
  const maSV = req.user?.id;
  const maCS = normalizeNodeKey(req.user?.maCS);

  if (!maSV || !maCS) {
    return res.status(400).json({
      success: false,
      message: 'Thiếu thông tin sinh viên.'
    });
  }

  if (!maDangKy) {
    return res.status(400).json({
      success: false,
      message: 'Thiếu mã đăng ký.'
    });
  }

  let transaction;
  try {
    const pool = await safeGetPool(maCS);
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    const request = createRequest(maCS, transaction);
    request.input('maDangKy', ID_TYPE, maDangKy);
    request.input('maSV', ID_TYPE, maSV);

    const regCheck = await request.query(
      `SELECT ID_class FROM registration WHERE ID_registration = @maDangKy AND ID_student = @maSV`
    );

    if (regCheck.recordset.length === 0) {
      throw createHttpError(404, 'Không tìm thấy đăng ký.');
    }

    const maLop = regCheck.recordset[0].ID_class;

    await request.query(
      `UPDATE registration SET cancelled_at = GETDATE(), registration_status = 'CANCELLED' WHERE ID_registration = @maDangKy`
    );

    request.input('maLop', ID_TYPE, maLop);
    await request.query(
      `UPDATE [class] SET number_of_registration = number_of_registration - 1 WHERE ID_class = @maLop`
    );

    await transaction.commit();

    return res.json({
      success: true,
      message: 'Hủy đăng ký thành công.'
    });
  } catch (error) {
    if (transaction) {
      await transaction.rollback().catch(() => undefined);
    }
    return sendError(res, error);
  }
});

export default router;
