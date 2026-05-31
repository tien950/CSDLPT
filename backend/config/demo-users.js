export const demoUsers = [
  {
    id: 'B22CNTT005',
    username: 'b22cntt005',
    password: '123456',
    role: 'sinhvien',
    maCS: 'HQHD'
  },
  {
    id: 'B22ATTT005',
    username: 'b22attt005',
    password: '123456',
    role: 'sinhvien',
    maCS: 'HQHL'
  },
  {
    id: 'B22ATTT001',
    username: 'b22attt001',
    password: '123456',
    role: 'sinhvien',
    maCS: 'HQHCM'
  },
  {
    id: 'GVHD01',
    username: 'gv_hd_01',
    password: 'gv123',
    role: 'giangvien',
    maCS: 'HQHD'
  },
  {
    id: 'NVHL01',
    username: 'nv_hl_01',
    password: 'nv123',
    role: 'nhanvien',
    maCS: 'HQHL'
  },
  {
    id: 'NVHD01',
    username: 'nv_hd_01',
    password: 'nv123',
    role: 'nhanvien',
    maCS: 'HQHD'
  },
  {
    id: 'NVHCM01',
    username: 'nv_hcm_01',
    password: 'nv123',
    role: 'nhanvien',
    maCS: 'HQHCM'
  },
  {
    id: 'QTV01',
    username: 'qtv_01',
    password: 'qtv123',
    role: 'quantrivien',
    maCS: 'HQHD'
  }
];

export function findDemoUser(username, password) {
  return demoUsers.find(
    user => user.username === username && user.password === password
  );
}
