const db = require('../config/db');
const auditLog = async ({ actorId, action, entityType, entityId, meta } = {}) => {
  try {
    await db.query(
      `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, meta) VALUES ($1,$2,$3,$4,$5)`,
      [actorId || null, action, entityType, entityId ? String(entityId) : null, meta ? JSON.stringify(meta) : null]
    );
  } catch (e) { console.error('[AuditLog]', e.message); }
};
module.exports = { auditLog };
