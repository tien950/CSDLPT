import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import dangkyRoutes from './routes/dangky.js';
import hocphanRoutes from './routes/hocphan.js';
import nodesRoutes from './routes/nodes.js';
import sinhvienRoutes from './routes/sinhvien.js';
import adminRoutes from './routes/admin.js';
import thongkeRoutes from './routes/thongke.js';
import cosoRoutes from './routes/coso.js';
import giangvienRoutes from './routes/giangvien.js';
import lophocphanRoutes from './routes/lophocphan.js';
import phonghocRoutes from './routes/phonghoc.js';
import lichhocRoutes from './routes/lichhoc.js';
import thoikhoabieuRoutes from './routes/thoikhoabieu.js';
import internalRouter from './routes/internal.js';
import { closePools } from './config/db.js';
import { getPool } from './config/db.js';
import { LOCAL_NODE } from './config/nodes.js';

dotenv.config();

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 4000;

// simple timing logger to detect slow endpoints
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    if (ms > 500) {
      console.warn(`[SLOW] ${req.method} ${req.originalUrl} took ${ms}ms`);
    }
    // light info-level log
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} ${ms}ms`);
  });
  next();
});

app.use(cors());
app.use(express.json());

// health endpoint: quick check of DB node connectivity
app.get('/api/health', async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().query('SELECT 1 AS ok');
    res.json({
      success: true,
      nodes: {
        [LOCAL_NODE ?? 'UNKNOWN']: { ok: true, timestamp: new Date().toISOString() }
      }
    });
  } catch (err) {
    res.json({
      success: false,
      nodes: {
        [LOCAL_NODE ?? 'UNKNOWN']: {
          ok: false,
          message: err.message,
          code: err.code,
          timestamp: new Date().toISOString()
        }
      }
    });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/internal', internalRouter);
app.use('/api/dangky', dangkyRoutes);
app.use('/api/hocphan', hocphanRoutes);
app.use('/api/nodes', nodesRoutes);
app.use('/api/sinhvien', sinhvienRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/thongke', thongkeRoutes);
app.use('/api/coso', cosoRoutes);
app.use('/api/giangvien', giangvienRoutes);
app.use('/api/lophocphan', lophocphanRoutes);
app.use('/api/phonghoc', phonghocRoutes);
app.use('/api/lichhoc', lichhocRoutes);
app.use('/api/thoikhoabieu', thoikhoabieuRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Không tìm thấy API.'
  });
});

const server = app.listen(port, () => {
  console.log(`API server running on port ${port}`);
});

async function shutdown() {
  await closePools();
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
