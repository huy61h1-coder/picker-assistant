import { createHash } from 'node:crypto';

export const SESSION_TTL_MS = 1000 * 60 * 60 * 16;

function hashPassword(value) {
  return createHash('sha256')
    .update(String(value || ''))
    .digest('hex');
}

export function sanitizeUser(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName || user.username,
    role: user.role || 'picker',
  };
}

export function getInitialState() {
  return {
    aisleProducts: {
      'L17-A': [],
      'L12-A': [
        {
          locId: 1,
          sku: '10531914',
          name: 'HC TAM TRAI LAM MAT ICECOLD 160X200GY',
          verified: true,
        },
        {
          locId: 5,
          sku: '10763049',
          name: 'HC GOI MOCHI PILLOW BE',
          verified: true,
        },
      ],
    },
    aisleVisuals: {},
    lossAudits: [],
    stockChecks: [],
    updatedAt: new Date().toISOString(),
  };
}

export function getUsers() {
  const adminUsername = String(process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase() || 'admin';
  const adminPassword = String(process.env.ADMIN_PASSWORD || '123456');
  const pickerUsername = String(process.env.PICKER_USERNAME || 'picker01').trim().toLowerCase() || 'picker01';
  const pickerPassword = String(process.env.PICKER_PASSWORD || '123456');

  return [
    {
      id: 'u-admin',
      username: adminUsername,
      displayName: String(process.env.ADMIN_DISPLAY_NAME || 'Quan ly kho'),
      role: 'admin',
      passwordHash: hashPassword(adminPassword),
    },
    {
      id: 'u-picker01',
      username: pickerUsername,
      displayName: String(process.env.PICKER_DISPLAY_NAME || 'Nhan vien 01'),
      role: 'picker',
      passwordHash: hashPassword(pickerPassword),
    },
  ];
}

export function verifyUserCredentials(username, password) {
  const safeUsername = String(username || '').trim().toLowerCase();
  const users = getUsers();
  const user = users.find((item) => item.username === safeUsername);

  if (!user) {
    return null;
  }

  const passwordHash = hashPassword(password);
  return user.passwordHash === passwordHash ? user : null;
}
