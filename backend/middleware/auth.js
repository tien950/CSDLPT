import jwt from 'jsonwebtoken';

function isInternalCall(req) {
  const header = req.headers['x-internal-call'];
  const value = Array.isArray(header) ? header[0] : header;
  return String(value ?? '').trim().toLowerCase() === 'true';
}

export function authenticate(req, res, next) {
  if (isInternalCall(req)) {
    req.user = req.user ?? { role: 'system' };
    return next();
  }

  const authHeader = req.headers.authorization ?? '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({
      success: false,
      message: 'Thiếu token đăng nhập.'
    });
  }

  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    return res.status(500).json({
      success: false,
      message: 'Thiếu JWT_SECRET trong cấu hình.'
    });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: payload.id,
      role: payload.role,
      maCS: payload.maCS ?? payload.ID_headquarter,
      ID_headquarter: payload.ID_headquarter ?? payload.maCS,
      ID_user: payload.ID_user ?? payload.id,
      LOCAL_NODE: payload.LOCAL_NODE ?? payload.localNode ?? null
    };
    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token không hợp lệ hoặc đã hết hạn.'
    });
  }
}

export function requireRole(roles) {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role || !roles.includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền truy cập.'
      });
    }
    return next();
  };
}
