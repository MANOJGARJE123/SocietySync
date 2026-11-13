const env = require('../config/env');
const fs = require('fs/promises');
const path = require('path');
const ragRepository = require('../repositories/rag.repository');
const noticeRepository = require('../repositories/notice.repository');
const maintenanceRepository = require('../repositories/maintenance.repository');
const complaintService = require('./complaint.service');
const noticeService = require('./notice.service');
const maintenanceService = require('./maintenance.service');
const userService = require('./user.service');
const userRepository = require('../repositories/user.repository');
const wingRepository = require('../repositories/wing.repository');
const extractTextFromPdf = require('../utils/pdfParser');
const chunkTextByWords = require('../utils/chunkText');
const generateEmbedding = require('../utils/embeddingHelper');
const fetchClient = require('../utils/fetchClient');
const resolveGeminiChatModel = require('../utils/geminiModelResolver');
const AppError = require('../utils/AppError');

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const TEST_DATA_DIR = path.join(__dirname, '../../test-data');
let autoSeedAttempted = false;
const DEFAULT_MIN_SIMILARITY = 0.35;

const ACTION_TYPES = {
  COMPLAINT: 'complaint',
  NOTICE: 'notice',
  MAINTENANCE: 'maintenance',
  RESIDENT: 'resident',
  PROFILE: 'profile'
};

const normalizeAnswer = (text) =>
  String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const toTitleCase = (value) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(' ');

const stripPolitePrefix = (value) =>
  String(value || '')
    .replace(/^(please|kindly|can you|could you|i want to|i need to|i have to|help me|for me)\s+/i, '')
    .trim();

const removeActionWords = (value) =>
  stripPolitePrefix(value)
    .replace(/\b(raise|create|file|submit|log|register|make|add)\b\s+(a\s+|an\s+)?/gi, '')
    .replace(/\b(complaint|issue|problem|grievance)\b/gi, '')
    .replace(/\b(post|publish|send|put|announce|notify|inform)\b\s+(a\s+|an\s+)?/gi, '')
    .replace(/\b(notice|announcement)\b/gi, '')
    .replace(/\b(maintenance\s+due|maintenance|due|resident|user|profile)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

const extractKeyValue = (text, aliases) => {
  const keys = aliases.map((alias) => alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const match = String(text || '').match(new RegExp(`\\b(?:${keys})\\s*[:=]\\s*([^,;\\n]+)`, 'i'));
  return match ? match[1].trim() : undefined;
};

const extractEmail = (text) => String(text || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];

const extractPhone = (text) => {
  const explicit = extractKeyValue(text, ['phone', 'mobile', 'contact']);
  if (explicit) return explicit.replace(/[^\d+]/g, '');
  return String(text || '').match(/\b\d{10}\b/)?.[0];
};

const extractFlatNumber = (text) => {
  const explicit = extractKeyValue(text, ['flat', 'flat number', 'flat no']);
  if (explicit) return explicit;
  return String(text || '').match(/\bflat\s+([a-z0-9-]+)/i)?.[1];
};

const extractWingName = (text) => {
  const match = String(text || '').match(/\bwing\s+([a-z0-9-]+)/i);
  if (!match) return null;
  return match[1].replace(/[.,;:!?].*$/, '').trim();
};

const removeWingPhrase = (text) =>
  String(text || '')
    .replace(/\b(in|for|at|of)?\s*wing\s+[a-z0-9-]+/i, '')
    .replace(/\s+/g, ' ')
    .trim();

const detectAssistantAction = (question) => {
  const text = String(question || '').toLowerCase();
  if (!text) return null;

  const hasCreateVerb = /\b(raise|create|file|submit|log|register|make|add|post|publish|send|announce|notify|inform|update|change|edit)\b/.test(text);
  const asksHow = /\b(how|can i|where|what is the process|steps?)\b/.test(text);

  if (!hasCreateVerb || asksHow) return null;

  if (/\b(profile|my phone|my name|my flat)\b/.test(text)) {
    return ACTION_TYPES.PROFILE;
  }

  if (/\b(complaint|issue|problem|grievance)\b/.test(text)) {
    return ACTION_TYPES.COMPLAINT;
  }

  if (/\b(notice|announcement)\b/.test(text)) {
    return ACTION_TYPES.NOTICE;
  }

  if (/\b(maintenance\s+due|maintenance|due)\b/.test(text)) {
    return ACTION_TYPES.MAINTENANCE;
  }

  if (/\b(resident|user)\b/.test(text)) {
    return ACTION_TYPES.RESIDENT;
  }

  return null;
};

const buildComplaintPayloadFromQuestion = (question) => {
  const withoutWing = removeWingPhrase(question);
  const cleaned = removeActionWords(withoutWing)
    .replace(/\b(regarding|about|for|that|because|as)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const titleSource = cleaned || 'Society Complaint';
  const title = toTitleCase(titleSource.split(/\s+/).slice(0, 8).join(' '));
  const wingName = extractWingName(question);
  const wingText = wingName ? ` Mentioned wing: ${toTitleCase(wingName)}.` : '';

  return {
    title,
    description: `${String(question).trim()}${wingText}`.trim()
  };
};

const parseExpiryDays = (question) => {
  const match = String(question || '').match(/\b(?:for|valid for|expire(?:s)? in)\s+(\d{1,3})\s+days?\b/i);
  if (!match) return 7;
  const parsed = Number(match[1]);
  if (!Number.isInteger(parsed)) return 7;
  return Math.max(1, Math.min(365, parsed));
};

const buildNoticePayloadFromQuestion = async (question, user) => {
  const withoutWing = removeWingPhrase(question);
  const cleaned = removeActionWords(withoutWing)
    .replace(/\b(regarding|about|for|that|to all residents|all residents)\b/gi, ' ')
    .replace(/\b(?:for|valid for|expires? in)\s+\d{1,3}\s+days?\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const content = cleaned || String(question).trim();
  const title = toTitleCase(content.split(/\s+/).slice(0, 8).join(' ')) || 'Society Notice';
  const payload = {
    title,
    content,
    expiryDays: parseExpiryDays(question)
  };

  const wingName = extractWingName(question);
  if (wingName && user?.societyId) {
    const wings = await wingRepository.findBySociety(user.societyId);
    const normalizedWingName = wingName.toLowerCase();
    const matchingWing = wings.find((wing) => String(wing.name || '').toLowerCase() === normalizedWingName);
    if (matchingWing) {
      payload.wingId = matchingWing._id;
    }
  }

  return payload;
};

const findWingByName = async (wingName, user) => {
  if (!wingName || !user?.societyId) return null;
  const wings = await wingRepository.findBySociety(user.societyId);
  const normalizedWingName = String(wingName).toLowerCase();
  return wings.find((wing) => String(wing.name || '').toLowerCase() === normalizedWingName) || null;
};

const findResidentFromQuestion = async (question, user) => {
  const userId = extractKeyValue(question, ['userId', 'user id', 'residentId', 'resident id']);
  if (userId) return userRepository.findById(userId);

  const email = extractEmail(question);
  if (email) return userRepository.findByEmail(email);

  const flatNumber = extractFlatNumber(question);
  if (!flatNumber || !user?.societyId) return null;

  const users = await userRepository.findBySociety(user.societyId);
  return (
    users.find(
      (item) =>
        item.role === 'resident' &&
        String(item.flatNumber || '').toLowerCase() === String(flatNumber).toLowerCase()
    ) || null
  );
};

const parseMonth = (question) => {
  const explicit = extractKeyValue(question, ['month']);
  if (explicit) return explicit;
  return String(question || '').match(/\b(20\d{2}-(0[1-9]|1[0-2]))\b/)?.[1];
};

const parseAmountDue = (question) => {
  const explicit = String(question || '').match(/\bamount(?:\s+due)?\s*[:=]?\s*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d{1,2})?)\b/i);
  if (explicit) {
    const parsed = Number(explicit[1]);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  const match = String(question || '').match(/\b(?:rs\.?|inr|₹)\s*(\d+(?:\.\d{1,2})?)\b/i);
  if (!match) return undefined;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseDueDate = (question) => {
  const explicit = extractKeyValue(question, ['dueDate', 'due date']);
  if (explicit) return explicit;
  return String(question || '').match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1];
};

const buildMaintenancePayloadFromQuestion = async (question, user) => {
  const resident = await findResidentFromQuestion(question, user);
  return {
    userId: resident?._id,
    month: parseMonth(question),
    amountDue: parseAmountDue(question),
    dueDate: parseDueDate(question),
    resident
  };
};

const buildResidentPayloadFromQuestion = async (question, user) => {
  const wingName = extractWingName(question);
  const wing = wingName ? await findWingByName(wingName, user) : null;
  const name =
    extractKeyValue(question, ['name', 'resident name']) ||
    String(question || '').match(/\b(?:resident|user)\s+([a-z][a-z ]{2,40}?)(?:\s+email|\s+phone|\s+flat|\s+password|\s+wing|[,;]|$)/i)?.[1]?.trim();

  return {
    name,
    email: extractEmail(question),
    password: extractKeyValue(question, ['password']),
    wingId: wing?._id || extractKeyValue(question, ['wingId', 'wing id']),
    phone: extractPhone(question),
    flatNumber: extractFlatNumber(question)
  };
};

const buildProfilePayloadFromQuestion = (question) => {
  const payload = {};
  const name = extractKeyValue(question, ['name', 'my name']);
  const phone = extractPhone(question);
  const flatNumber = extractFlatNumber(question);

  if (name) payload.name = name;
  if (phone) payload.phone = phone;
  if (flatNumber) payload.flatNumber = flatNumber;

  return payload;
};

const missingFieldsMessage = (action, fields) =>
  `I can ${action}, but I need: ${fields.join(', ')}. Please send those details in one message.`;

const tryHandleAssistantAction = async (question, user) => {
  const action = detectAssistantAction(question);
  if (!action) return null;

  if (action === ACTION_TYPES.COMPLAINT) {
    if (!['admin', 'chairman', 'resident'].includes(user?.role)) {
      return {
        answer: 'I could not raise the complaint because your role is not allowed to create complaints.',
        contextUsed: [],
        action: { type: action, success: false }
      };
    }

    const payload = buildComplaintPayloadFromQuestion(question);
    const complaint = await complaintService.createComplaint(payload, user._id);
    return {
      answer: `Complaint created successfully.\n- Title: ${complaint.title}\n- Status: ${complaint.status}\n- Complaint ID: ${complaint._id}`,
      contextUsed: [],
      action: { type: action, success: true, id: complaint._id }
    };
  }

  if (action === ACTION_TYPES.NOTICE) {
    if (!['admin', 'chairman'].includes(user?.role)) {
      return {
        answer: 'I could not create the notice because only admins and chairmen can publish notices.',
        contextUsed: [],
        action: { type: action, success: false }
      };
    }

    const payload = await buildNoticePayloadFromQuestion(question, user);
    const notice = await noticeService.createNotice(payload, user);
    return {
      answer: `Notice created successfully.\n- Title: ${notice.title}\n- Expires: ${formatDate(notice.expiresAt)}\n- Notice ID: ${notice._id}`,
      contextUsed: [],
      action: { type: action, success: true, id: notice._id }
    };
  }

  if (action === ACTION_TYPES.MAINTENANCE) {
    if (user?.role !== 'admin') {
      return {
        answer: 'I could not create the maintenance due because only admins can create maintenance dues.',
        contextUsed: [],
        action: { type: action, success: false }
      };
    }

    const payload = await buildMaintenancePayloadFromQuestion(question, user);
    const missing = [];
    if (!payload.userId) missing.push('resident userId, email, or flat number');
    if (!payload.month) missing.push('month like 2026-05');
    if (payload.amountDue === undefined) missing.push('amount');
    if (!payload.dueDate) missing.push('due date like 2026-05-31');
    if (missing.length > 0) {
      return {
        answer: missingFieldsMessage('create the maintenance due', missing),
        contextUsed: [],
        action: { type: action, success: false, missing }
      };
    }

    const due = await maintenanceService.createDue({
      userId: payload.userId,
      month: payload.month,
      amountDue: payload.amountDue,
      dueDate: payload.dueDate
    });
    return {
      answer: `Maintenance due created successfully.\n- Resident: ${due.userId?.name || payload.resident?.name || payload.userId}\n- Month: ${due.month}\n- Amount: Rs. ${Number(due.amountDue || payload.amountDue).toFixed(2)}\n- Due ID: ${due._id}`,
      contextUsed: [],
      action: { type: action, success: true, id: due._id }
    };
  }

  if (action === ACTION_TYPES.RESIDENT) {
    if (!['admin', 'chairman'].includes(user?.role)) {
      return {
        answer: 'I could not add the resident because only admins and chairmen can add residents.',
        contextUsed: [],
        action: { type: action, success: false }
      };
    }

    const payload = await buildResidentPayloadFromQuestion(question, user);
    const missing = [];
    if (!payload.name) missing.push('name');
    if (!payload.email) missing.push('email');
    if (!payload.password) missing.push('password');
    if (user?.role === 'admin' && !payload.wingId) missing.push('wing name or wingId');
    if (missing.length > 0) {
      return {
        answer: missingFieldsMessage('add the resident', missing),
        contextUsed: [],
        action: { type: action, success: false, missing }
      };
    }

    const resident = await userService.registerResident(user, payload);
    return {
      answer: `Resident added successfully.\n- Name: ${resident.name}\n- Email: ${resident.email}\n- Resident ID: ${resident._id}`,
      contextUsed: [],
      action: { type: action, success: true, id: resident._id }
    };
  }

  if (action === ACTION_TYPES.PROFILE) {
    const payload = buildProfilePayloadFromQuestion(question);
    const missing = [];
    if (!payload.name && !payload.phone && !payload.flatNumber) {
      missing.push('name, phone, or flat number');
    }
    if (missing.length > 0) {
      return {
        answer: missingFieldsMessage('update your profile', missing),
        contextUsed: [],
        action: { type: action, success: false, missing }
      };
    }

    const profile = await userService.updateProfile(user._id, payload);
    return {
      answer: `Profile updated successfully.\n- Name: ${profile.name}\n- Phone: ${profile.phone || '-'}\n- Flat: ${profile.flatNumber || '-'}`,
      contextUsed: [],
      action: { type: action, success: true, id: profile._id }
    };
  }

  return null;
};

const isIncompleteAnswer = (text) => {
  const trimmed = String(text || '').trim();
  if (!trimmed) return true;

  const lines = trimmed.split('\n').map((line) => line.trim()).filter(Boolean);
  const lastLine = lines[lines.length - 1] || '';
  const endsWithSentence = /[.!?]["')\]]?$/.test(lastLine);
  if (endsWithSentence) return false;

  const isBullet = /^[-*]\s+/.test(lastLine);
  const shortLine = lastLine.split(/\s+/).length <= 2;
  const endsWithDangling = /[:;,\-]$/.test(lastLine) || /'s$/.test(lastLine);

  return isBullet || shortLine || endsWithDangling;
};

const getMinSimilarity = () => {
  const parsed = Number(env.ragMinSimilarity);
  if (Number.isNaN(parsed)) return DEFAULT_MIN_SIMILARITY;
  // Clamp to cosine similarity bounds.
  return Math.max(-1, Math.min(1, parsed));
};

const filterRelevantBySimilarity = (chunks) => {
  const minSimilarity = getMinSimilarity();
  return chunks.filter((chunk) => Number(chunk?.score) >= minSimilarity);
};

const findFirstPdfInTestData = async () => {
  try {
    const entries = await fs.readdir(TEST_DATA_DIR, { withFileTypes: true });
    const pdf = entries.find((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.pdf'));
    if (!pdf) return null;
    return path.join(TEST_DATA_DIR, pdf.name);
  } catch (error) {
    return null;
  }
};

const formatDate = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toISOString().split('T')[0];
};

const buildLiveSocietyContext = async () => {
  let notices = [];
  let maintenanceEntries = [];

  try {
    const noticesPromise =
      typeof noticeRepository.findAll === 'function'
        ? noticeRepository.findAll()
        : typeof noticeRepository.findForUser === 'function'
          ? noticeRepository.findForUser({ role: 'admin' })
          : Promise.resolve([]);

    const maintenancePromise =
      typeof maintenanceRepository.findAll === 'function'
        ? maintenanceRepository.findAll()
        : Promise.resolve([]);

    [notices, maintenanceEntries] = await Promise.all([noticesPromise, maintenancePromise]);
  } catch (error) {
    return {
      hasUsableContext: false,
      contextText: ''
    };
  }

  const latestNotices = notices.slice(0, 5);
  const pendingMaintenance = maintenanceEntries
    .filter((item) => item.status !== 'paid')
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 12);

  const noticeText = latestNotices.length
    ? latestNotices
        .map(
          (notice, index) =>
            `${index + 1}. ${notice.title} | ${notice.content} | expires: ${formatDate(notice.expiresAt)}`
        )
        .join('\n')
    : 'No active notices found.';

  const duesText = pendingMaintenance.length
    ? pendingMaintenance
        .map((item, index) => {
          const remaining = Math.max(Number(item.amountDue || 0) - Number(item.paidAmount || 0), 0);
          const resident = item.userId?.name || item.userId?.email || 'Resident';
          return `${index + 1}. ${resident} | month: ${item.month} | remaining: Rs ${remaining.toFixed(2)} | due: ${formatDate(item.dueDate)} | status: ${item.status}`;
        })
        .join('\n')
    : 'No pending maintenance dues found.';

  const hasUsableContext = latestNotices.length > 0 || pendingMaintenance.length > 0;

  return {
    hasUsableContext,
    contextText: `Live society data context (notices sorted newest first, dues sorted by earliest due date):\n\nActive notices:\n${noticeText}\n\nMaintenance dues:\n${duesText}\n\nRules:\nIf no rule details are present in this context, explicitly say rules are not currently configured in uploaded knowledge.`
  };
};

const shouldPreferLiveContext = (question) => {
  const text = String(question || '').toLowerCase();
  if (!text) return false;

  const liveKeywords = [
    'notice',
    'notices',
    'announcement',
    'announcements',
    'maintenance',
    'due',
    'dues',
    'payment',
    'payments',
    'pending',
    'unpaid',
    'bill',
    'invoice',
    'receipt',
    'fine',
    'late fee',
    'outstanding',
    'amount due'
  ];

  const pdfKeywords = ['pdf', 'document', 'uploaded', 'knowledge base', 'file'];

  const mentionsPdf = pdfKeywords.some((keyword) => text.includes(keyword));
  if (mentionsPdf) return false;

  return liveKeywords.some((keyword) => text.includes(keyword));
};

const shouldUseGeneralChat = (question) => {
  const text = String(question || '').toLowerCase().trim();
  if (!text) return true;

  const casualKeywords = [
    'hi',
    'hello',
    'hey',
    'how are you',
    'what can you do',
    'who are you',
    'thanks',
    'thank you',
    'good morning',
    'good evening',
    'bye',
    'good night',
    'let us talk',
    "let's talk",
    'chat'
  ];

  const societyKeywords = [
    'society',
    'notice',
    'maintenance',
    'complaint',
    'rule',
    'dues',
    'payment',
    'wing',
    'member',
    'flat',
    'resident',
    'pdf',
    'document',
    'uploaded'
  ];

  if (casualKeywords.some((keyword) => text.includes(keyword))) {
    return true;
  }

  if (societyKeywords.some((keyword) => text.includes(keyword))) {
    return false;
  }

  // Treat short, non-domain prompts as casual chat.
  return text.split(/\s+/).length <= 6;
};

const hasSocietyDomainIntent = (question) => {
  const text = String(question || '').toLowerCase();
  if (!text) return false;

  const domainKeywords = [
    'society',
    'notice',
    'announcement',
    'maintenance',
    'dues',
    'due',
    'payment',
    'complaint',
    'rule',
    'rules',
    'parking',
    'election',
    'committee',
    'member',
    'flat',
    'wing',
    'resident',
    'byelaw',
    'bye-law',
    'pdf',
    'document',
    'uploaded',
    'knowledge'
  ];

  return domainKeywords.some((keyword) => text.includes(keyword));
};

const hasStrongRagConfidence = (question, chunks) => {
  if (!Array.isArray(chunks) || chunks.length === 0) return false;

  const bestScore = chunks.reduce((max, chunk) => Math.max(max, Number(chunk?.score) || -1), -1);
  const hasDomainIntent = hasSocietyDomainIntent(question);

  // For non-domain prompts, require much stronger confidence before using RAG context.
  const minScore = hasDomainIntent ? getMinSimilarity() : Math.max(getMinSimilarity() + 0.3, 0.65);
  return bestScore >= minScore;
};

const buildLocalGeneralAnswer = (question) => {
  const text = String(question || '').trim();
  if (!text) {
    return 'Hello. I am here to help with society questions and also casual chat.';
  }

  const lower = text.toLowerCase();
  if (/(^|\b)(hi|hello|hey|good morning|good evening)(\b|$)/.test(lower)) {
    return 'Hello. I am here and ready to chat. You can ask me anything.';
  }

  if (/(^|\b)(how are you)(\b|$)/.test(lower)) {
    return 'I am doing well and ready to help. How can I assist you today?';
  }

  if (/(^|\b)(thanks|thank you)(\b|$)/.test(lower)) {
    return 'You are welcome. Happy to help.';
  }

  return `I am here with you. You said: "${text}". Tell me what you want to discuss, and I will help.`;
};

const generateAnswerFromGemini = async (question, contextText) => {
  const resolvedModel = await resolveGeminiChatModel();
  const modelName = resolvedModel || env.geminiChatModel;
  let response;
  try {
    response = await fetchClient(
      `${GEMINI_BASE_URL}/models/${modelName}:generateContent?key=${env.geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text:
                  'You are a helpful assistant for a residential society management system. Answer only from the provided context. Respond in clear bullet points and include all important points from the context. Keep it concise but complete (typically 5-8 bullets, about 120-220 words). Do not give one-line overly brief answers. If context is insufficient, clearly say what is missing.'
              }
            ]
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: `Context:\n${contextText}\n\nQuestion: ${question}` }]
            }
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 420
          }
        })
      }
    );
  } catch (error) {
    console.warn('Gemini fetch failed:', error?.message || error);
    throw new AppError('Gemini request failed. Check GEMINI_API_KEY and network access.', 503);
  }

  const data = await response.json();

  if (!response.ok) {
    const message = data?.error?.message || 'Failed to generate answer from Gemini';
    console.warn('Gemini response error:', response.status, message);
    throw new AppError(message, 503);
  }

  const answer = normalizeAnswer(
    data?.candidates?.[0]?.content?.parts?.map((part) => part.text).join(' ')
  );

  return answer || 'No answer generated.';
};

const generateGeneralAnswerFromGemini = async (question) => {
  const resolvedModel = await resolveGeminiChatModel();
  const modelName = resolvedModel || env.geminiChatModel;
  let response;
  try {
    response = await fetchClient(
      `${GEMINI_BASE_URL}/models/${modelName}:generateContent?key=${env.geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text:
                  'You are a helpful assistant for a residential society management system. For general chat, respond in short structured bullet points with enough detail to cover all key points. Keep it concise but not too brief (typically 4-7 bullets, about 100-180 words).'
              }
            ]
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: question }]
            }
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 360
          }
        })
      }
    );
  } catch (error) {
    console.warn('Gemini general fetch failed:', error?.message || error);
    throw new AppError('Gemini request failed. Check GEMINI_API_KEY and network access.', 503);
  }

  const data = await response.json();

  if (!response.ok) {
    const message = data?.error?.message || 'Failed to generate answer from Gemini';
    console.warn('Gemini general response error:', response.status, message);
    throw new AppError(message, 503);
  }

  const answer = normalizeAnswer(
    data?.candidates?.[0]?.content?.parts?.map((part) => part.text).join(' ')
  );
  return answer || 'No answer generated.';
};

const buildFallbackAnswer = (question, contextText) => {
  const cleaned = String(contextText || '')
    .replace(/Context\s+\d+\s*:\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) {
    return 'I could not generate an answer right now. Please try again.';
  }

  const prompt = String(question || '').toLowerCase();
  const promptWords = prompt
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2);

  const stopWords = new Set([
    'the',
    'and',
    'for',
    'with',
    'from',
    'this',
    'that',
    'have',
    'has',
    'are',
    'was',
    'were',
    'you',
    'your',
    'about',
    'what',
    'when',
    'where',
    'which',
    'will'
  ]);

  const keywords = promptWords.filter((word) => !stopWords.has(word));
  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 35);

  const scored = sentences.map((sentence, index) => {
    const text = sentence.toLowerCase();
    const keywordHits = keywords.reduce((count, keyword) => {
      return count + (text.includes(keyword) ? 1 : 0);
    }, 0);

    // Prefer question-relevant sentences, then earlier context lines.
    return {
      sentence,
      score: keywordHits * 10 - index * 0.01
    };
  });

  const best = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((item) => item.sentence);

  const selected = best.length > 0 ? best : sentences.slice(0, 6);

  const lowerQuestion = String(question || '').toLowerCase();
  const isParkingQuestion =
    lowerQuestion.includes('park') ||
    lowerQuestion.includes('parking') ||
    lowerQuestion.includes('car slot') ||
    lowerQuestion.includes('scooty') ||
    lowerQuestion.includes('bike');

  if (isParkingQuestion) {
    const contextLower = cleaned.toLowerCase();
    const mentionsCarsOnly =
      contextLower.includes('parking of cars') ||
      contextLower.includes('for parking of cars') ||
      contextLower.includes('car parking');
    const mentionsCommitteeAllotment =
      contextLower.includes('allotment of parking') ||
      contextLower.includes('first come first served') ||
      contextLower.includes('allotted by the society');

    const lines = [
      'Parking space use should follow society parking rules and committee allotment.'
    ];

    if (mentionsCarsOnly) {
      lines.push('The current context describes these slots as car-parking slots.');
      lines.push('So do not assume a scooty can be parked in a car slot by default.');
      lines.push('Use a designated two-wheeler slot, or take written committee permission before using a car slot.');
    } else {
      lines.push('The context does not clearly define separate two-wheeler vs car-slot usage.');
      lines.push('Confirm with the committee before parking a scooty in a car-marked slot.');
    }

    if (mentionsCommitteeAllotment) {
      lines.push('Allotment is committee-controlled (typically first-come-first-served), so use only your allotted slot.');
    }

    return lines.map((line) => `- ${line}`).join('\n');
  }

  if (selected.length === 0) {
    const short = cleaned.length > 450 ? `${cleaned.slice(0, 450).trim()}...` : cleaned;
    return `Based on the available society context:\n- ${short}`;
  }

  return `Based on the available society context:\n${selected
    .map((line) => `- ${line}`)
    .join('\n')}`;
};

const generateAnswer = async (question, contextText) => {
      if (!env.geminiApiKey) {
        console.warn('Gemini disabled: GEMINI_API_KEY is missing.');
        return buildFallbackAnswer(question, contextText);
      }

      try {
        const answer = await generateAnswerFromGemini(question, contextText);
        if (isIncompleteAnswer(answer)) {
          return buildFallbackAnswer(question, contextText);
        }
        return answer;
      } catch (error) {
        console.warn('Gemini answer failed:', error?.message || error);
        return buildFallbackAnswer(question, contextText);
      }
};

const generateGeneralAnswer = async (question) => {
  if (!env.geminiApiKey) {
    return buildLocalGeneralAnswer(question);
  }

  try {
    return await generateGeneralAnswerFromGemini(question);
  } catch (error) {
    console.warn('Gemini general answer failed:', error?.message || error);
    return buildLocalGeneralAnswer(question);
  }
};

const indexPdfBuffer = async (pdfBuffer) => {
  if (!pdfBuffer) {
    throw new AppError('PDF buffer is required', 400);
  }

  const extractedText = await extractTextFromPdf(pdfBuffer);

  if (!extractedText) {
    throw new AppError('No readable text found in PDF', 400);
  }

  const chunks = chunkTextByWords(extractedText, {
    chunkSize: env.chunkSizeWords,
    overlap: env.chunkOverlapWords
  });

  if (chunks.length === 0) {
    throw new AppError('No valid text chunks generated from PDF', 400);
  }

  const chunksWithEmbeddings = [];

  for (const chunk of chunks) {
    const embedding = await generateEmbedding(chunk);
    chunksWithEmbeddings.push({
      text: chunk,
      embedding
    });
  }

  const inserted = await ragRepository.insertManyChunks(chunksWithEmbeddings);

  return {
    totalChunks: chunks.length,
    insertedCount: inserted.length
  };
};

const tryAutoSeedFromTestData = async () => {
  if (autoSeedAttempted) return false;
  autoSeedAttempted = true;

  try {
    const pdfPath = await findFirstPdfInTestData();
    if (!pdfPath) return false;
    const pdfBuffer = await fs.readFile(pdfPath);
    await indexPdfBuffer(pdfBuffer);
    return true;
  } catch (error) {
    return false;
  }
};

// Service layer: orchestrates business logic for RAG ingestion and query.
const ragService = {
  async uploadPdfAndIndex(pdfBuffer) {
    return indexPdfBuffer(pdfBuffer);
  },

  async answerQuestion(question, user) {
    try {
      if (!question || typeof question !== 'string') {
        throw new AppError('A valid question is required', 400);
      }

      const actionResult = await tryHandleAssistantAction(question, user);
      if (actionResult) {
        return actionResult;
      }

      const liveContext = await buildLiveSocietyContext();
      const preferLive = shouldPreferLiveContext(question);
      const useGeneralChat = shouldUseGeneralChat(question);
      const hasDomainIntent = hasSocietyDomainIntent(question);

      if ((useGeneralChat || !hasDomainIntent) && !preferLive) {
        const answer = await generateGeneralAnswer(question);
        return {
          answer,
          contextUsed: []
        };
      }

      if (preferLive && liveContext.hasUsableContext) {
        const answer = await generateAnswer(question, liveContext.contextText);
        return {
          answer,
          contextUsed: [
            {
              id: 'live-society-data',
              text: liveContext.contextText,
              score: 1
            }
          ]
        };
      }

      const questionEmbedding = await generateEmbedding(question);
      let relevantChunks = await ragRepository.findTopSimilarChunks(questionEmbedding, env.topKResults);

      if (relevantChunks.length === 0) {
        const totalChunks = await ragRepository.countChunks();
        if (totalChunks === 0) {
          const seeded = await tryAutoSeedFromTestData();
          if (seeded) {
            relevantChunks = await ragRepository.findTopSimilarChunks(questionEmbedding, env.topKResults);
          }
        }

        const seededRelevantChunks = filterRelevantBySimilarity(relevantChunks);

        if (seededRelevantChunks.length > 0 && hasStrongRagConfidence(question, seededRelevantChunks)) {
          const contextText = seededRelevantChunks
            .map((chunk, index) => `Context ${index + 1}: ${chunk.text}`)
            .join('\n\n');
          const answer = await generateAnswer(question, contextText);

          return {
            answer,
            contextUsed: seededRelevantChunks.map((chunk) => ({
              id: chunk._id,
              text: chunk.text,
              score: chunk.score
            }))
          };
        }

        if (preferLive && liveContext.hasUsableContext) {
          const answer = await generateAnswer(question, liveContext.contextText);

          return {
            answer,
            contextUsed: [
              {
                id: 'live-society-data',
                text: liveContext.contextText,
                score: 1
              }
            ]
          };
        }

        const fallbackAnswer = await generateGeneralAnswer(question);
        return {
          answer: fallbackAnswer,
          contextUsed: []
        };
      }

      const relevantBySimilarity = filterRelevantBySimilarity(relevantChunks);

      if (relevantBySimilarity.length === 0 || !hasStrongRagConfidence(question, relevantBySimilarity)) {
        if (preferLive && liveContext.hasUsableContext) {
          const answer = await generateAnswer(question, liveContext.contextText);

          return {
            answer,
            contextUsed: [
              {
                id: 'live-society-data',
                text: liveContext.contextText,
                score: 1
              }
            ]
          };
        }

        const fallbackAnswer = await generateGeneralAnswer(question);
        return {
          answer: fallbackAnswer,
          contextUsed: []
        };
      }

      const contextText = relevantBySimilarity
        .map((chunk, index) => `Context ${index + 1}: ${chunk.text}`)
        .join('\n\n');

      const answer = await generateAnswer(question, contextText);

      return {
        answer,
        contextUsed: relevantBySimilarity.map((chunk) => ({
          id: chunk._id,
          text: chunk.text,
          score: chunk.score
        }))
      };
    } catch (error) {
      console.error('RAG query failed:', error.message);
      const fallbackAnswer = await generateGeneralAnswer(question);
      return {
        answer: fallbackAnswer,
        contextUsed: []
      };
    }
  }
};

module.exports = ragService;
