const complaintService = {
  createComplaint: vi.fn()
};
const noticeService = {
  createNotice: vi.fn()
};
const maintenanceService = {
  createDue: vi.fn()
};
const userService = {
  registerResident: vi.fn(),
  updateProfile: vi.fn()
};
const userRepository = {
  findById: vi.fn(),
  findByEmail: vi.fn(),
  findBySociety: vi.fn()
};
const wingRepository = {
  findBySociety: vi.fn(),
  findById: vi.fn()
};
const ragRepository = {
  findTopSimilarChunks: vi.fn(),
  countChunks: vi.fn()
};
const noticeRepository = {
  findAll: vi.fn()
};
const maintenanceRepository = {
  findAll: vi.fn()
};
const embeddingHelper = vi.fn();

require.cache[require.resolve('../src/services/complaint.service')] = {
  exports: complaintService
};
require.cache[require.resolve('../src/services/notice.service')] = {
  exports: noticeService
};
require.cache[require.resolve('../src/services/maintenance.service')] = {
  exports: maintenanceService
};
require.cache[require.resolve('../src/services/user.service')] = {
  exports: userService
};
require.cache[require.resolve('../src/repositories/user.repository')] = {
  exports: userRepository
};
require.cache[require.resolve('../src/repositories/wing.repository')] = {
  exports: wingRepository
};
require.cache[require.resolve('../src/repositories/rag.repository')] = {
  exports: ragRepository
};
require.cache[require.resolve('../src/repositories/notice.repository')] = {
  exports: noticeRepository
};
require.cache[require.resolve('../src/repositories/maintenance.repository')] = {
  exports: maintenanceRepository
};
require.cache[require.resolve('../src/utils/embeddingHelper')] = {
  exports: embeddingHelper
};

const ragService = require('../src/services/rag.service');

describe('ragService assistant actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    noticeRepository.findAll.mockResolvedValue([]);
    maintenanceRepository.findAll.mockResolvedValue([]);
    ragRepository.findTopSimilarChunks.mockResolvedValue([]);
    ragRepository.countChunks.mockResolvedValue(0);
    embeddingHelper.mockResolvedValue([0.1, 0.2]);
  });

  it('creates a complaint from a natural language RAG request', async () => {
    complaintService.createComplaint.mockResolvedValue({
      _id: 'complaint-1',
      title: 'Water Leakage',
      status: 'pending'
    });

    const result = await ragService.answerQuestion('Please raise a complaint for water leakage issue in wing D', {
      _id: 'resident-1',
      role: 'resident',
      wingStatus: 'approved'
    });

    expect(complaintService.createComplaint).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Water Leakage',
        description: expect.stringContaining('water leakage issue')
      }),
      'resident-1'
    );
    expect(result.action).toEqual({ type: 'complaint', success: true, id: 'complaint-1' });
    expect(result.answer).toContain('Complaint created successfully');
  });

  it('creates a wing notice from a natural language RAG request', async () => {
    wingRepository.findBySociety.mockResolvedValue([{ _id: 'wing-d', name: 'D' }]);
    noticeService.createNotice.mockResolvedValue({
      _id: 'notice-1',
      title: 'Water Supply Will Be Closed',
      expiresAt: '2026-05-10T00:00:00.000Z'
    });

    const result = await ragService.answerQuestion(
      'Publish notice in wing D that water supply will be closed tomorrow for 2 days',
      {
        _id: 'admin-1',
        role: 'admin',
        societyId: 'society-1'
      }
    );

    expect(wingRepository.findBySociety).toHaveBeenCalledWith('society-1');
    expect(noticeService.createNotice).toHaveBeenCalledWith(
      expect.objectContaining({
        wingId: 'wing-d',
        expiryDays: 2
      }),
      expect.objectContaining({ _id: 'admin-1' })
    );
    expect(result.action).toEqual({ type: 'notice', success: true, id: 'notice-1' });
    expect(result.answer).toContain('Notice created successfully');
  });

  it('does not create notices for residents', async () => {
    const result = await ragService.answerQuestion('Create notice about lift repair', {
      _id: 'resident-1',
      role: 'resident',
      wingStatus: 'approved'
    });

    expect(noticeService.createNotice).not.toHaveBeenCalled();
    expect(result.action).toEqual({ type: 'notice', success: false });
    expect(result.answer).toContain('only admins and chairmen');
  });

  it('does not treat how-to questions as create actions', async () => {
    const result = await ragService.answerQuestion('How can I raise a complaint?', {
      _id: 'resident-1',
      role: 'resident',
      wingStatus: 'approved'
    });

    expect(complaintService.createComplaint).not.toHaveBeenCalled();
    expect(result.action).toBeUndefined();
  });

  it('creates a maintenance due from a natural language RAG request', async () => {
    userRepository.findByEmail.mockResolvedValue({
      _id: 'resident-1',
      name: 'Rina Shah',
      email: 'rina@test.com'
    });
    maintenanceService.createDue.mockResolvedValue({
      _id: 'due-1',
      month: '2026-05',
      amountDue: 2500,
      userId: { name: 'Rina Shah' }
    });

    const result = await ragService.answerQuestion(
      'Create maintenance due for rina@test.com month 2026-05 amount 2500 due date 2026-05-31',
      {
        _id: 'admin-1',
        role: 'admin',
        societyId: 'society-1'
      }
    );

    expect(maintenanceService.createDue).toHaveBeenCalledWith({
      userId: 'resident-1',
      month: '2026-05',
      amountDue: 2500,
      dueDate: '2026-05-31'
    });
    expect(result.action).toEqual({ type: 'maintenance', success: true, id: 'due-1' });
  });

  it('asks for missing maintenance fields instead of guessing', async () => {
    const result = await ragService.answerQuestion('Create maintenance due amount 2500', {
      _id: 'admin-1',
      role: 'admin',
      societyId: 'society-1'
    });

    expect(maintenanceService.createDue).not.toHaveBeenCalled();
    expect(result.action.type).toBe('maintenance');
    expect(result.action.success).toBe(false);
    expect(result.answer).toContain('resident userId, email, or flat number');
  });

  it('adds a resident from a natural language RAG request', async () => {
    wingRepository.findBySociety.mockResolvedValue([{ _id: 'wing-d', name: 'D' }]);
    userService.registerResident.mockResolvedValue({
      _id: 'resident-1',
      name: 'Rina Shah',
      email: 'rina@test.com'
    });

    const result = await ragService.answerQuestion(
      'Add resident name: Rina Shah, email: rina@test.com, password: pass1234, phone: 9876543210, flat: D-404, wing D',
      {
        _id: 'admin-1',
        role: 'admin',
        societyId: 'society-1'
      }
    );

    expect(userService.registerResident).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'admin-1' }),
      expect.objectContaining({
        name: 'Rina Shah',
        email: 'rina@test.com',
        password: 'pass1234',
        phone: '9876543210',
        flatNumber: 'D-404',
        wingId: 'wing-d'
      })
    );
    expect(result.action).toEqual({ type: 'resident', success: true, id: 'resident-1' });
  });

  it('updates profile from a natural language RAG request', async () => {
    userService.updateProfile.mockResolvedValue({
      _id: 'resident-1',
      name: 'Manoj',
      phone: '9876543210',
      flatNumber: 'D-404'
    });

    const result = await ragService.answerQuestion('Update my profile phone: 9876543210, flat: D-404', {
      _id: 'resident-1',
      role: 'resident',
      wingStatus: 'approved'
    });

    expect(userService.updateProfile).toHaveBeenCalledWith('resident-1', {
      phone: '9876543210',
      flatNumber: 'D-404'
    });
    expect(result.action).toEqual({ type: 'profile', success: true, id: 'resident-1' });
  });
});
