const db = require('../config/db');

const map = (row) => {
  if (!row) return null;
  return {
    _id: row.id, id: row.id, title: row.title, content: row.content,
    societyId: row.society_id ?? undefined, wingId: row.wing_id ?? undefined,
    expiryDays: row.expiry_days, expiresAt: row.expires_at,
    createdAt: row.created_at, updatedAt: row.updated_at,
    createdBy: row.created_by ? {
      _id: row.created_by, id: row.created_by,
      name: row.created_by_name, email: row.created_by_email, role: row.created_by_role,
    } : undefined,
  };
};

const JOIN = `
  SELECT n.id,n.title,n.content,n.created_by,n.society_id,n.wing_id,n.expiry_days,n.expires_at,n.created_at,n.updated_at,
         u.name as created_by_name,u.email as created_by_email,u.role as created_by_role
  FROM notices n JOIN users u ON u.id=n.created_by`;

const noticeRepository = {
  async create({ title, content, createdBy, expiryDays, expiresAt, societyId, wingId }) {
    const r = await db.query(
      `INSERT INTO notices (title,content,created_by,society_id,wing_id,expiry_days,expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [title, content, createdBy, societyId||null, wingId||null, expiryDays, expiresAt]
    );
    const id = r.rows[0]?.id;
    if (!id) return null;
    const full = await db.query(`${JOIN} WHERE n.id=$1`, [id]);
    return map(full.rows[0]);
  },
  async findById(id) {
    const r = await db.query(`${JOIN} WHERE n.id=$1 LIMIT 1`, [id]);
    return map(r.rows[0]);
  },
  async findForUser(user) {
    const params = [];
    let where = 'n.expires_at > now()';
    if (user?.role === 'admin' || user?.role === 'super_admin') {
      if (user.societyId) { params.push(user.societyId); where += ` AND n.society_id=$${params.length}`; }
    } else {
      params.push(user?.societyId); params.push(user?.wingId);
      where += ` AND n.society_id=$${params.length-1} AND (n.wing_id IS NULL OR n.wing_id=$${params.length})`;
    }
    const r = await db.query(`${JOIN} WHERE (${where}) ORDER BY n.created_at DESC`, params);
    return r.rows.map(map);
  },
  async updateById(id, payload) {
    const allowed = {
      title: payload.title, content: payload.content,
      expiry_days: payload.expiryDays, expires_at: payload.expiresAt,
    };
    const fields=[], values=[];
    let i=1;
    for (const [k,v] of Object.entries(allowed)) {
      if (v !== undefined) { fields.push(`${k}=$${i++}`); values.push(v); }
    }
    if (!fields.length) return null;
    values.push(id);
    await db.query(`UPDATE notices SET ${fields.join(',')},updated_at=now() WHERE id=$${i}`, values);
    const full = await db.query(`${JOIN} WHERE n.id=$1`, [id]);
    return map(full.rows[0]);
  },
  async deleteById(id, societyId) {
    const r = await db.query(
      `DELETE FROM notices WHERE id=$1 ${societyId ? 'AND society_id=$2' : ''} RETURNING id`,
      societyId ? [id, societyId] : [id]
    );
    return !!r.rows[0];
  },
};

module.exports = noticeRepository;
