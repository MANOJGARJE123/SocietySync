const db = require('../config/db');

const mapRow = (row) => {
  if (!row) return null;
  const pr = Array.isArray(row.payment_records) ? row.payment_records
    : (row.payment_records ? JSON.parse(row.payment_records) : []);
  return {
    _id: row.id, id: row.id, month: row.month, societyId: row.society_id ?? undefined,
    amountDue: Number(row.amount_due), paidAmount: Number(row.paid_amount),
    dueDate: row.due_date, status: row.status, paymentRecords: pr,
    lastReminderAt: row.last_reminder_at, reminderCount: row.reminder_count,
    createdAt: row.created_at, updatedAt: row.updated_at,
    userId: row.user_id ? {
      _id: row.user_id, id: row.user_id, name: row.user_name,
      email: row.user_email, flatNumber: row.user_flat_number, societyId: row.user_society_id,
    } : row.user_id,
  };
};

const JOIN = `
  SELECT m.id,m.user_id,m.month,m.amount_due,m.paid_amount,m.due_date,m.status,
         m.payment_records,m.last_reminder_at,m.reminder_count,m.created_at,m.updated_at,m.society_id,
         u.name as user_name,u.email as user_email,u.flat_number as user_flat_number,u.society_id as user_society_id
  FROM maintenance m JOIN users u ON u.id=m.user_id`;

const findByIdFull = async (id) => {
  const r = await db.query(`${JOIN} WHERE m.id=$1 LIMIT 1`, [id]);
  return mapRow(r.rows[0]);
};

const maintenanceRepository = {
  async create({ userId, month, amountDue, dueDate, societyId }) {
    const r = await db.query(
      `INSERT INTO maintenance (user_id,month,amount_due,due_date,society_id) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [userId, month, amountDue, dueDate, societyId||null]
    );
    return findByIdFull(r.rows[0]?.id);
  },
  async findById(id) { return findByIdFull(id); },
  // FIX: filter by society_id
  async findBySociety(societyId) {
    const r = await db.query(`${JOIN} WHERE m.society_id=$1 ORDER BY m.due_date ASC`, [societyId]);
    return r.rows.map(mapRow);
  },
  async findByUserId(userId) {
    const r = await db.query(`${JOIN} WHERE m.user_id=$1 ORDER BY m.due_date ASC`, [userId]);
    return r.rows.map(mapRow);
  },
  async updateById(id, payload) {
    const allowed = {
      paid_amount: payload.paidAmount,
      status: payload.status,
      payment_records: payload.paymentRecords ? JSON.stringify(payload.paymentRecords) : undefined,
      last_reminder_at: payload.lastReminderAt,
      reminder_count: payload.reminderCount,
    };
    const fields=[], values=[];
    let i=1;
    for (const [k,v] of Object.entries(allowed)) {
      if (v !== undefined) { fields.push(`${k}=$${i++}`); values.push(v); }
    }
    if (!fields.length) return null;
    values.push(id);
    await db.query(`UPDATE maintenance SET ${fields.join(',')},updated_at=now() WHERE id=$${i}`, values);
    return findByIdFull(id);
  },
};

module.exports = maintenanceRepository;
