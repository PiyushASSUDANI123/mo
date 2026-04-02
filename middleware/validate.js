const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const PHONE_REGEX = /^[6-9]\d{9}$/;
const ACCOUNT_REGEX = /^\d{9,18}$/;

function sanitize(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/[<>]/g, '').trim();
}

function validateField(value, rule, fieldName) {
  if (rule.required && (value === undefined || value === null || value === '')) {
    return `${fieldName} is required.`;
  }

  if (value === undefined || value === null || value === '') return null;

  if (rule.type === 'string' && typeof value !== 'string') {
    return `${fieldName} must be a string.`;
  }

  if (rule.type === 'boolean' && typeof value !== 'boolean') {
    return `${fieldName} must be a boolean.`;
  }

  if (rule.type === 'number' && typeof value !== 'number') {
    return `${fieldName} must be a number.`;
  }

  if (typeof value === 'string') {
    if (rule.minLength && value.length < rule.minLength) {
      return `${fieldName} must be at least ${rule.minLength} characters.`;
    }
    if (rule.maxLength && value.length > rule.maxLength) {
      return `${fieldName} must be at most ${rule.maxLength} characters.`;
    }
    if (rule.pattern && !rule.pattern.test(value)) {
      return rule.patternMessage || `${fieldName} has an invalid format.`;
    }
  }

  return null;
}

export function validate(schema, options = {}) {
  const { stripUnknown = true } = options;

  return (req, res, next) => {
    const body = req.body;

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ message: 'Request body must be a JSON object.' });
    }

    const knownFields = new Set(Object.keys(schema));
    const errors = {};
    const sanitized = {};

    if (stripUnknown) {
      for (const key of Object.keys(body)) {
        if (!knownFields.has(key)) continue;
        sanitized[key] = typeof body[key] === 'string' ? sanitize(body[key]) : body[key];
      }
    } else {
      const unknownFields = Object.keys(body).filter(k => !knownFields.has(k));
      if (unknownFields.length > 0) {
        return res.status(400).json({
          message: `Unexpected fields: ${unknownFields.join(', ')}`,
        });
      }
      for (const key of Object.keys(body)) {
        sanitized[key] = typeof body[key] === 'string' ? sanitize(body[key]) : body[key];
      }
    }

    for (const [field, rule] of Object.entries(schema)) {
      const error = validateField(sanitized[field], rule, rule.label || field);
      if (error) errors[field] = error;
    }

    if (Object.keys(errors).length > 0) {
      const firstError = Object.values(errors)[0];
      return res.status(400).json({ message: firstError, errors });
    }

    req.body = sanitized;
    next();
  };
}

export const schemas = {

  signup: {
    email: {
      type: 'string',
      required: true,
      maxLength: 255,
      pattern: EMAIL_REGEX,
      patternMessage: 'Please enter a valid email address.',
      label: 'Email',
    },
    password: {
      type: 'string',
      required: true,
      minLength: 8,
      maxLength: 128,
      label: 'Password',
    },
  },

  login: {
    email: {
      type: 'string',
      required: true,
      maxLength: 255,
      pattern: EMAIL_REGEX,
      patternMessage: 'Please enter a valid email address.',
      label: 'Email',
    },
    password: {
      type: 'string',
      required: true,
      minLength: 1,
      maxLength: 128,
      label: 'Password',
    },
  },

  kycDraft: {
    step: {
      type: 'number',
      required: true,
      label: 'Step',
    },
    data: {
      type: 'object',
      required: true,
      label: 'Data',
    },
  },

  kycBusinessData: {
    legalBusinessName: {
      type: 'string',
      required: true,
      minLength: 2,
      maxLength: 200,
      label: 'Legal business name',
    },
    storeName: {
      type: 'string',
      required: true,
      minLength: 2,
      maxLength: 100,
      label: 'Store name',
    },
    supportEmail: {
      type: 'string',
      required: true,
      maxLength: 255,
      pattern: EMAIL_REGEX,
      patternMessage: 'Support email has an invalid format.',
      label: 'Support email',
    },
    phone: {
      type: 'string',
      required: true,
      pattern: PHONE_REGEX,
      patternMessage: 'Phone must be a valid 10-digit Indian mobile number.',
      label: 'Phone number',
    },
  },

  kycTaxData: {
    gstin: {
      type: 'string',
      required: true,
      pattern: GSTIN_REGEX,
      patternMessage: 'GSTIN must be 15 characters in standard format.',
      label: 'GSTIN',
    },
    pan: {
      type: 'string',
      required: true,
      pattern: PAN_REGEX,
      patternMessage: 'PAN must be 10 characters: 5 letters + 4 digits + 1 letter.',
      label: 'PAN',
    },
  },

  kycBankData: {
    accountNumber: {
      type: 'string',
      required: true,
      pattern: ACCOUNT_REGEX,
      patternMessage: 'Account number must be 9–18 digits.',
      label: 'Account number',
    },
    confirmAccountNumber: {
      type: 'string',
      required: true,
      label: 'Confirm account number',
    },
    ifsc: {
      type: 'string',
      required: true,
      pattern: IFSC_REGEX,
      patternMessage: 'IFSC must be 11 chars: 4 letters + 0 + 6 alphanumeric.',
      label: 'IFSC code',
    },
  },
};

export function sanitizeKycData(data) {
  if (!data || typeof data !== 'object') return {};

  const allowed = [
    'legalBusinessName', 'storeName', 'supportEmail', 'phone',
    'gstin', 'pan',
    'accountNumber', 'confirmAccountNumber', 'ifsc',
    'chequePath', 'agreedToTerms',
  ];

  const clean = {};
  for (const key of allowed) {
    if (data[key] !== undefined) {
      clean[key] = typeof data[key] === 'string' ? sanitize(data[key]) : data[key];
    }
  }

  if (clean.legalBusinessName) clean.legalBusinessName = clean.legalBusinessName.slice(0, 200);
  if (clean.storeName) clean.storeName = clean.storeName.slice(0, 100);
  if (clean.supportEmail) clean.supportEmail = clean.supportEmail.slice(0, 255).toLowerCase();
  if (clean.phone) clean.phone = clean.phone.replace(/\D/g, '').slice(0, 10);
  if (clean.gstin) clean.gstin = clean.gstin.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
  if (clean.pan) clean.pan = clean.pan.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  if (clean.accountNumber) clean.accountNumber = clean.accountNumber.replace(/\D/g, '').slice(0, 18);
  if (clean.confirmAccountNumber) clean.confirmAccountNumber = clean.confirmAccountNumber.replace(/\D/g, '').slice(0, 18);
  if (clean.ifsc) clean.ifsc = clean.ifsc.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11);

  return clean;
}
