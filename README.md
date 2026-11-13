# Society Management System v2.0 — Production Ready

A full-stack society management platform for React Native (Expo) frontend + Node.js/Express/PostgreSQL backend.

## What's Fixed in v2.0

### 🔴 Critical Security Fixes
- **CRIT-01** Self-registration as `super_admin` — backend now forces `role='resident'` on all public registrations
- **CRIT-02** Admin→super_admin privilege escalation — removed from allowed roles list
- **CRIT-03** No rate limiting — added `express-rate-limit` (auth: 15 req/15min, global: 500 req/15min)
- **CRIT-04** Cross-society complaint data leak — `findBySociety()` filter enforced
- **CRIT-05** Cross-society maintenance data leak — `findBySociety()` filter enforced

### 🟠 High Fixes
- **HIGH-01** CORS wildcard `*` → explicit `ALLOWED_ORIGINS` whitelist
- **HIGH-02** Uploaded files served publicly → authenticated `/api/complaints/attachment/:filename` route
- **HIGH-03** MIME-type only file validation → enforced image MIME types on multer
- **HIGH-04** Overpayment not blocked → payment capped at `amountDue - paidAmount`
- **HIGH-05** Already-paid dues re-payable → guard added in `addPayment()`
- **HIGH-06** Notice edit/delete were frontend stubs → real backend PATCH/DELETE routes added
- **HIGH-07** Complaint edit/delete missing → backend routes + frontend UI added
- **HIGH-08** No delete user → `DELETE /users/:id` implemented with society guard
- **HIGH-09** `/users/all` exposed cross-society data → restricted to `super_admin` only
- **HIGH-10** No `helmet` → added with CSP and security headers
- **HIGH-11** `expo-image-picker` in backend deps → removed
- **HIGH-12** API keys and DB password committed → replaced with placeholder `.env` + `.gitignore`

### 🟡 Medium Fixes
- **MED-01** `month` format unvalidated → `YYYY-MM` regex enforced frontend + backend + DB constraint
- **MED-02** No content length limits → `char_length` constraints + JS validation added
- **MED-03** Duplicate wing join requests → blocked if already `pending` or `approved`
- **MED-04** Complaint status only 2 states → added `in_progress` + `rejected` states
- **MED-05** `/wings/society/:id` unauthenticated → `protect` middleware added
- **MED-06** `totalWings: 5` hardcoded → fetched from API via `getSocietyDetails()`
- **MED-07** `totalFlats: 50` hardcoded → replaced with real resident count from API
- **MED-08** Collection rate >100% possible → `Math.min(100, ...)` cap + correct formula
- **MED-09** System health score cosmetic → real formula based on complaints + collection rate

### 🔵 Low Fixes
- **LOW-01** Payment method unvalidated → enum: `online|cash|cheque|upi|neft|bank_transfer`
- **LOW-02** Society delete no confirmation → `Alert.alert()` with destructive confirmation
- **LOW-03** RegisterScreen shows admin/chairman role → removed, always `resident`
- **LOW-04** Error messages leaked DB internals in prod → `500` returns generic message in production
- **LOW-05** Mongo-style error codes in errorHandler → replaced with Postgres codes
- **LOW-06** Audit log table → added for role changes, payments, deletions

### ✨ New Features Added
- **Change Password** — `POST /api/auth/change-password` + ProfileScreen UI
- **Delete User** — `DELETE /api/users/:id` with society scoping + UsersScreen UI
- **Edit Complaint** — `PATCH /api/complaints/:id` + ComplaintsScreen modal
- **Delete Complaint** — `DELETE /api/complaints/:id` with ownership/admin check
- **Real Notice Edit** — `PATCH /api/notices/:id` with actual API call (not stub)
- **Real Notice Delete** — `DELETE /api/notices/:id` with actual API call (not stub)
- **Audit Logs** — All sensitive actions logged to `audit_logs` table

## Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Expo CLI (`npm install -g expo-cli`)

### Backend
```bash
cd backend
cp .env.example .env
# Edit .env with your values (DATABASE_URL, JWT_SECRET minimum)
npm install
npm run dev
```

### Frontend
```bash
cd frontend
npm install
# Set EXPO_PUBLIC_API_URL in your environment or edit src/constants/api.js
npx expo start
```

### Environment Variables (Backend)
| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | Min 32 chars, random string |
| `JWT_EXPIRES_IN` | ✅ | Token expiry e.g. `7d` |
| `ALLOWED_ORIGINS` | ✅ | Comma-separated allowed origins |
| `GEMINI_API_KEY` | Optional | For AI chat feature |
| `NODE_ENV` | Recommended | `production` in prod |

### Generate a secure JWT secret
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Architecture

```
backend/
├── src/
│   ├── app.js              # Express app, middleware, routes
│   ├── server.js           # Entry point
│   ├── config/             # env.js, db.js
│   ├── db/schema.js        # PostgreSQL schema (auto-applied on start)
│   ├── routes/             # Express routers
│   ├── controllers/        # Request/response handlers
│   ├── services/           # Business logic
│   ├── repositories/       # DB queries (parameterized SQL)
│   ├── middlewares/        # auth, asyncHandler, errorHandler
│   └── utils/              # AppError, jwt, validators, auditLog

frontend/
├── src/
│   ├── screens/            # All app screens
│   ├── components/         # Reusable UI components
│   ├── services/           # API client + service modules
│   ├── context/            # AuthContext
│   ├── constants/          # theme, api endpoints, app constants
│   ├── hooks/              # useResponsive
│   └── utils/              # error, validators, date, toast
```

## User Roles
| Role | Capabilities |
|------|-------------|
| `super_admin` | Full system access, can assign any role |
| `admin` | Manage own society: users, billing, notices, wings |
| `chairman` | Manage own wing: members, complaints, wing notices |
| `resident` | File complaints, view notices, pay dues |

## API Overview
| Method | Endpoint | Access |
|--------|----------|--------|
| POST | `/api/auth/register` | Public |
| POST | `/api/auth/login` | Public |
| POST | `/api/auth/change-password` | Authenticated |
| GET | `/api/users` | Admin+ |
| DELETE | `/api/users/:id` | Admin+ |
| GET | `/api/notices` | Authenticated |
| POST | `/api/notices` | Admin/Chairman |
| PATCH | `/api/notices/:id` | Admin/Chairman |
| DELETE | `/api/notices/:id` | Admin/Chairman |
| POST | `/api/complaints` | Resident+ |
| PATCH | `/api/complaints/:id` | Owner |
| DELETE | `/api/complaints/:id` | Owner/Admin |
| PATCH | `/api/complaints/:id/status` | Admin/Chairman |
| GET | `/api/complaints/attachment/:file` | Authenticated |
| POST | `/api/maintenance/dues` | Admin |
| POST | `/api/maintenance/:id/pay` | Resident+ |
| GET | `/api/wings/society/:id` | Authenticated |

## Production Checklist
- [ ] Set strong `JWT_SECRET` (32+ random chars)
- [ ] Set `NODE_ENV=production`
- [ ] Set `ALLOWED_ORIGINS` to your actual domain
- [ ] Rotate any API keys that were previously committed
- [ ] Set up PostgreSQL with SSL
- [ ] Configure reverse proxy (nginx) with HTTPS
- [ ] Set up log aggregation
- [ ] Configure backup for PostgreSQL
