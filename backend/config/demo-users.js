export const demoUsers = [
  {
    id: 'SVHD01',
    username: 'sv_hd_01',
    password: 'sv123',
    role: 'sinhvien',
    maCS: 'HQHD'
  },
  {
    id: 'SVHL01',
    username: 'sv_hl_01',
    password: 'sv123',
    role: 'sinhvien',
    maCS: 'HQHL'
  },
  {
    id: 'SVHCM01',
    username: 'sv_hcm_01',
    password: 'sv123',
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
