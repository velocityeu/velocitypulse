# Stripe Test Cards

Use these test card numbers when testing the checkout flow in development or test mode.

## Successful Payments

| Card Number | Description |
|-------------|-------------|
| `4242 4242 4242 4242` | Succeeds and immediately processes |
| `4000 0025 0000 3155` | Requires SCA authentication (3D Secure) |
| `4000 0000 0000 0077` | Succeeds, always requires CVC |

## 3D Secure Test Cards

| Card Number | Description |
|-------------|-------------|
| `4000 0027 6000 3184` | Requires authentication on all transactions |
| `4000 0025 0000 3155` | Requires authentication (handled by Stripe) |
| `4000 0000 0000 3220` | 3D Secure 2 authentication required |

## Declined Cards

| Card Number | Error Code | Description |
|-------------|------------|-------------|
| `4000 0000 0000 9995` | `insufficient_funds` | Card declined (insufficient funds) |
| `4000 0000 0000 9987` | `lost_card` | Card declined (lost card) |
| `4000 0000 0000 9979` | `stolen_card` | Card declined (stolen card) |
| `4000 0000 0000 0002` | `card_declined` | Generic decline |
| `4000 0000 0000 0069` | `expired_card` | Expired card |
| `4000 0000 0000 0127` | `incorrect_cvc` | Incorrect CVC |
| `4000 0000 0000 0119` | `processing_error` | Processing error |

## Test Card Details

For all test cards, use:
- **Expiry date**: Any future date (e.g., `12/34`)
- **CVC**: Any 3 digits (e.g., `123`)
- **Postal code**: Any valid format (e.g., `12345`)

## Testing Flow

1. Start the dev server: `npm run dev`
2. Navigate to http://localhost:3002/pricing
3. Click "Buy Now" on Starter or Unlimited plan
4. Complete checkout with test card `4242 4242 4242 4242`
5. Verify redirect to success page after payment

## Webhook Testing

For local webhook testing, use Stripe CLI:

```bash
# Install Stripe CLI (Windows)
winget install Stripe.StripeCLI

# Login to Stripe
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3002/api/stripe/webhook
```

## Official Documentation

For the complete list of test cards and scenarios:
https://docs.stripe.com/testing
