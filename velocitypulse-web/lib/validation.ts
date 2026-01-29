import { z } from 'zod'

// Common validation patterns
const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Please enter a valid email address')
  .max(254, 'Email is too long')

const phoneSchema = z
  .string()
  .min(1, 'Phone is required')
  .regex(
    /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/,
    'Please enter a valid phone number'
  )
  .max(30, 'Phone number is too long')

const urlSchema = z
  .string()
  .min(1, 'URL is required')
  .url('Please enter a valid URL')
  .max(2048, 'URL is too long')

const sanitizeString = (value: string): string => {
  // Remove potential XSS characters while preserving legitimate content
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim()
}

// Contact form schema
export const contactFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name is too long')
    .transform(sanitizeString),
  email: emailSchema,
  organization: z
    .string()
    .max(200, 'Organization name is too long')
    .transform(sanitizeString)
    .optional(),
  subject: z.enum(['sales', 'support', 'billing', 'partnership', 'other'], {
    errorMap: () => ({ message: 'Please select a subject' }),
  }),
  message: z
    .string()
    .min(10, 'Message must be at least 10 characters')
    .max(5000, 'Message is too long')
    .transform(sanitizeString),
})

export type ContactFormData = z.infer<typeof contactFormSchema>

// Partner application schema
export const partnerFormSchema = z.object({
  companyName: z
    .string()
    .min(1, 'Company name is required')
    .max(200, 'Company name is too long')
    .transform(sanitizeString),
  website: urlSchema,
  contactName: z
    .string()
    .min(1, 'Contact name is required')
    .max(100, 'Contact name is too long')
    .transform(sanitizeString),
  email: emailSchema,
  phone: phoneSchema,
  country: z.enum(
    ['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'NL', 'IE', 'other'],
    { errorMap: () => ({ message: 'Please select a country' }) }
  ),
  clientCount: z.enum(
    ['1-5', '6-20', '21-50', '51-100', '100+'],
    { errorMap: () => ({ message: 'Please select client count' }) }
  ),
  avgDevices: z.enum(
    ['1-25', '26-50', '51-100', '101-500', '500+'],
    { errorMap: () => ({ message: 'Please select device count' }) }
  ),
  tierPreference: z.enum(
    ['starter', 'unlimited', 'both'],
    { errorMap: () => ({ message: 'Please select a tier' }) }
  ),
  whiteLabel: z.enum(
    ['yes', 'no', 'maybe'],
    { errorMap: () => ({ message: 'Please select white-label preference' }) }
  ),
  taxId: z
    .string()
    .max(50, 'Tax ID is too long')
    .transform(sanitizeString)
    .optional(),
  businessDescription: z
    .string()
    .max(2000, 'Description is too long')
    .transform(sanitizeString)
    .optional(),
  termsAccepted: z.literal('on', {
    errorMap: () => ({ message: 'You must accept the terms of service' }),
  }),
  gdprConsent: z.literal('on', {
    errorMap: () => ({ message: 'You must provide GDPR consent' }),
  }),
})

export type PartnerFormData = z.infer<typeof partnerFormSchema>

// Demo/Trial signup schema
export const demoFormSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(50, 'First name is too long')
    .transform(sanitizeString),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(50, 'Last name is too long')
    .transform(sanitizeString),
  email: emailSchema,
  company: z
    .string()
    .min(1, 'Company name is required')
    .max(200, 'Company name is too long')
    .transform(sanitizeString),
  companySize: z.enum(
    ['1-10', '11-50', '51-200', '201-500', '500+'],
    { errorMap: () => ({ message: 'Please select company size' }) }
  ),
  deviceCount: z.enum(
    ['1-25', '26-50', '51-100', '101-500', '500+'],
    { errorMap: () => ({ message: 'Please select device count' }) }
  ),
})

export type DemoFormData = z.infer<typeof demoFormSchema>

// Allowed domains for Stripe redirects
const isAllowedRedirectUrl = (url: string): boolean => {
  return (
    url.startsWith('https://velocitypulse.io') ||
    url.startsWith('https://velocitypulse-web.vercel.app') ||
    url.startsWith('http://localhost')
  )
}

// Stripe checkout schema
export const checkoutSchema = z.object({
  plan: z.enum(['starter', 'unlimited'], {
    errorMap: () => ({ message: 'Invalid plan selected' }),
  }),
  email: emailSchema.optional(),
  successUrl: z
    .string()
    .url()
    .refine(isAllowedRedirectUrl, { message: 'Invalid redirect URL' })
    .optional(),
  cancelUrl: z
    .string()
    .url()
    .refine(isAllowedRedirectUrl, { message: 'Invalid redirect URL' })
    .optional(),
})

export type CheckoutData = z.infer<typeof checkoutSchema>

// Stripe portal schema
export const portalSchema = z.object({
  customerId: z
    .string()
    .min(1, 'Customer ID is required')
    .regex(/^cus_[a-zA-Z0-9]+$/, 'Invalid customer ID format'),
  returnUrl: z
    .string()
    .url()
    .refine(isAllowedRedirectUrl, { message: 'Invalid return URL' })
    .optional(),
})

export type PortalData = z.infer<typeof portalSchema>

// Helper to format Zod errors for API responses
export function formatZodErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const issue of error.issues) {
    const path = issue.path.join('.')
    if (!errors[path]) {
      errors[path] = issue.message
    }
  }
  return errors
}
