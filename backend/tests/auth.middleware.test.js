require.cache[require.resolve('../src/repositories/user.repository')] = {
  exports: {
    findById: vi.fn()
  }
};

const { authorize, requireApprovedResident } = require('../src/middlewares/auth.middleware');

describe('authorize middleware', () => {
  it('allows listed roles', () => {
    const req = { user: { role: 'admin' } };
    const next = vi.fn();

    authorize('admin', 'chairman')(req, {}, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('rejects unlisted roles', () => {
    const req = { user: { role: 'resident' } };
    const next = vi.fn();

    authorize('admin', 'chairman')(req, {}, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        message: 'You are not allowed to perform this action'
      })
    );
  });
});

describe('requireApprovedResident middleware', () => {
  it('allows approved residents', () => {
    const req = { user: { role: 'resident', wingStatus: 'approved' } };
    const next = vi.fn();

    requireApprovedResident(req, {}, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('allows non-resident roles', () => {
    const req = { user: { role: 'chairman', wingStatus: 'none' } };
    const next = vi.fn();

    requireApprovedResident(req, {}, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('blocks pending residents from protected app features', () => {
    const req = { user: { role: 'resident', wingStatus: 'pending' } };
    const next = vi.fn();

    requireApprovedResident(req, {}, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        message: 'Your wing request is pending approval'
      })
    );
  });
});
