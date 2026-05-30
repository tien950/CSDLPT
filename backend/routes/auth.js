import express from 'express';
import jwt from 'jsonwebtoken';
import { findDemoUser } from '../config/demo-users.js';

const router = express.Router();

const TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '8h';

router.post('/login', (req, res) => {
  const { username, password } = req.body ?? {};

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Thiếu tài khoản hoặc mật khẩu.'
    });
  }

  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    return res.status(500).json({
      success: false,
      message: 'Thiếu JWT_SECRET trong cấu hình.'
    });
  }

  const user = findDemoUser(username, password);
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Sai tài khoản hoặc mật khẩu.'
    });
  }

  const token = jwt.sign(
    {
      id: user.id,
      role: user.role,
      maCS: user.maCS
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRES_IN }
  );

  return res.json({
    success: true,
    data: {
      token,
      user: {
        id: user.id,
        role: user.role,
        maCS: user.maCS,
        username: user.username
      }
    }
  });
});

export default router;
