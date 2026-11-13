const ACTION_DEFS = {
  complaint: {
    required: ['title', 'description']
  },
  notice: {
    required: ['title', 'content'],
    optional: ['expiryDays', 'wingId']
  },
  resident: {
    required: ['name', 'email', 'password'],
    optional: ['wingId', 'phone', 'flatNumber']
  },
  maintenance: {
    required: ['userId', 'month', 'amountDue', 'dueDate']
  },
  profile: {
    required: [],
    minFields: ['name', 'phone', 'flatNumber']
  }
};

const FIELD_ALIASES = {
  title: 'title',
  description: 'description',
  content: 'content',
  expiry: 'expiryDays',
  'expiry days': 'expiryDays',
  expiryDays: 'expiryDays',
  wing: 'wingId',
  'wing id': 'wingId',
  wingid: 'wingId',
  name: 'name',
  email: 'email',
  password: 'password',
  phone: 'phone',
  flat: 'flatNumber',
  'flat number': 'flatNumber',
  flatnumber: 'flatNumber',
  userid: 'userId',
  'user id': 'userId',
  user: 'userId',
  month: 'month',
  amount: 'amountDue',
  'amount due': 'amountDue',
  amountdue: 'amountDue',
  duedate: 'dueDate',
  'due date': 'dueDate'
};

const FIELD_PROMPTS = {
  title: 'Please provide a title.',
  description: 'Please provide a description.',
  content: 'Please provide the notice content.',
  expiryDays: 'How many days should this notice stay active? (1-365)',
  wingId: 'Which wing should this be for? Provide wingId.',
  name: 'Provide the resident name.',
  email: 'Provide the resident email.',
  password: 'Provide a password for the resident.',
  phone: 'Provide a phone number.',
  flatNumber: 'Provide a flat number.',
  userId: 'Provide the userId for the resident.',
  month: 'Which month is the due for? (e.g., 2026-05)',
  amountDue: 'Provide the due amount.',
  dueDate: 'Provide the due date (YYYY-MM-DD).'
};

const FIELD_SET = new Set(Object.values(FIELD_ALIASES));

const ACTION_PATTERNS = {
  complaint: [
    /(raise|create|file|submit)\s+(a\s+)?(complaint|issue|problem|grievance)/i,
    /(complaint|issue|problem|grievance)\s+(raise|create|file|submit)/i,
    /(i\s+want\s+to\s+)?complain(\s+about)?/i
  ],
  notice: [/(create|post|publish|add)\s+(a\s+)?notice/i, /notice\s+(create|post|publish)/i],
  resident: [/(add|register|create)\s+(a\s+)?(resident|user)/i],
  maintenance: [/(create|add|generate)\s+(a\s+)?(maintenance\s+due|due)/i],
  profile: [/(update|change|edit)\s+(my\s+)?(profile|name|phone|flat)/i]
};

export const detectAction = (text) => {
  for (const [type, patterns] of Object.entries(ACTION_PATTERNS)) {
    if (patterns.some((pattern) => pattern.test(text))) {
      return type;
    }
  }

  return null;
};

export const extractFields = (text) => {
  const fields = {};
  const matches = text.matchAll(/([a-zA-Z ]+)\s*[:=]\s*([^,;]+)/g);

  for (const match of matches) {
    const rawKey = match[1].trim().toLowerCase();
    const value = match[2].trim();
    const key = FIELD_ALIASES[rawKey];

    if (!key || !FIELD_SET.has(key)) {
      continue;
    }

    if (key === 'amountDue' || key === 'expiryDays') {
      const parsed = Number(value);
      fields[key] = Number.isFinite(parsed) ? parsed : value;
    } else {
      fields[key] = value;
    }
  }

  return fields;
};

export const getNextField = (actionType, data) => {
  const def = ACTION_DEFS[actionType];
  if (!def) return null;

  const missingRequired = (def.required || []).filter((field) => !data[field]);
  if (missingRequired.length > 0) {
    return missingRequired[0];
  }

  if (def.minFields && !def.minFields.some((field) => data[field])) {
    return def.minFields[0];
  }

  return null;
};

export const getFieldPrompt = (field) => FIELD_PROMPTS[field] || 'Please provide the required details.';

export const isActionReady = (actionType, data) => {
  const def = ACTION_DEFS[actionType];
  if (!def) return false;

  const missingRequired = (def.required || []).filter((field) => !data[field]);
  if (missingRequired.length > 0) return false;

  if (def.minFields && !def.minFields.some((field) => data[field])) return false;

  return true;
};

export const isCancelMessage = (text) => /^(cancel|stop|never mind|nevermind)$/i.test(text.trim());

const hasNumber = (text) => /\d/.test(text);

export const isLikelyFieldValue = (field, text) => {
  const value = text.trim();

  switch (field) {
    case 'userId':
    case 'wingId':
      return /^\d+$/.test(value);
    case 'amountDue':
    case 'expiryDays':
      return /^\d+(\.\d+)?$/.test(value);
    case 'dueDate':
      return /^\d{4}-\d{2}-\d{2}$/.test(value);
    case 'month':
      return /^\d{4}-\d{2}$/.test(value);
    case 'email':
      return /@/.test(value);
    case 'phone':
      return hasNumber(value);
    case 'flatNumber':
    case 'name':
    case 'title':
    case 'description':
    case 'content':
    case 'password':
      return value.length > 1;
    default:
      return value.length > 0;
  }
};
