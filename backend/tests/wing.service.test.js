const wingRepository = {
  findBySociety: vi.fn(),
  findById: vi.fn(),
  assignChairman: vi.fn()
};
const userRepository = {
  findById: vi.fn(),
  updateById: vi.fn(),
  findPendingByWing: vi.fn(),
  findApprovedByWing: vi.fn()
};

require.cache[require.resolve('../src/repositories/wing.repository')] = {
  exports: wingRepository
};
require.cache[require.resolve('../src/repositories/user.repository')] = {
  exports: userRepository
};

const wingService = require('../src/services/wing.service');

const wing = {
  _id: 'wing-1',
  id: 'wing-1',
  name: 'A',
  societyId: 'society-1'
};

const chairman = {
  _id: 'chairman-1',
  role: 'chairman',
  societyId: 'society-1',
  wingId: 'wing-1'
};

const pendingResident = {
  _id: 'resident-1',
  role: 'resident',
  societyId: 'society-1',
  requestedWingId: 'wing-1',
  wingStatus: 'pending'
};

describe('wingService public listing and role authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists wings for a society without requiring a user object', async () => {
    wingRepository.findBySociety.mockResolvedValue([wing]);

    await expect(wingService.getWingsBySociety('society-1')).resolves.toEqual([wing]);
    expect(wingRepository.findBySociety).toHaveBeenCalledWith('society-1');
  });

  it('allows only residents to request joining a wing', async () => {
    await expect(
      wingService.requestJoinWing({ _id: 'admin-1', role: 'admin' }, 'wing-1')
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('stores resident join requests as pending', async () => {
    const updated = {
      ...pendingResident,
      wingId: null
    };

    wingRepository.findById.mockResolvedValue(wing);
    userRepository.updateById.mockResolvedValue(updated);

    const result = await wingService.requestJoinWing({ _id: 'resident-1', role: 'resident' }, 'wing-1');

    expect(userRepository.updateById).toHaveBeenCalledWith('resident-1', {
      societyId: 'society-1',
      wingId: null,
      requestedWingId: 'wing-1',
      wingStatus: 'pending'
    });
    expect(result).toEqual(updated);
  });
});

describe('wingService chairman request management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists only pending requests for the chairman own wing', async () => {
    userRepository.findPendingByWing.mockResolvedValue([pendingResident]);

    await expect(wingService.listPendingRequests(chairman, 'wing-1')).resolves.toEqual([
      pendingResident
    ]);
    expect(userRepository.findPendingByWing).toHaveBeenCalledWith('wing-1');
  });

  it('blocks chairman from viewing another wing requests', async () => {
    await expect(wingService.listPendingRequests(chairman, 'wing-2')).rejects.toMatchObject({
      statusCode: 403
    });
  });

  it('approves a pending resident for the chairman own wing', async () => {
    const approved = {
      ...pendingResident,
      wingId: 'wing-1',
      requestedWingId: undefined,
      wingStatus: 'approved'
    };

    userRepository.findById.mockResolvedValue(pendingResident);
    userRepository.updateById.mockResolvedValue(approved);

    const result = await wingService.approveRequest(chairman, 'wing-1', 'resident-1');

    expect(userRepository.updateById).toHaveBeenCalledWith('resident-1', {
      wingId: 'wing-1',
      requestedWingId: null,
      wingStatus: 'approved'
    });
    expect(result).toEqual(approved);
  });

  it('rejects a pending resident for the chairman own wing', async () => {
    const rejected = {
      ...pendingResident,
      requestedWingId: undefined,
      wingStatus: 'rejected'
    };

    userRepository.findById.mockResolvedValue(pendingResident);
    userRepository.updateById.mockResolvedValue(rejected);

    const result = await wingService.rejectRequest(chairman, 'wing-1', 'resident-1');

    expect(userRepository.updateById).toHaveBeenCalledWith('resident-1', {
      requestedWingId: null,
      wingStatus: 'rejected'
    });
    expect(result).toEqual(rejected);
  });

  it('does not approve a resident without a matching pending request', async () => {
    userRepository.findById.mockResolvedValue({
      ...pendingResident,
      requestedWingId: 'wing-2'
    });

    await expect(
      wingService.approveRequest(chairman, 'wing-1', 'resident-1')
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('wingService chairman assignment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('assigns a chairman to an admin society wing and updates chairman society/wing', async () => {
    const admin = { _id: 'admin-1', role: 'admin', societyId: 'society-1' };
    const assignedWing = { ...wing, chairmanId: 'chairman-1' };

    wingRepository.findById.mockResolvedValue(wing);
    userRepository.findById.mockResolvedValue({ _id: 'chairman-1', role: 'chairman' });
    wingRepository.assignChairman.mockResolvedValue(assignedWing);

    const result = await wingService.assignChairman('wing-1', 'chairman-1', admin);

    expect(wingRepository.assignChairman).toHaveBeenCalledWith('wing-1', 'chairman-1');
    expect(userRepository.updateById).toHaveBeenCalledWith('chairman-1', {
      societyId: 'society-1',
      wingId: 'wing-1'
    });
    expect(result).toEqual(assignedWing);
  });
});
