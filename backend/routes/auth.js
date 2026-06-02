import express from 'express';
import jwt from 'jsonwebtoken';
import { findDemoUser } from '../config/demo-users.js';
import { LOCAL_NODE, normalizeNodeKey } from '../config/nodes.js';
import { callRemoteNode } from '../utils/remoteApi.js';

const router = express.Router();

const TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '8h';

async function ensureUserNodeOnline(userNode, backendNode) {
  if (userNode === backendNode) {
    return;
  }

  const result = await callRemoteNode(userNode, 'GET', '/api/internal/node-ping');
  if (!result.ok || result.data?.success === false) {
    const error = new Error(result.data?.message ?? `Server cơ sở ${userNode} đang tắt hoặc không phản hồi.`);
    error.status = 503;
    error.node = userNode;
    throw error;
  }
}

async function proxyLoginToUserNode(userNode, username, password) {
  const result = await callRemoteNode(userNode, 'POST', '/api/auth/login', { username, password });
  if (!result.ok) {
    const error = new Error(result.data?.message ?? `Server cơ sở ${userNode} không phản hồi đăng nhập.`);
    error.status = result.status;
    error.node = userNode;
    throw error;
  }
  return result;
}

router.post('/login', async (req, res) => {
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

  if (!userNode) {
    return res.status(500).json({
      success: false,
      message: 'Tài khoản demo chưa được cấu hình cơ sở hợp lệ.'
    });
  }

  if (userNode !== backendNode) {
    try {
      const remote = await proxyLoginToUserNode(userNode, username, password);
      return res.status(remote.status).json(remote.data);
    } catch (error) {
      return res.status(error.status ?? 503).json({
        success: false,
        message: `Không thể đăng nhập: server cơ sở ${userNode} đang tắt hoặc không phản hồi.`,
        node: userNode,
        backendNode,
        status: 'offline'
      });
    }
  }

  try {
    await ensureUserNodeOnline(userNode, backendNode);
  } catch (error) {
    return res.status(error.status ?? 503).json({
      success: false,
      message: `Không thể đăng nhập: server cơ sở ${userNode} đang tắt hoặc không phản hồi.`,
      node: userNode,
      backendNode,
      status: 'offline'
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
