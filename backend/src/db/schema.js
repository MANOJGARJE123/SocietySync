const ensureSchema = async (pool) => {
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');

  // Users
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      email text NOT NULL UNIQUE,
      password text NOT NULL,
      role text NOT NULL DEFAULT 'resident' CHECK (role IN ('super_admin','admin','chairman','resident')),
      phone text,
      flat_number text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  // Societies
  await pool.query(`
    CREATE TABLE IF NOT EXISTS societies (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL UNIQUE,
      created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  // Wings
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      society_id uuid NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
      chairman_id uuid REFERENCES users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT uniq_wing_name_per_society UNIQUE (society_id, name),
      CONSTRAINT uniq_wing_chairman UNIQUE (chairman_id)
    );
  `);

  // Add user relation columns
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS society_id uuid REFERENCES societies(id) ON DELETE SET NULL;');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS wing_id uuid REFERENCES wings(id) ON DELETE SET NULL;');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS requested_wing_id uuid REFERENCES wings(id) ON DELETE SET NULL;');
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS wing_status text NOT NULL DEFAULT 'none';");
  await pool.query('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_wing_status_check;');
  await pool.query("ALTER TABLE users ADD CONSTRAINT users_wing_status_check CHECK (wing_status IN ('none','pending','approved','rejected'));");
  await pool.query("UPDATE users SET role='resident' WHERE role='member';");
  await pool.query('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;');
  await pool.query("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('super_admin','admin','chairman','resident'));");

  // Notices (with char length constraints)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notices (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title text NOT NULL,
      content text NOT NULL,
      created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      society_id uuid REFERENCES societies(id) ON DELETE CASCADE,
      wing_id uuid REFERENCES wings(id) ON DELETE SET NULL,
      expiry_days int NOT NULL DEFAULT 7 CHECK (expiry_days >= 1 AND expiry_days <= 365),
      expires_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await pool.query('ALTER TABLE notices ADD COLUMN IF NOT EXISTS society_id uuid REFERENCES societies(id) ON DELETE CASCADE;');
  await pool.query('ALTER TABLE notices ADD COLUMN IF NOT EXISTS wing_id uuid REFERENCES wings(id) ON DELETE SET NULL;');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_notices_expires_at ON notices (expires_at);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_notices_society_id ON notices (society_id);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_notices_created_at ON notices (created_at DESC);');

  // Complaints — added assigned_to + 4-state status + society_id snapshot
  await pool.query(`
    CREATE TABLE IF NOT EXISTS complaints (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title text NOT NULL,
      description text NOT NULL,
      image_url text,
      status text NOT NULL DEFAULT 'pending',
      assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
      created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      society_id uuid REFERENCES societies(id) ON DELETE SET NULL,
      resolved_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await pool.query('ALTER TABLE complaints ADD COLUMN IF NOT EXISTS image_url text;');
  await pool.query('ALTER TABLE complaints ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES users(id) ON DELETE SET NULL;');
  await pool.query('ALTER TABLE complaints ADD COLUMN IF NOT EXISTS society_id uuid REFERENCES societies(id) ON DELETE SET NULL;');
  await pool.query('ALTER TABLE complaints DROP CONSTRAINT IF EXISTS complaints_status_check;');
  await pool.query("ALTER TABLE complaints ADD CONSTRAINT complaints_status_check CHECK (status IN ('pending','in_progress','resolved','rejected'));");
  await pool.query('CREATE INDEX IF NOT EXISTS idx_complaints_created_at ON complaints (created_at DESC);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_complaints_society_id ON complaints (society_id);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints (status);');

  // Maintenance — add month format check + overpayment guard + society_id
  await pool.query(`
    CREATE TABLE IF NOT EXISTS maintenance (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      society_id uuid REFERENCES societies(id) ON DELETE SET NULL,
      month text NOT NULL,
      amount_due numeric(12,2) NOT NULL CHECK (amount_due >= 0),
      paid_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
      due_date timestamptz NOT NULL,
      status text NOT NULL DEFAULT 'due' CHECK (status IN ('due','partial','paid')),
      payment_records jsonb NOT NULL DEFAULT '[]'::jsonb,
      last_reminder_at timestamptz,
      reminder_count int NOT NULL DEFAULT 0 CHECK (reminder_count >= 0),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT uniq_maintenance_user_month UNIQUE (user_id, month)
    );
  `);
  await pool.query('ALTER TABLE maintenance ADD COLUMN IF NOT EXISTS society_id uuid REFERENCES societies(id) ON DELETE SET NULL;');
  await pool.query('ALTER TABLE maintenance DROP CONSTRAINT IF EXISTS chk_maintenance_month_format;');
  await pool.query("ALTER TABLE maintenance ADD CONSTRAINT chk_maintenance_month_format CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');");
  await pool.query('ALTER TABLE maintenance DROP CONSTRAINT IF EXISTS chk_paid_lte_due;');
  await pool.query('ALTER TABLE maintenance ADD CONSTRAINT chk_paid_lte_due CHECK (paid_amount <= amount_due);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_maintenance_due_date ON maintenance (due_date ASC);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_maintenance_user_id ON maintenance (user_id);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_maintenance_society_id ON maintenance (society_id);');

  // RAG chunks
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rag_chunks (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      text text NOT NULL,
      embedding jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_rag_chunks_created_at ON rag_chunks (created_at DESC);');

  // Audit log
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
      action text NOT NULL,
      entity_type text NOT NULL,
      entity_id text,
      meta jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs (actor_id);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs (created_at DESC);');

  // Common indexes
  await pool.query('CREATE INDEX IF NOT EXISTS idx_societies_created_by ON societies (created_by);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_wings_society_id ON wings (society_id);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_users_society_id ON users (society_id);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_users_wing_id ON users (wing_id);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_users_requested_wing_id ON users (requested_wing_id);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_users_phone ON users (phone);');
};

module.exports = { ensureSchema };
