const db = require('../config/db');

const map = (row) => {
  if (!row) return null;
  return { _id: row.id, id: row.id, name: row.name, createdBy: row.created_by, createdAt: row.created_at, updatedAt: row.updated_at };
};

const societyRepository = {
  async findAll() {
    const r = await db.query('SELECT id,name,created_by,created_at,updated_at FROM societies ORDER BY name ASC');
    return r.rows.map(map);
  },
  async findById(id) {
    const r = await db.query('SELECT id,name,created_by,created_at,updated_at FROM societies WHERE id=$1 LIMIT 1', [id]);
    return map(r.rows[0]);
  },
  async findByAdmin(adminId) {
    const r = await db.query('SELECT id,name,created_by,created_at,updated_at FROM societies WHERE created_by=$1 LIMIT 1', [adminId]);
    return map(r.rows[0]);
  },
  async create({ name, createdBy }) {
    const r = await db.query('INSERT INTO societies (name,created_by) VALUES ($1,$2) RETURNING id,name,created_by,created_at,updated_at', [name, createdBy]);
    return map(r.rows[0]);
  },
  async updateById(id, { name }) {
    const r = await db.query('UPDATE societies SET name=$1,updated_at=now() WHERE id=$2 RETURNING id,name,created_by,created_at,updated_at', [name, id]);
    return map(r.rows[0]);
  },
  async deleteById(id) {
    await db.query('DELETE FROM societies WHERE id=$1', [id]);
    return true;
  },
};
module.exports = societyRepository;
