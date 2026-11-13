const fetchClient = require('../src/utils/fetchClient');

const base =
  process.env.SMOKE_BASE_URL || `http://127.0.0.1:${process.env.PORT || process.env.BACKEND_PORT || 5000}`;

const results = [];

function push(name, ok, detail) {
  results.push({ name, ok, detail });
}

async function request(method, path, { token, body, formData } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (formData) {
    payload = formData;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await fetchClient(`${base}${path}`, { method, headers, body: payload });
  const text = await res.text();
  let data;

  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return { status: res.status, data };
}

async function run() {
  let adminToken = '';
  let memberToken = '';
  let memberId = '';
  let adminId = '';
  let complaintId = '';
  let dueIdForMember = '';
  let dueIdForAdmin = '';

  try {
    {
      const r = await request('GET', '/health');
      push('GET /health', r.status === 200, `status=${r.status}`);
    }

    {
      const r = await request('POST', '/api/auth/register', {
        body: {
          name: 'Admin User',
          email: 'admin@test.com',
          password: 'password123',
          role: 'admin',
          flatNumber: 'A-101'
        }
      });
      const ok = r.status === 201 && r.data && r.data.data && r.data.data.token;
      if (ok) {
        adminToken = r.data.data.token;
        adminId = r.data.data.user.id;
      }
      push('POST /api/auth/register (admin)', r.status === 201 || r.status === 409, `status=${r.status}`);
    }

    {
      const r = await request('POST', '/api/auth/register', {
        body: {
          name: 'Member User',
          email: 'member@test.com',
          password: 'password123',
          role: 'member',
          flatNumber: 'B-202'
        }
      });
      const ok = r.status === 201 && r.data && r.data.data && r.data.data.token;
      if (ok) {
        memberToken = r.data.data.token;
        memberId = r.data.data.user.id;
      }
      push('POST /api/auth/register (member)', r.status === 201 || r.status === 409, `status=${r.status}`);
    }

    {
      const r = await request('POST', '/api/auth/login', {
        body: { email: 'admin@test.com', password: 'password123' }
      });
      const ok = r.status === 200 && r.data && r.data.data && r.data.data.token;
      if (ok) {
        adminToken = r.data.data.token;
        adminId = r.data.data.user.id;
      }
      push('POST /api/auth/login (admin)', !!ok, `status=${r.status}`);
    }

    {
      const r = await request('POST', '/api/auth/login', {
        body: { email: 'member@test.com', password: 'password123' }
      });
      const ok = r.status === 200 && r.data && r.data.data && r.data.data.token;
      if (ok) {
        memberToken = r.data.data.token;
        memberId = r.data.data.user.id;
      }
      push('POST /api/auth/login (member)', !!ok, `status=${r.status}`);
    }

    {
      const r = await request('GET', '/api/users', { token: adminToken });
      push('GET /api/users (admin)', r.status === 200, `status=${r.status}`);
    }

    {
      const r = await request('GET', '/api/users', { token: memberToken });
      push('GET /api/users (member forbidden)', r.status === 403, `status=${r.status}`);
    }

    {
      const r1 = await request('GET', '/api/users/profile', { token: memberToken });
      const r2 = await request('PATCH', '/api/users/profile', {
        token: memberToken,
        body: { phone: '9999999999' }
      });
      push('GET /api/users/profile', r1.status === 200, `status=${r1.status}`);
      push('PATCH /api/users/profile', r2.status === 200, `status=${r2.status}`);
    }

    {
      const r1 = await request('POST', '/api/notices', {
        token: adminToken,
        body: { title: 'Water Supply', content: 'Water supply shutdown tomorrow 10am-1pm.' }
      });
      const r2 = await request('GET', '/api/notices', { token: memberToken });
      push('POST /api/notices (admin)', r1.status === 201, `status=${r1.status}`);
      push('GET /api/notices (member)', r2.status === 200, `status=${r2.status}`);
    }

    {
      const r1 = await request('POST', '/api/complaints', {
        token: memberToken,
        body: { title: 'Lift Issue', description: 'Lift not working in B wing.' }
      });
      if (r1.status === 201) complaintId = r1.data.data._id;

      const r2 = await request('GET', '/api/complaints/my', { token: memberToken });
      const r3 = await request('GET', '/api/complaints', { token: adminToken });
      const r4 = await request('PATCH', `/api/complaints/${complaintId}/status`, {
        token: adminToken,
        body: { status: 'resolved' }
      });

      push('POST /api/complaints (member)', r1.status === 201, `status=${r1.status}`);
      push('GET /api/complaints/my (member)', r2.status === 200, `status=${r2.status}`);
      push('GET /api/complaints (admin)', r3.status === 200, `status=${r3.status}`);
      push('PATCH /api/complaints/:id/status (admin)', r4.status === 200, `status=${r4.status}`);
    }

    {
      const r1 = await request('POST', '/api/maintenance/dues', {
        token: adminToken,
        body: {
          userId: memberId,
          month: '2026-03',
          amountDue: 2500,
          dueDate: '2026-03-31T00:00:00.000Z'
        }
      });
      if (r1.status === 201) {
        dueIdForMember = r1.data.data._id;
      }

      const r2 = await request('GET', '/api/maintenance', { token: adminToken });
      if (!dueIdForMember && r2.status === 200 && Array.isArray(r2.data.data)) {
        const existingMemberDue = r2.data.data.find(
          (item) => item.userId && item.userId._id === memberId && item.month === '2026-03'
        );
        if (existingMemberDue) {
          dueIdForMember = existingMemberDue._id;
        }
      }

      const r3 = await request('GET', '/api/maintenance/my', { token: memberToken });
      const r4 = await request('POST', `/api/maintenance/${dueIdForMember}/pay`, {
        token: memberToken,
        body: { amount: 1000, method: 'upi', reference: 'TXN1001' }
      });

      const r5 = await request('POST', '/api/maintenance/dues', {
        token: adminToken,
        body: {
          userId: adminId,
          month: '2026-03',
          amountDue: 3000,
          dueDate: '2026-03-31T00:00:00.000Z'
        }
      });
      if (r5.status === 201) {
        dueIdForAdmin = r5.data.data._id;
      }

      if (!dueIdForAdmin && r2.status === 200 && Array.isArray(r2.data.data)) {
        const existingAdminDue = r2.data.data.find(
          (item) => item.userId && item.userId._id === adminId && item.month === '2026-03'
        );
        if (existingAdminDue) {
          dueIdForAdmin = existingAdminDue._id;
        }
      }

      const r6 = await request('POST', `/api/maintenance/${dueIdForAdmin}/pay`, {
        token: memberToken,
        body: { amount: 500, method: 'cash', reference: 'TRY-OTHER' }
      });

      push('POST /api/maintenance/dues (admin)', r1.status === 201 || r1.status === 409, `status=${r1.status}`);
      push('GET /api/maintenance (admin)', r2.status === 200, `status=${r2.status}`);
      push('GET /api/maintenance/my (member)', r3.status === 200, `status=${r3.status}`);
      push('POST /api/maintenance/:id/pay (member own due)', r4.status === 200, `status=${r4.status}`);
      push('POST /api/maintenance/:id/pay (member other due forbidden)', r6.status === 403, `status=${r6.status}`);
    }

    {
      const r1 = await request('POST', '/api/rag/query', {
        token: memberToken,
        body: { question: '' }
      });

      const r2 = await request('POST', '/api/rag/upload', {
        token: adminToken
      });

      const form = new FormData();
      form.append('file', new Blob(['not-pdf-content'], { type: 'text/plain' }), 'notes.txt');
      const r3 = await request('POST', '/api/rag/upload', {
        token: adminToken,
        formData: form
      });

      push('POST /api/rag/query (validation error path)', r1.status === 400, `status=${r1.status}`);
      push('POST /api/rag/upload (missing file path)', r2.status === 400, `status=${r2.status}`);
      push('POST /api/rag/upload (non-pdf blocked)', r3.status === 400, `status=${r3.status}`);
    }
  } catch (error) {
    push('Smoke runner internal error', false, error.message);
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;

  console.log('SMOKE_TEST_RESULTS_START');
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'} | ${r.name} | ${r.detail}`);
  }
  console.log(`SUMMARY | total=${results.length} passed=${passed} failed=${failed}`);
  console.log('SMOKE_TEST_RESULTS_END');
}

run();
