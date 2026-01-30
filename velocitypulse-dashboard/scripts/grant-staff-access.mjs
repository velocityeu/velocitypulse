#!/usr/bin/env node
/**
 * Grant staff access to a Clerk user by email
 * Usage: node scripts/grant-staff-access.mjs <email>
 */

import { createClerkClient } from '@clerk/backend'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// Load environment variables from .env.local
const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '..', '.env.local')
const envContent = readFileSync(envPath, 'utf-8')

const env = {}
for (const line of envContent.split('\n')) {
  const trimmed = line.trim()
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...valueParts] = trimmed.split('=')
    env[key] = valueParts.join('=')
  }
}

const clerk = createClerkClient({
  secretKey: env.CLERK_SECRET_KEY,
})

async function grantStaffAccess(email) {
  if (!email) {
    console.error('Usage: node scripts/grant-staff-access.mjs <email>')
    process.exit(1)
  }

  console.log(`Looking up user: ${email}...`)

  try {
    // Find user by email
    const users = await clerk.users.getUserList({
      emailAddress: [email],
    })

    if (users.data.length === 0) {
      console.error(`No user found with email: ${email}`)
      process.exit(1)
    }

    const user = users.data[0]
    console.log(`Found user: ${user.id} (${user.firstName} ${user.lastName})`)

    // Update public metadata to grant staff role
    await clerk.users.updateUser(user.id, {
      publicMetadata: {
        ...user.publicMetadata,
        role: 'staff',
      },
    })

    console.log(`✓ Granted staff access to ${email}`)
    console.log(`  User ID: ${user.id}`)
    console.log(`  Role: staff`)
  } catch (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

const email = process.argv[2]
grantStaffAccess(email)
