import express from 'express';
import sql from 'mssql';
import { getPool } from '../config/db.js';
import { isValidNode } from '../config/nodes.js';
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

async function ensureStudentExists(transaction, nodeKey, maSV, maCS) {
  const request = createRequest(nodeKey, transaction);
  request.input('maSV', ID_TYPE, maSV);
  const result = await request.query(
    `SELECT id_headquarter AS maCS FROM student WHERE id_student = @maSV`
  );
  if (result.recordset.length === 0) {
    throw createHttpError(404, 'Không tìm thấy sinh viên.');
  }
  if (result.recordset[0].maCS !== maCS) {
    throw createHttpError(400, 'Sinh viên không thuộc cơ sở này.');
  }
}

async function ensureClassAvailable(transaction, nodeKey, maLop, maCSLop) {
  const request = createRequest(nodeKey, transaction);
  request.input('maLop', ID_TYPE, maLop);
  const result = await request.query(
    `SELECT id_headquarter AS maCS, max_enrolled AS siSoToiDa, enrolled_count AS siSoDaDK
     FROM [class]
     WHERE id_class = @maLop`
  );
  if (result.recordset.length === 0) {
    throw createHttpError(404, 'Không tìm thấy lớp học phần.');
  }
  const { maCS, siSoToiDa, siSoDaDK } = result.recordset[0];
  if (maCS !== maCSLop) {
    throw createHttpError(400, 'Lớp học phần không thuộc cơ sở đã chọn.');
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
     WHERE id_student = @maSV AND id_class = @maLop`
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
    `INSERT INTO registration (id_student, id_class, registered_at)
     VALUES (@maSV, @maLop, SYSUTCDATETIME())`
  );
}

async function incrementClassEnrolled(transaction, nodeKey, maLop) {
  const request = createRequest(nodeKey, transaction);
  request.input('maLop', ID_TYPE, maLop);
  await request.query(
    `UPDATE [class]
     SET enrolled_count = enrolled_count + 1
     WHERE id_class = @maLop`
  );
}

async function deleteRegistration(nodeKey, maSV, maLop) {
  const pool = await safeGetPool(nodeKey);
  const request = createRequest(nodeKey, null, pool);
  request.input('maSV', ID_TYPE, maSV);
  request.input('maLop', ID_TYPE, maLop);
  await request.query(
    `DELETE FROM registration WHERE id_student = @maSV AND id_class = @maLop`
  );
}

router.post('/', authenticate, requireRole(['sinhvien']), async (req, res) => {
  const { maLop, maCSLop } = req.body ?? {};
  const maSV = req.user?.id;
  const maCS = req.user?.maCS;

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

  if (!isValidNode(maCS) || !isValidNode(maCSLop)) {
    return res.status(400).json({
      success: false,
      message: 'Mã cơ sở không hợp lệ.'
    });
  }

  if (maCS === maCSLop) {
    let transaction;
    try {
      const pool = await safeGetPool(maCS);
      transaction = new sql.Transaction(pool);
      await transaction.begin();
      await runOnNode(maCS, () => ensureStudentExists(transaction, maCS, maSV, maCS));
      await runOnNode(maCS, () => ensureClassAvailable(transaction, maCS, maLop, maCSLop));
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
    const poolClass = await safeGetPool(maCSLop);

    transactionStudent = new sql.Transaction(poolStudent);
    transactionClass = new sql.Transaction(poolClass);

    await transactionStudent.begin();
    await transactionClass.begin();

    await runOnNode(maCS, () => ensureStudentExists(transactionStudent, maCS, maSV, maCS));
    await runOnNode(maCS, () => ensureNotRegistered(transactionStudent, maCS, maSV, maLop));
    await runOnNode(maCSLop, () => ensureClassAvailable(transactionClass, maCSLop, maLop, maCSLop));

    await runOnNode(maCS, () => insertRegistration(transactionStudent, maCS, maSV, maLop));
    await runOnNode(maCSLop, () => incrementClassEnrolled(transactionClass, maCSLop, maLop));

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
        maCSLop
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

export default router;
