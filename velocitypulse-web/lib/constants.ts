// Form option constants - centralized to avoid duplication

export const COUNTRY_OPTIONS = [
  { value: 'US', label: 'United States' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'CA', label: 'Canada' },
  { value: 'AU', label: 'Australia' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'NL', label: 'Netherlands' },
  { value: 'IE', label: 'Ireland' },
  { value: 'other', label: 'Other' },
] as const

export const COMPANY_SIZE_OPTIONS = [
  { value: '1-10', label: '1-10 employees' },
  { value: '11-50', label: '11-50 employees' },
  { value: '51-200', label: '51-200 employees' },
  { value: '201-500', label: '201-500 employees' },
  { value: '500+', label: '500+ employees' },
] as const

export const DEVICE_COUNT_OPTIONS = [
  { value: '1-25', label: '1-25 devices' },
  { value: '26-50', label: '26-50 devices' },
  { value: '51-100', label: '51-100 devices' },
  { value: '101-500', label: '101-500 devices' },
  { value: '500+', label: '500+ devices' },
] as const

export const CLIENT_COUNT_OPTIONS = [
  { value: '1-5', label: '1-5 clients' },
  { value: '6-20', label: '6-20 clients' },
  { value: '21-50', label: '21-50 clients' },
  { value: '51-100', label: '51-100 clients' },
  { value: '100+', label: '100+ clients' },
] as const

export const TIER_OPTIONS = [
  { value: 'starter', label: 'Starter only' },
  { value: 'unlimited', label: 'Unlimited only' },
  { value: 'both', label: 'Both tiers' },
] as const

export const WHITE_LABEL_OPTIONS = [
  { value: 'yes', label: 'Yes, I want white-label' },
  { value: 'no', label: 'No, standard branding is fine' },
  { value: 'maybe', label: 'Maybe later' },
] as const

export const CONTACT_SUBJECT_OPTIONS = [
  { value: 'sales', label: 'Sales inquiry' },
  { value: 'support', label: 'Technical support' },
  { value: 'billing', label: 'Billing question' },
  { value: 'partnership', label: 'Partnership opportunity' },
  { value: 'other', label: 'Other' },
] as const

// Type helpers for form values
export type CountryCode = typeof COUNTRY_OPTIONS[number]['value']
export type CompanySize = typeof COMPANY_SIZE_OPTIONS[number]['value']
export type DeviceCount = typeof DEVICE_COUNT_OPTIONS[number]['value']
export type ClientCount = typeof CLIENT_COUNT_OPTIONS[number]['value']
export type TierPreference = typeof TIER_OPTIONS[number]['value']
export type WhiteLabelPreference = typeof WHITE_LABEL_OPTIONS[number]['value']
export type ContactSubject = typeof CONTACT_SUBJECT_OPTIONS[number]['value']

// App configuration
export const APP_CONFIG = {
  name: 'VelocityPulse.io',
  domain: 'velocitypulse.io',
  supportEmail: 'support@velocitypulse.io',
  salesEmail: 'sales@velocitypulse.io',
  company: 'Velocity EU Ltd',
  year: new Date().getFullYear(),
} as const

// Pricing tiers
export const PRICING = {
  starter: {
    name: 'Starter',
    price: 50,
    pricePartner: 25,
    devices: 100,
    features: [
      'Up to 100 devices',
      'All core features',
      'Email support',
      'Real-time monitoring',
      'Custom alerts',
      'Basic reporting',
    ],
  },
  unlimited: {
    name: 'Unlimited',
    price: 950,
    pricePartner: 475,
    devices: 5000,
    features: [
      'Up to 5,000 devices',
      'Everything in Starter',
      'Priority support',
      'SSO integration',
      'White-label available',
      'Advanced analytics',
      'API access',
    ],
  },
} as const
