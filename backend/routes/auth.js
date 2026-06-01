import express from 'express';
import jwt from 'jsonwebtoken';
import { findDemoUser } from '../config/demo-users.js';
import { LOCAL_NODE, normalizeNodeKey } from '../config/nodes.js';

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

  const backendNode = normalizeNodeKey(LOCAL_NODE);
  const userNode = normalizeNodeKey(user.maCS);

  if (!backendNode) {
    return res.status(500).json({
      success: false,
      message: 'LOCAL_NODE chưa được cấu hình hợp lệ.'
    });
  }

  // Non-HQHD backends only allow users from the same campus.
  if (backendNode !== 'HQHD' && userNode !== backendNode) {
    return res.status(403).json({
      success: false,
      message: `Tài khoản thuộc ${userNode} phải đăng nhập đúng backend ${userNode}. Backend hiện tại là ${backendNode}.`,
      requiredNode: userNode,
      backendNode
    });
  }

  const token = jwt.sign(
    {
      id: user.id,
      role: user.role,
      maCS: user.maCS,
      ID_headquarter: user.maCS,
      ID_user: user.id,
      LOCAL_NODE
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRES_IN }
  );

  return res.json({
    success: true,
    data: {
      token,
      role: user.role,
      ID_headquarter: user.maCS,
      ID_user: user.id,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        maCS: user.maCS
      }
    }
  });
});

export default router;
