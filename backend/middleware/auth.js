import jwt from 'jsonwebtoken';

export function authenticate(req, res, next) {
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
      ID_user: payload.ID_user ?? payload.id
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
