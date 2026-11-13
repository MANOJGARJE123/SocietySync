const fetchClient = require('../src/utils/fetchClient');

const base =
  process.env.E2E_BASE_URL || `http://127.0.0.1:${process.env.PORT || process.env.BACKEND_PORT || 5050}`;
const runId = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
const results = [];

const emails = {
  admin: `qa-admin-${runId}@test.com`,
  chairman: `qa-chairman-${runId}@test.com`,
  resident: `qa-resident-${runId}@test.com`,
  rejectedResident: `qa-rejected-${runId}@test.com`
};

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
}

async function request(method, path, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetchClient(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await res.text();
  let data;

  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return { status: res.status, data };
}

async function expectStatus(name, expected, promise) {
  const response = await promise;
  const ok = response.status === expected;
  record(name, ok, `expected=${expected} actual=${response.status}`);
  return response;
}

async function registerUser(payload) {
  const response = await request('POST', '/api/auth/register', { body: payload });
  return {
    response,
    token: response.data?.data?.token,
    user: response.data?.data?.user
  };
}

async function run() {
  let adminToken;
  let chairmanToken;
  let residentToken;
  let rejectedResidentId;
  let societyId;
  let wingAId;
  let residentId;
  let complaintId;
  let dueId;

  try {
    await expectStatus('health endpoint', 200, request('GET', '/health'));

    const admin = await registerUser({
      name: 'QA Admin',
      email: emails.admin,
      password: 'password123',
      role: 'admin',
      phone: `900${String(runId).slice(-7)}`,
      flatNumber: 'A-001'
    });
    adminToken = admin.token;
    record('register admin', admin.response.status === 201 && !!adminToken, `status=${admin.response.status}`);

    const chairman = await registerUser({
      name: 'QA Chairman',
      email: emails.chairman,
      password: 'password123',
      role: 'chairman',
      phone: `901${String(runId).slice(-7)}`,
      flatNumber: 'A-101'
    });
    chairmanToken = chairman.token;
    record(
      'register chairman',
      chairman.response.status === 201 && !!chairman.user?.id,
      `status=${chairman.response.status}`
    );

    await expectStatus(
      'duplicate email blocked',
      409,
      request('POST', '/api/auth/register', {
        body: {
          name: 'Duplicate Admin',
          email: emails.admin,
          password: 'password123',
          role: 'admin'
        }
      })
    );

    await expectStatus(
      'invalid login blocked',
      401,
      request('POST', '/api/auth/login', {
        body: {
          email: emails.admin,
          password: 'wrong-password'
        }
      })
    );

    const societyResponse = await expectStatus(
      'admin creates society with wings',
      201,
      request('POST', '/api/societies', {
        token: adminToken,
        body: {
          name: `QA Society ${runId}`,
          wings: ['A', 'B']
        }
      })
    );
    societyId = societyResponse.data?.data?._id;
    wingAId = societyResponse.data?.data?.wings?.[0]?._id;
    record('society and wing ids returned', !!societyId && !!wingAId, `society=${societyId} wing=${wingAId}`);

    await expectStatus('public societies listed', 200, request('GET', '/api/societies'));
    await expectStatus('public wings listed by society', 200, request('GET', `/api/wings/society/${societyId}`));

    await expectStatus(
      'admin assigns chairman to wing',
      200,
      request('PATCH', `/api/wings/${wingAId}/assign-chairman`, {
        token: adminToken,
        body: { chairmanId: chairman.user.id }
      })
    );

    const chairmanProfile = await expectStatus(
      'chairman profile has assigned wing',
      200,
      request('GET', '/api/users/profile', { token: chairmanToken })
    );
    record(
      'chairman society/wing verified',
      chairmanProfile.data?.data?.societyId === societyId && chairmanProfile.data?.data?.wingId === wingAId,
      `society=${chairmanProfile.data?.data?.societyId} wing=${chairmanProfile.data?.data?.wingId}`
    );

    const resident = await registerUser({
      name: 'QA Pending Resident',
      email: emails.resident,
      password: 'password123',
      role: 'resident',
      phone: `902${String(runId).slice(-7)}`,
      flatNumber: 'A-202',
      wingId: wingAId
    });
    residentToken = resident.token;
    residentId = resident.user?.id;
    record(
      'resident registers pending wing approval',
      resident.response.status === 201 &&
        resident.user?.societyId === societyId &&
        resident.user?.requestedWingId === wingAId &&
        resident.user?.wingStatus === 'pending' &&
        !resident.user?.wingId,
      `status=${resident.response.status} wingStatus=${resident.user?.wingStatus}`
    );

    await expectStatus(
      'pending resident app feature blocked',
      403,
      request('GET', '/api/notices', { token: residentToken })
    );

    const pendingRequests = await expectStatus(
      'chairman lists pending wing requests',
      200,
      request('GET', `/api/wings/${wingAId}/requests`, { token: chairmanToken })
    );
    record(
      'pending resident appears in wing requests',
      Array.isArray(pendingRequests.data?.data) &&
        pendingRequests.data.data.some((item) => item._id === residentId),
      `resident=${residentId}`
    );

    await expectStatus(
      'chairman approves resident',
      200,
      request('PATCH', `/api/wings/${wingAId}/requests/${residentId}/approve`, {
        token: chairmanToken
      })
    );

    const approvedProfile = await expectStatus(
      'approved resident profile loads',
      200,
      request('GET', '/api/users/profile', { token: residentToken })
    );
    record(
      'resident approval verified',
      approvedProfile.data?.data?.wingId === wingAId &&
        approvedProfile.data?.data?.wingStatus === 'approved' &&
        !approvedProfile.data?.data?.requestedWingId,
      `wing=${approvedProfile.data?.data?.wingId} status=${approvedProfile.data?.data?.wingStatus}`
    );

    const rejected = await registerUser({
      name: 'QA Rejected Resident',
      email: emails.rejectedResident,
      password: 'password123',
      role: 'resident',
      phone: `903${String(runId).slice(-7)}`,
      flatNumber: 'A-303',
      wingId: wingAId
    });
    rejectedResidentId = rejected.user?.id;
    await expectStatus(
      'chairman rejects resident',
      200,
      request('PATCH', `/api/wings/${wingAId}/requests/${rejectedResidentId}/reject`, {
        token: chairmanToken
      })
    );

    await expectStatus(
      'resident cannot list all users',
      403,
      request('GET', '/api/users', { token: residentToken })
    );

    await expectStatus(
      'admin creates notice',
      201,
      request('POST', '/api/notices', {
        token: adminToken,
        body: { title: `QA Notice ${runId}`, content: 'QA notice content', expiryDays: 7 }
      })
    );
    await expectStatus('approved resident lists notices', 200, request('GET', '/api/notices', { token: residentToken }));

    const complaintResponse = await expectStatus(
      'approved resident creates complaint',
      201,
      request('POST', '/api/complaints', {
        token: residentToken,
        body: { title: `QA Complaint ${runId}`, description: 'QA complaint content' }
      })
    );
    complaintId = complaintResponse.data?.data?._id;
    await expectStatus('chairman lists wing complaints', 200, request('GET', '/api/complaints', { token: chairmanToken }));
    await expectStatus(
      'chairman resolves wing complaint',
      200,
      request('PATCH', `/api/complaints/${complaintId}/status`, {
        token: chairmanToken,
        body: { status: 'resolved' }
      })
    );

    const dueResponse = await expectStatus(
      'admin creates maintenance due',
      201,
      request('POST', '/api/maintenance/dues', {
        token: adminToken,
        body: {
          userId: residentId,
          month: `QA-${runId}`,
          amountDue: 2500,
          dueDate: '2026-12-31T00:00:00.000Z'
        }
      })
    );
    dueId = dueResponse.data?.data?._id;
    await expectStatus('resident lists own maintenance', 200, request('GET', '/api/maintenance/my', { token: residentToken }));
    await expectStatus(
      'resident pays own maintenance',
      200,
      request('POST', `/api/maintenance/${dueId}/pay`, {
        token: residentToken,
        body: { amount: 500, method: 'upi', reference: `QA-${runId}` }
      })
    );
  } catch (error) {
    record('e2e runner internal error', false, error.stack || error.message);
  }

  const passed = results.filter((item) => item.ok).length;
  const failed = results.length - passed;

  console.log('E2E_ROLE_TEST_RESULTS_START');
  for (const item of results) {
    console.log(`${item.ok ? 'PASS' : 'FAIL'} | ${item.name} | ${item.detail}`);
  }
  console.log(`SUMMARY | total=${results.length} passed=${passed} failed=${failed}`);
  console.log(`TEST_USERS | ${JSON.stringify(emails)}`);
  console.log('E2E_ROLE_TEST_RESULTS_END');

  if (failed > 0) {
    process.exitCode = 1;
  }
}

run();
