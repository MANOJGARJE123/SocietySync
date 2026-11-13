const db = require('../config/db');

const COLS = `id,name,email,role,phone,flat_number,society_id,wing_id,requested_wing_id,wing_status,created_at,updated_at`;

const map = (row, { includePassword } = {}) => {
  if (!row) return null;
  const u = {
    _id: row.id, id: row.id, name: row.name, email: row.email, role: row.role,
    phone: row.phone ?? undefined, flatNumber: row.flat_number ?? undefined,
    societyId: row.society_id ?? undefined, wingId: row.wing_id ?? undefined,
    requestedWingId: row.requested_wing_id ?? undefined, wingStatus: row.wing_status ?? undefined,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
  if (includePassword) u.password = row.password;
  return u;
};

const userRepository = {
  async create(p) {
    const r = await db.query(
      `INSERT INTO users (name,email,password,role,phone,flat_number,society_id,wing_id,requested_wing_id,wing_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id,name,email,password,role,phone,flat_number,society_id,wing_id,requested_wing_id,wing_status,created_at,updated_at`,
      [p.name, String(p.email).toLowerCase(), p.password, p.role||'resident',
       p.phone||null, p.flatNumber||null, p.societyId||null, p.wingId||null, p.requestedWingId||null, p.wingStatus||'none']
    );
    return map(r.rows[0]);
  },
  async findByEmail(email, opts={}) {
    const r = await db.query(
      `SELECT id,name,email,password,role,phone,flat_number,society_id,wing_id,requested_wing_id,wing_status,created_at,updated_at
       FROM users WHERE email=$1 LIMIT 1`, [String(email).toLowerCase().trim()]
    );
    return map(r.rows[0], opts);
  },
  async findByPhone(phone, opts={}) {
    const r = await db.query(`SELECT ${COLS} FROM users WHERE phone=$1 LIMIT 1`, [phone]);
    return map(r.rows[0], opts);
  },
  async findById(id, opts={}) {
    const r = await db.query(
      `SELECT id,name,email,password,role,phone,flat_number,society_id,wing_id,requested_wing_id,wing_status,created_at,updated_at
       FROM users WHERE id=$1 LIMIT 1`, [id]
    );
    return map(r.rows[0], opts);
  },
  async findAll() {
    const r = await db.query(`SELECT ${COLS} FROM users ORDER BY created_at DESC`);
    return r.rows.map(row => map(row));
  },
  async findBySociety(societyId) {
    const r = await db.query(`SELECT ${COLS} FROM users WHERE society_id=$1 ORDER BY created_at DESC`, [societyId]);
    return r.rows.map(row => map(row));
  },
  async findPendingByWing(wingId) {
    const r = await db.query(
      `SELECT ${COLS} FROM users WHERE requested_wing_id=$1 AND wing_status='pending' ORDER BY created_at ASC`, [wingId]
    );
    return r.rows.map(row => map(row));
  },
  async findApprovedByWing(wingId) {
    const r = await db.query(
      `SELECT ${COLS} FROM users WHERE wing_id=$1 AND wing_status='approved' ORDER BY created_at ASC`, [wingId]
    );
    return r.rows.map(row => map(row));
  },
  async updateById(id, payload) {
    const allowed = {
      name: payload.name, role: payload.role, phone: payload.phone,
      flat_number: payload.flatNumber, society_id: payload.societyId,
      wing_id: payload.wingId, requested_wing_id: payload.requestedWingId,
      wing_status: payload.wingStatus,
      ...(payload.password !== undefined ? { password: payload.password } : {}),
    };
    const fields=[], values=[];
    let i=1;
    for (const [k,v] of Object.entries(allowed)) {
      if (v !== undefined) { fields.push(`${k}=$${i++}`); values.push(v); }
    }
    if (!fields.length) return null;
    values.push(id);
    const r = await db.query(
      `UPDATE users SET ${fields.join(',')},updated_at=now() WHERE id=$${i} RETURNING ${COLS}`, values
    );
    return map(r.rows[0]);
  },
  async deleteById(id) {
    await db.query('DELETE FROM users WHERE id=$1', [id]);
    return true;
  },
  async countAllUsers() {
    const r = await db.query('SELECT COUNT(*)::int as count FROM users');
    return r.rows[0]?.count ?? 0;
  },
  async countBySociety(societyId) {
    const r = await db.query('SELECT COUNT(*)::int as count FROM users WHERE society_id=$1', [societyId]);
    return r.rows[0]?.count ?? 0;
  },
  async countAdminsExcluding(userId, societyId) {
    const where = ["role='admin'", 'id<>$1'];
    const params = [userId];
    if (societyId) { params.push(societyId); where.push(`society_id=$${params.length}`); }
    else where.push('society_id IS NULL');
    const r = await db.query(`SELECT COUNT(*)::int as count FROM users WHERE ${where.join(' AND ')}`, params);
    return r.rows[0]?.count ?? 0;
  },
};

module.exports = userRepository;
