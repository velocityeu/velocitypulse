# Microsoft OAuth Setup for VelocityPulse Dashboard

This document describes the Microsoft Azure AD OAuth configuration for Clerk authentication.

## Overview

To avoid repeated consent prompts when users sign in with Microsoft, we use a custom Azure AD app registration instead of Clerk's shared development app.

## Azure AD App Registration

| Setting | Value |
|---------|-------|
| **App Name** | VelocityPulse Dashboard |
| **App ID (Client ID)** | `02a4b199-487f-4ff1-95f8-1f251152c56a` |
| **Tenant ID** | `109d2251-7648-45cb-95df-8ffe18031f2d` |
| **Publisher Domain** | velocity-eu.com |
| **Sign-in Audience** | Azure AD and Personal Microsoft Accounts |
| **Created** | 2026-01-30 |

### Redirect URIs

```
https://singular-seahorse-24.clerk.accounts.dev/v1/oauth_callback
```

### API Permissions

| Permission | Type | Status |
|------------|------|--------|
| Microsoft Graph - User.Read | Delegated | Configured |

## Clerk Dashboard Configuration

The Microsoft OAuth credentials are configured in Clerk Dashboard:

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Select **VelocityPulse** app
3. Navigate to **Configure** → **SSO Connections** → **Microsoft**
4. Use **Custom credentials** with:
   - **Client ID:** `02a4b199-487f-4ff1-95f8-1f251152c56a`
   - **Client Secret:** (stored in Clerk)
   - **Discovery Endpoint:** `https://login.microsoftonline.com/common/v2.0`

## Secret Management

The client secret is stored in:
- **Clerk Dashboard** (SSO Connections → Microsoft → Client Secret)

**Secret Details:**
- Display Name: `Clerk OAuth Secret`
- Expires: 2028-01-30 (2 years from creation)
- Created via: Azure CLI

### Rotating the Secret

When the secret expires, generate a new one:

```bash
# Login to Azure
az login

# Create new secret (old one remains valid until expiry)
az ad app credential reset \
  --id "02a4b199-487f-4ff1-95f8-1f251152c56a" \
  --append \
  --display-name "Clerk OAuth Secret v2" \
  --years 2

# Update the new secret in Clerk Dashboard
```

## Azure Portal Access

To manage this app registration:

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Search for "VelocityPulse Dashboard"

Or direct link:
```
https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/Overview/appId/02a4b199-487f-4ff1-95f8-1f251152c56a
```

## Troubleshooting

### Users still see consent prompt every time

1. Verify custom credentials are saved in Clerk Dashboard
2. Check that the redirect URI matches exactly
3. Ensure the app has User.Read permission

### "AADSTS50011: Reply URL does not match"

The redirect URI in Azure doesn't match what Clerk is sending. Update in Azure Portal:
- App registrations → VelocityPulse Dashboard → Authentication → Add/update redirect URI

### "Application not found in tenant"

The user's Microsoft account tenant may be blocking external apps. This is an org policy issue, not a configuration problem.

## CLI Commands Reference

```bash
# View app details
az ad app show --id "02a4b199-487f-4ff1-95f8-1f251152c56a"

# List credentials (secrets)
az ad app credential list --id "02a4b199-487f-4ff1-95f8-1f251152c56a"

# Update redirect URIs
az ad app update --id "02a4b199-487f-4ff1-95f8-1f251152c56a" \
  --web-redirect-uris "https://your-new-redirect-uri"

# Delete app (if needed)
az ad app delete --id "02a4b199-487f-4ff1-95f8-1f251152c56a"
```
