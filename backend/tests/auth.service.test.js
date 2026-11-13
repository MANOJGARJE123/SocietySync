const userRepository = {
  findByEmail: vi.fn(),
  create: vi.fn()
};
const wingRepository = {
  findById: vi.fn()
};
const bcrypt = {
  hash: vi.fn(),
  compare: vi.fn()
};
const jwt = {
  signToken: vi.fn()
};

require.cache[require.resolve('../src/repositories/user.repository')] = {
  exports: userRepository
};
require.cache[require.resolve('../src/repositories/wing.repository')] = {
  exports: wingRepository
};
require.cache[require.resolve('bcryptjs')] = {
  exports: bcrypt
};
require.cache[require.resolve('../src/utils/jwt')] = {
  exports: jwt
};

const authService = require('../src/services/auth.service');

const baseUser = {
  _id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'resident',
  phone: '9999999999',
  flatNumber: 'A-101',
  societyId: undefined,
  wingId: undefined,
  requestedWingId: undefined,
  wingStatus: 'none'
};

describe('authService.register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when required fields are missing', async () => {
    await expect(authService.register({ email: 'a@b.com' })).rejects.toMatchObject({
      statusCode: 400
    });
  });

  it('throws when role is invalid', async () => {
    await expect(
      authService.register({ name: 'A', email: 'a@b.com', password: 'pass', role: 'owner' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws when email already exists', async () => {
    userRepository.findByEmail.mockResolvedValue(baseUser);

    await expect(
      authService.register({ name: 'A', email: 'a@b.com', password: 'pass' })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('registers a non-resident user and returns token', async () => {
    const adminUser = { ...baseUser, role: 'admin' };
    userRepository.findByEmail.mockResolvedValue(null);
    bcrypt.hash.mockResolvedValue('hashed-pass');
    userRepository.create.mockResolvedValue(adminUser);
    jwt.signToken.mockReturnValue('token-123');

    const result = await authService.register({
      name: adminUser.name,
      email: adminUser.email,
      password: 'pass',
      role: adminUser.role,
      phone: adminUser.phone,
      flatNumber: adminUser.flatNumber
    });

    expect(bcrypt.hash).toHaveBeenCalledWith('pass', 10);
    expect(userRepository.create).toHaveBeenCalledWith({
      name: adminUser.name,
      email: adminUser.email,
      password: 'hashed-pass',
      role: adminUser.role,
      phone: adminUser.phone,
      flatNumber: adminUser.flatNumber,
      societyId: undefined,
      requestedWingId: undefined,
      wingStatus: 'none'
    });
    expect(jwt.signToken).toHaveBeenCalledWith({ userId: adminUser._id, role: adminUser.role });
    expect(result.user).toMatchObject({
      id: adminUser._id,
      role: 'admin',
      wingStatus: 'none'
    });
  });

  it('registers a resident with pending requested wing approval', async () => {
    const wing = { _id: 'wing-1', id: 'wing-1', societyId: 'society-1' };
    const pendingResident = {
      ...baseUser,
      societyId: 'society-1',
      requestedWingId: 'wing-1',
      wingStatus: 'pending'
    };

    userRepository.findByEmail.mockResolvedValue(null);
    wingRepository.findById.mockResolvedValue(wing);
    bcrypt.hash.mockResolvedValue('hashed-pass');
    userRepository.create.mockResolvedValue(pendingResident);
    jwt.signToken.mockReturnValue('token-123');

    const result = await authService.register({
      name: pendingResident.name,
      email: pendingResident.email,
      password: 'pass',
      role: 'resident',
      phone: pendingResident.phone,
      flatNumber: pendingResident.flatNumber,
      wingId: 'wing-1'
    });

    expect(wingRepository.findById).toHaveBeenCalledWith('wing-1');
    expect(userRepository.create).toHaveBeenCalledWith({
      name: pendingResident.name,
      email: pendingResident.email,
      password: 'hashed-pass',
      role: 'resident',
      phone: pendingResident.phone,
      flatNumber: pendingResident.flatNumber,
      societyId: 'society-1',
      requestedWingId: 'wing-1',
      wingStatus: 'pending'
    });
    expect(result.user).toMatchObject({
      societyId: 'society-1',
      requestedWingId: 'wing-1',
      wingStatus: 'pending'
    });
    expect(result.user.wingId).toBeUndefined();
  });

  it('throws when resident requests an unknown wing', async () => {
    userRepository.findByEmail.mockResolvedValue(null);
    wingRepository.findById.mockResolvedValue(null);

    await expect(
      authService.register({
        name: 'Resident',
        email: 'resident@example.com',
        password: 'pass',
        role: 'resident',
        wingId: 'missing-wing'
      })
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('authService.login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when required fields are missing', async () => {
    await expect(authService.login({ email: 'a@b.com' })).rejects.toMatchObject({
      statusCode: 400
    });
  });

  it('throws when user does not exist', async () => {
    userRepository.findByEmail.mockResolvedValue(null);

    await expect(
      authService.login({ email: 'a@b.com', password: 'pass' })
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it('throws when password does not match', async () => {
    userRepository.findByEmail.mockResolvedValue({ ...baseUser, password: 'hashed-pass' });
    bcrypt.compare.mockResolvedValue(false);

    await expect(
      authService.login({ email: 'a@b.com', password: 'pass' })
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it('logs in and returns token', async () => {
    userRepository.findByEmail.mockResolvedValue({ ...baseUser, password: 'hashed-pass' });
    bcrypt.compare.mockResolvedValue(true);
    jwt.signToken.mockReturnValue('token-456');

    const result = await authService.login({ email: 'a@b.com', password: 'pass' });

    expect(bcrypt.compare).toHaveBeenCalledWith('pass', 'hashed-pass');
    expect(jwt.signToken).toHaveBeenCalledWith({ userId: baseUser._id, role: baseUser.role });
    expect(result).toEqual({
      token: 'token-456',
      user: {
        id: baseUser._id,
        name: baseUser.name,
        email: baseUser.email,
        role: baseUser.role,
        phone: baseUser.phone,
        flatNumber: baseUser.flatNumber,
        societyId: baseUser.societyId,
        wingId: baseUser.wingId,
        requestedWingId: baseUser.requestedWingId,
        wingStatus: baseUser.wingStatus
      }
    });
  });
});
