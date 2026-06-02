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
    id: 'GVHL01',
    username: 'gv_hl_01',
    password: 'gv123',
    role: 'giangvien',
    maCS: 'HQHL'
  },
  {
    id: 'GVHCM01',
    username: 'gv_hcm_01',
    password: 'gv123',
    role: 'giangvien',
    maCS: 'HQHCM'
  },
  {
    id: 'QTV01',
    username: 'qtv_01',
    password: 'qtv123',
    role: 'quantrivien',
    maCS: 'HQHD'
  },
  {
    id: 'QTVHL01',
    username: 'qtv_hl_01',
    password: 'qtv123',
    role: 'quantrivien',
    maCS: 'HQHL'
  },
  {
    id: 'QTVHCM01',
    username: 'qtv_hcm_01',
    password: 'qtv123',
    role: 'quantrivien',
    maCS: 'HQHCM'
  }
];

export function findDemoUser(username, password) {
  return demoUsers.find(
    user => user.username === username && user.password === password
  );
}
