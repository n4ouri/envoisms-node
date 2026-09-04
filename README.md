# EnvoiSMS Node.js SDK

Official Node.js and TypeScript client for [EnvoiSMS.ma](https://envoisms.ma) — [Passerelle SMS & WhatsApp Business](https://envoisms.ma/fr/docs) and [API SMS Maroc](https://envoisms.ma/fr/tarifs).

For full API documentation, endpoints, and guides, visit the [Passerelle SMS & WhatsApp Business](https://envoisms.ma/fr/docs). For pricing plans and credit packs, visit [API SMS Maroc](https://envoisms.ma/fr/tarifs).

## Installation

```bash
npm install envoisms
```

## Quick Start

```typescript
import { EnvoiSMSClient } from 'envoisms';

const client = new EnvoiSMSClient(process.env.ENVOISMS_API_KEY!);

// Send a simple SMS
async function main() {
  const result = await client.send({
    to: '+212600000000',
    message: 'Votre code de vérification est 492018',
    from: 'MonBusiness',
  });
  console.log('Message ID:', result.id);
}

main();
```

## OTP Verification Flow

```typescript
// 1. Send OTP code
const otpResponse = await client.sendOtp({
  to: '+212600000000',
  brand: 'MonBusiness',
  code_length: 6,
  expiry: 600, // 10 minutes
});

console.log('Session ID:', otpResponse.session_id);

// 2. Check user input OTP code
const verifyResult = await client.checkOtp({
  session_id: otpResponse.session_id,
  code: '492018',
});

if (verifyResult.verified) {
  console.log('OTP verified successfully');
}
```

## Features

- **Single SMS & WhatsApp**: `client.send()`
- **Bulk SMS**: `client.sendBulk()`
- **OTP Send & Check**: `client.sendOtp()`, `client.checkOtp()`
- **Analytics**: `client.analytics()`
- **Message Status**: `client.listMessages()`
- **API Keys**: `client.createApiKey()`

## Documentation & Tarifs

- Documentation technique & intégration : [Passerelle SMS & WhatsApp Business](https://envoisms.ma/fr/docs)
- Grille tarifaire et packs de crédits : [API SMS Maroc](https://envoisms.ma/fr/tarifs)

## License

MIT
