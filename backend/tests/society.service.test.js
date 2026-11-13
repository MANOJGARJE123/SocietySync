const societyRepository = {
  findAll: vi.fn(),
  findByAdmin: vi.fn(),
  create: vi.fn(),
  findById: vi.fn()
};
const wingRepository = {
  createMany: vi.fn(),
  findBySociety: vi.fn(),
  create: vi.fn()
};
const userRepository = {
  updateById: vi.fn()
};

require.cache[require.resolve('../src/repositories/society.repository')] = {
  exports: societyRepository
};
require.cache[require.resolve('../src/repositories/wing.repository')] = {
  exports: wingRepository
};
require.cache[require.resolve('../src/repositories/user.repository')] = {
  exports: userRepository
};

const societyService = require('../src/services/society.service');

describe('societyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists societies for registration selection', async () => {
    const societies = [{ _id: 'society-1', name: 'Green Homes' }];
    societyRepository.findAll.mockResolvedValue(societies);

    await expect(societyService.listSocieties()).resolves.toEqual(societies);
    expect(societyRepository.findAll).toHaveBeenCalled();
  });

  it('creates a society with unique trimmed wings and attaches admin to it', async () => {
    const admin = { _id: 'admin-1', role: 'admin' };
    const society = { _id: 'society-1', name: 'Green Homes' };
    const wings = [
      { _id: 'wing-a', name: 'A', societyId: 'society-1' },
      { _id: 'wing-b', name: 'B', societyId: 'society-1' }
    ];

    societyRepository.findByAdmin.mockResolvedValue(null);
    societyRepository.create.mockResolvedValue(society);
    wingRepository.createMany.mockResolvedValue(wings);

    const result = await societyService.createSociety(admin, {
      name: 'Green Homes',
      wings: ['A', 'B', 'A', ' ']
    });

    expect(societyRepository.create).toHaveBeenCalledWith({
      name: 'Green Homes',
      createdBy: 'admin-1'
    });
    expect(wingRepository.createMany).toHaveBeenCalledWith(['A', 'B'], 'society-1');
    expect(userRepository.updateById).toHaveBeenCalledWith('admin-1', {
      societyId: 'society-1'
    });
    expect(result).toEqual({ ...society, wings });
  });

  it('prevents an admin from creating more than one society', async () => {
    societyRepository.findByAdmin.mockResolvedValue({ _id: 'society-1' });

    await expect(
      societyService.createSociety({ _id: 'admin-1' }, { name: 'Second Society' })
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
