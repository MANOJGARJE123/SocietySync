const db = require('../config/db');

const SELECT_COMPLAINT = `
  SELECT c.id,c.title,c.description,c.image_url,c.status,c.assigned_to,c.created_by,c.society_id,
         c.resolved_at,c.created_at,c.updated_at,
         u.name as created_by_name,u.email as created_by_email,u.flat_number as created_by_flat_number,
         u.wing_id as created_by_wing_id,u.society_id as created_by_society_id
  FROM complaints c JOIN users u ON u.id=c.created_by`;

const map = (row) => {
  if (!row) return null;
  return {
    _id: row.id, id: row.id, title: row.title, description: row.description,
    imageUrl: row.image_url ?? undefined, status: row.status,
    assignedTo: row.assigned_to ?? undefined, societyId: row.society_id ?? undefined,
    resolvedAt: row.resolved_at, createdAt: row.created_at, updatedAt: row.updated_at,
    createdBy: row.created_by ? {
      _id: row.created_by, id: row.created_by, name: row.created_by_name,
      email: row.created_by_email, flatNumber: row.created_by_flat_number,
      wingId: row.created_by_wing_id ?? undefined, societyId: row.created_by_society_id ?? undefined,
    } : undefined,
  };
};

const complaintRepository = {
  async create({ title, description, createdBy, imageUrl, societyId }) {
    const r = await db.query(
      `INSERT INTO complaints (title,description,image_url,created_by,society_id) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [title, description, imageUrl||null, createdBy, societyId||null]
    );
    const id = r.rows[0]?.id;
    if (!id) return null;
    const full = await db.query(`${SELECT_COMPLAINT} WHERE c.id=$1`, [id]);
    return map(full.rows[0]);
  },
  async findById(id) {
    const r = await db.query(`${SELECT_COMPLAINT} WHERE c.id=$1 LIMIT 1`, [id]);
    return map(r.rows[0]);
  },
  // FIX: filter by society_id to prevent cross-society leaks
  async findBySociety(societyId) {
    const r = await db.query(`${SELECT_COMPLAINT} WHERE c.society_id=$1 ORDER BY c.created_at DESC`, [societyId]);
    return r.rows.map(map);
  },
  async findByWingId(wingId) {
    const r = await db.query(
      `${SELECT_COMPLAINT} WHERE u.wing_id=$1 AND u.wing_status='approved' ORDER BY c.created_at DESC`, [wingId]
    );
    return r.rows.map(map);
  },
  async findByUserId(userId) {
    const r = await db.query(`${SELECT_COMPLAINT} WHERE c.created_by=$1 ORDER BY c.created_at DESC`, [userId]);
    return r.rows.map(map);
  },
  async updateById(id, payload) {
    const allowed = {
      status: payload.status,
      assigned_to: payload.assignedTo,
      resolved_at: payload.resolvedAt,
      title: payload.title,
      description: payload.description,
    };
    const fields=[], values=[];
    let i=1;
    for (const [k,v] of Object.entries(allowed)) {
      if (v !== undefined) { fields.push(`${k}=$${i++}`); values.push(v); }
    }
    if (!fields.length) return null;
    values.push(id);
    await db.query(`UPDATE complaints SET ${fields.join(',')},updated_at=now() WHERE id=$${i}`, values);
    const full = await db.query(`${SELECT_COMPLAINT} WHERE c.id=$1`, [id]);
    return map(full.rows[0]);
  },
  async deleteById(id) {
    await db.query('DELETE FROM complaints WHERE id=$1', [id]);
    return true;
  },
};

module.exports = complaintRepository;
