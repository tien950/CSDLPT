import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import dangkyRoutes from './routes/dangky.js';
import hocphanRoutes from './routes/hocphan.js';
import nodesRoutes from './routes/nodes.js';
import sinhvienRoutes from './routes/sinhvien.js';
import { closePools } from './config/db.js';

dotenv.config();

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 4000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/dangky', dangkyRoutes);
app.use('/api/hocphan', hocphanRoutes);
app.use('/api/nodes', nodesRoutes);
app.use('/api/sinhvien', sinhvienRoutes);

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
