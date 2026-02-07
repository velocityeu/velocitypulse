# Social Login OAuth Setup for VelocityPulse Dashboard

This document describes the OAuth configuration for all social login providers used with Clerk authentication.

## Production Clerk Instance

| Setting | Value |
|---------|-------|
| **Domain** | `clerk.velocitypulse.io` |
| **Mode** | Production |
| **Redirect URI Base** | `https://clerk.velocitypulse.io/v1/oauth_callback` |

> **Dev vs Production:** Development instances use `https://<slug>.clerk.accounts.dev/v1/oauth_callback`. Production instances use your custom Clerk domain (e.g., `https://clerk.velocitypulse.io/v1/oauth_callback`). Always verify you're configuring the correct redirect URI for the environment.

---

## Microsoft (Azure AD)

### Azure AD App Registration

| Setting | Value |
|---------|-------|
| **App Name** | VelocityPulse Dashboard |
| **App ID (Client ID)** | `02a4b199-487f-4ff1-95f8-1f251152c56a` |
| **Tenant ID** | `109d2251-7648-45cb-95df-8ffe18031f2d` |
| **Publisher Domain** | velocity-eu.com |
| **Sign-in Audience** | Multitenant (Azure AD and Personal Microsoft Accounts) |
| **Created** | 2026-01-30 |

### Redirect URI

```
https://clerk.velocitypulse.io/v1/oauth_callback
```

### API Permissions

| Permission | Type | Status |
|------------|------|--------|
| Microsoft Graph - User.Read | Delegated | Configured |

### Clerk Dashboard Configuration

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Select **VelocityPulse** app
3. Navigate to **Configure** → **SSO Connections** → **Microsoft**
4. Use **Custom credentials** with:
   - **Client ID:** `02a4b199-487f-4ff1-95f8-1f251152c56a`
   - **Client Secret:** (stored in Clerk)
   - **Discovery Endpoint:** `https://login.microsoftonline.com/common/v2.0`

### Secret Management

The client secret is stored in:
- **Clerk Dashboard** (SSO Connections → Microsoft → Client Secret)

**Secret Details:**
- Display Name: `Clerk OAuth Secret`
- Expires: 2028-01-30 (2 years from creation)
- Created via: Azure CLI

#### Rotating the Secret

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

### Azure Portal Access

To manage this app registration:

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Search for "VelocityPulse Dashboard"

Or direct link:
```
https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/Overview/appId/02a4b199-487f-4ff1-95f8-1f251152c56a
```

### CLI Commands Reference

```bash
# View app details
az ad app show --id "02a4b199-487f-4ff1-95f8-1f251152c56a"

# List credentials (secrets)
az ad app credential list --id "02a4b199-487f-4ff1-95f8-1f251152c56a"

# Update redirect URIs
az ad app update --id "02a4b199-487f-4ff1-95f8-1f251152c56a" \
  --web-redirect-uris "https://clerk.velocitypulse.io/v1/oauth_callback"

# Delete app (if needed)
az ad app delete --id "02a4b199-487f-4ff1-95f8-1f251152c56a"
```

---

## Google

### Google Cloud Console Configuration

| Setting | Value |
|---------|-------|
| **Project** | VelocityPulse |
| **OAuth Client Type** | Web application |
| **Consent Screen Status** | In production |

### Redirect URI

```
https://clerk.velocitypulse.io/v1/oauth_callback
```

### OAuth Scopes

| Scope | Purpose |
|-------|---------|
| `openid` | OpenID Connect authentication |
| `email` | User's email address |
| `profile` | User's name and profile picture |

### Clerk Dashboard Configuration

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Select **VelocityPulse** app
3. Navigate to **Configure** → **SSO Connections** → **Google**
4. Use **Custom credentials** with:
   - **Client ID:** (from Google Cloud Console)
   - **Client Secret:** (stored in Clerk)

### Notes

- The Google OAuth consent screen must be set to **"In production"** (not "Testing") to avoid the 100-user cap and "unverified app" warning.
- If using a Google Workspace domain, ensure the consent screen is configured for **External** users to allow personal Gmail accounts.

---

## Apple

### Apple Developer Portal Configuration

| Setting | Value |
|---------|-------|
| **Services ID** | (configured in Apple Developer portal) |
| **Team ID** | (Apple Developer team) |
| **Key ID** | (Sign in with Apple key) |

### Redirect URI

```
https://clerk.velocitypulse.io/v1/oauth_callback
```

### Clerk Dashboard Configuration

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Select **VelocityPulse** app
3. Navigate to **Configure** → **SSO Connections** → **Apple**
4. Use **Custom credentials** with:
   - **Services ID:** (from Apple Developer portal)
   - **Team ID:** (from Apple Developer portal)
   - **Key ID:** (from Apple Developer portal)
   - **Private Key:** (contents of .p8 key file)

### Key File (.p8) Management

- The `.p8` private key file is downloaded once from Apple and cannot be re-downloaded.
- Store a backup securely (e.g., password manager or encrypted vault).
- The key contents are pasted into Clerk Dashboard — the file itself is not uploaded.
- Apple Sign In keys do not expire, but can be revoked and regenerated if compromised.

---

## Troubleshooting

### General

#### Users see consent prompt every time
1. Verify custom credentials are saved in Clerk Dashboard for the provider
2. Check that the redirect URI matches exactly: `https://clerk.velocitypulse.io/v1/oauth_callback`
3. Ensure required permissions/scopes are configured

#### Redirect URI mismatch error
The redirect URI in the provider's console doesn't match what Clerk is sending. Verify the URI is set to `https://clerk.velocitypulse.io/v1/oauth_callback` in the provider's settings.

### Microsoft-Specific

#### "AADSTS50011: Reply URL does not match"
Update the redirect URI in Azure Portal: App registrations → VelocityPulse Dashboard → Authentication → Add/update redirect URI.

#### "Application not found in tenant"
The user's Microsoft account tenant may be blocking external apps. This is an org policy issue, not a configuration problem.

### Google-Specific

#### "Access blocked: This app's request is invalid" (Error 400)
The redirect URI in Google Cloud Console doesn't match. Ensure `https://clerk.velocitypulse.io/v1/oauth_callback` is listed under **Authorized redirect URIs**.

#### "This app isn't verified" warning
The OAuth consent screen is still in **Testing** mode. Publish it to production in Google Cloud Console → APIs & Services → OAuth consent screen.

### Apple-Specific

#### "invalid_client" error
1. Verify the Services ID, Team ID, and Key ID are correct in Clerk Dashboard
2. Ensure the .p8 private key contents are pasted correctly (including header/footer lines)
3. Check that the Services ID has "Sign in with Apple" enabled and the redirect URI is configured

#### Apple login returns no email
Apple allows users to hide their email on first sign-in (relay address). Subsequent sign-ins from the same Apple ID will use the same relay address. This is expected Apple behavior.
