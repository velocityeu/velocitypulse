# VelocityPulse - Pricing Strategy

Detailed pricing breakdown and rationale for VelocityPulse SaaS offering.

## Pricing Philosophy

### Core Principles

1. **Mass adoption first, revenue optimization later**
   - Low barrier to entry
   - Generous free tier to build word-of-mouth
   - Convert through value, not limitations

2. **Predictable pricing**
   - No per-device pricing complexity
   - Clear tier boundaries
   - No surprise overages

3. **Annual billing simplicity**
   - Monthly rate, billed annually
   - Simpler cash flow management
   - Higher LTV, lower churn

## Pricing Tiers

### Free Forever - £0/month

| Feature | Limit |
|---------|-------|
| Devices | 50 |
| Agents | 1 |
| Users | 2 |
| Data retention | 7 days |
| Email alerts | Yes |
| Dashboard access | Full |
| Support | Community |

**Target users:** Individuals, small offices, evaluation

**Why this works:**
- 50 devices covers most small offices
- Creates advocates who recommend to larger orgs
- Low support burden (self-service)

---

### Pro Trial - £0 for 30 days

| Feature | Limit |
|---------|-------|
| Devices | Unlimited |
| Agents | 3 |
| Users | 10 |
| All Pro features | Yes |
| No credit card | Required |

**Purpose:** Let users experience full value before committing

---

### Pro - £29/month (billed annually = £348/year)

| Feature | Limit |
|---------|-------|
| Devices | 200 |
| Agents | 5 |
| Users | 10 |
| Data retention | 30 days |
| Email alerts | Yes |
| Slack/Teams alerts | Yes |
| API access | Yes |
| Support | Email (48h response) |

**Target users:** Growing SMBs, small IT teams

**Why £29:**
- Below psychological £30 threshold
- Comparable to other SMB tools (Notion, Slack)
- 6x cheaper than PRTG entry point

---

### Business - £79/month (billed annually = £948/year)

| Feature | Limit |
|---------|-------|
| Devices | 500 |
| Agents | 10 |
| Users | 25 |
| Data retention | 90 days |
| All Pro features | Yes |
| SSO (SAML) | Yes |
| Custom branding | Yes |
| Priority support | Email (24h response) |
| Onboarding call | 30 minutes |

**Target users:** Established SMBs, schools, multi-site businesses

**Why £79:**
- Clear value jump from Pro (2.5x devices, SSO)
- Still affordable for education budgets
- Competitive with mid-tier alternatives

---

### Enterprise - Custom pricing

| Feature | Limit |
|---------|-------|
| Devices | Unlimited |
| Agents | Unlimited |
| Users | Unlimited |
| Data retention | 1 year |
| All Business features | Yes |
| White-label option | Yes |
| Custom SLA | Yes |
| Dedicated success manager | Yes |
| Phone support | Yes |
| Custom integrations | Yes |

**Target users:** MSPs, large organizations, MATs

**Starting point:** £500/month minimum

**Why custom:**
- MSPs need flexibility (per-client billing)
- Large orgs need procurement process
- Higher touch = higher value

## Annual Pricing Summary

| Tier | Monthly Rate | Annual Cost | Savings vs Monthly* |
|------|--------------|-------------|---------------------|
| Free | £0 | £0 | - |
| Pro | £29 | £348 | - |
| Business | £79 | £948 | - |
| Enterprise | Custom | Custom | - |

*We only offer annual billing to simplify operations.

## Competitive Pricing Analysis

| Competitor | Entry Price | 100 Devices | Notes |
|------------|-------------|-------------|-------|
| **VelocityPulse** | £0 | £29/mo | Free tier, simple pricing |
| PRTG Network Monitor | £1,350/year | £1,350/year | Per-sensor pricing |
| Datadog | $15/host/mo | ~$1,500/mo | Enterprise-focused |
| Nagios XI | $1,995/year | $1,995/year | Per-server, complex |
| Zabbix | Free | Free | Self-hosted, complex setup |
| UptimeRobot | $7/mo | N/A | URL monitoring only |
| Better Stack | $24/mo | N/A | Limited device monitoring |

**Our position:** Affordable like UptimeRobot, capable like PRTG

## Potential Add-Ons (Future)

| Add-On | Price | Description |
|--------|-------|-------------|
| Additional agents | £10/mo each | Beyond tier limit |
| Extended retention | £20/mo | 1 year data retention |
| White-label | £100/mo | Remove VelocityPulse branding |
| API rate limit increase | £50/mo | 10x API calls |
| Dedicated support | £200/mo | Slack channel, 4h response |

## Discounts

### Education Discount (Proposed)
- **50% off** Business tier for UK schools
- Verification via school email domain
- Stackable with annual billing

### Non-Profit Discount (Proposed)
- **30% off** any paid tier
- Verification via charity number

### Volume Discount (Enterprise)
- 10-24 sites: 10% off
- 25-49 sites: 15% off
- 50+ sites: 20% off

## Billing Operations

### Payment Methods
- Credit/debit card (Visa, Mastercard, Amex)
- Apple Pay (via Stripe)
- Google Pay (via Stripe)
- Bank transfer (Enterprise only, invoice)

### Billing Cycle
- Annual billing only for self-service
- Monthly invoicing available for Enterprise
- Prorated upgrades mid-cycle
- No refunds for downgrades

### Failed Payments
1. Day 0: Payment fails, retry automatically
2. Day 3: Email notification, second retry
3. Day 7: Final warning email
4. Day 14: Downgrade to Free tier
5. Data retained for 30 days, then deleted

### Plan Changes
- **Upgrade:** Immediate, prorated
- **Downgrade:** End of billing period
- **Cancel:** Access until end of paid period

## Revenue Projections

### Assumptions
- 500 free users
- 10% convert to Pro
- 20% of Pro upgrade to Business
- Average Enterprise deal: £6,000/year

### Year 1 Projection

| Tier | Customers | Annual Revenue |
|------|-----------|----------------|
| Free | 500 | £0 |
| Pro | 50 | £17,400 |
| Business | 10 | £9,480 |
| Enterprise | 5 | £30,000 |
| **Total** | **565** | **£56,880** |

### Year 2 Projection (2x growth)

| Tier | Customers | Annual Revenue |
|------|-----------|----------------|
| Free | 1,000 | £0 |
| Pro | 100 | £34,800 |
| Business | 20 | £18,960 |
| Enterprise | 15 | £90,000 |
| **Total** | **1,135** | **£143,760** |

## Key Metrics to Track

| Metric | Target |
|--------|--------|
| Free to Pro conversion | 10% |
| Pro to Business upgrade | 20% |
| Monthly churn (Pro) | <5% |
| Monthly churn (Business) | <3% |
| Average Contract Value | £500 |
| Customer Acquisition Cost | <£100 |
| Lifetime Value (Pro) | £1,000 |
| LTV:CAC ratio | >3:1 |

## Pricing FAQ

**Q: Why no monthly billing option?**
A: Annual billing simplifies operations, improves cash flow, and reduces churn. Our prices are low enough that annual commitment is reasonable.

**Q: Can I pay monthly as Enterprise?**
A: Yes, Enterprise customers can arrange monthly invoicing with a minimum 12-month commitment.

**Q: What happens if I exceed my device limit?**
A: We'll notify you at 80% and 90%. At 100%, new devices won't be added until you upgrade or remove existing devices. No automatic overage charges.

**Q: Is there a startup discount?**
A: Contact us for startup and accelerator program pricing. We're flexible for early-stage companies.

**Q: Can I switch plans mid-year?**
A: Upgrades are immediate and prorated. Downgrades take effect at your next renewal date.

---

*Last updated: January 2026*
