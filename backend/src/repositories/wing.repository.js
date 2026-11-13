const db = require('../config/db');

const map = (row) => {
  if (!row) return null;
  return { _id: row.id, id: row.id, name: row.name, societyId: row.society_id, chairmanId: row.chairman_id, createdAt: row.created_at, updatedAt: row.updated_at };
};

const wingRepository = {
  async findById(id) {
    const r = await db.query('SELECT id,name,society_id,chairman_id,created_at,updated_at FROM wings WHERE id=$1 LIMIT 1', [id]);
    return map(r.rows[0]);
  },
  async findBySociety(societyId) {
    const r = await db.query('SELECT id,name,society_id,chairman_id,created_at,updated_at FROM wings WHERE society_id=$1 ORDER BY name ASC', [societyId]);
    return r.rows.map(map);
  },
  async findByChairman(chairmanId) {
    const r = await db.query('SELECT id,name,society_id,chairman_id,created_at,updated_at FROM wings WHERE chairman_id=$1 LIMIT 1', [chairmanId]);
    return map(r.rows[0]);
  },
  async create({ name, societyId }) {
    const r = await db.query('INSERT INTO wings (name,society_id) VALUES ($1,$2) RETURNING id,name,society_id,chairman_id,created_at,updated_at', [name, societyId]);
    return map(r.rows[0]);
  },
  async createMany(names, societyId) {
    const results = [];
    for (const name of names) {
      try {
        const r = await db.query('INSERT INTO wings (name,society_id) VALUES ($1,$2) ON CONFLICT (society_id,name) DO NOTHING RETURNING id,name,society_id,chairman_id,created_at,updated_at', [name, societyId]);
        if (r.rows[0]) results.push(map(r.rows[0]));
      } catch {}
    }
    return results;
  },
  async updateById(id, payload) {
    const allowed = { chairman_id: payload.chairmanId, name: payload.name };
    const fields=[], values=[];
    let i=1;
    for (const [k,v] of Object.entries(allowed)) {
      if (v !== undefined) { fields.push(`${k}=$${i++}`); values.push(v); }
    }
    if (!fields.length) return null;
    values.push(id);
    const r = await db.query(`UPDATE wings SET ${fields.join(',')},updated_at=now() WHERE id=$${i} RETURNING id,name,society_id,chairman_id,created_at,updated_at`, values);
    return map(r.rows[0]);
  },
  async clearChairmanByUserId(chairmanId) {
    await db.query('UPDATE wings SET chairman_id=NULL WHERE chairman_id=$1', [chairmanId]);
  },
  async deleteBySociety(societyId) {
    await db.query('DELETE FROM wings WHERE society_id=$1', [societyId]);
  },
};
module.exports = wingRepository;
