# Transfer Intents Module

This module provides functionality for managing transfer intents and pending transfers for the MercadoPago bank transfer payment method.

## Overview

The Transfer Intents system allows users to pay invoices via bank transfer with automatic detection. Users generate a unique transfer code, include it in their bank transfer concept, and the system automatically matches the transfer when MercadoPago sends a webhook.

## Components

### TransferCodeGenerator

Static utility class for generating, validating, and parsing transfer codes.

**Transfer Code Format:** `GYM-{orgId}-{YYYYMMDD}-{amount}`

**Example:** `GYM-123-20260501-500000`

**Components:**
- `GYM`: Fixed prefix
- `orgId`: Numeric organization ID (1-999999)
- `timestamp`: Date in YYYYMMDD format
- `amount`: Amount in cents (positive integer)

#### Methods

##### `generate(orgId: number, amount: number): string`

Generates a unique transfer code.

```typescript
const code = TransferCodeGenerator.generate(123, 500000)
// Returns: "GYM-123-20260501-500000"
```

**Throws:**
- Error if orgId is not in range 1-999999
- Error if amount is not a positive integer

##### `validate(code: string): boolean`

Validates that a code matches the transfer code format.

```typescript
TransferCodeGenerator.validate('GYM-123-20260501-500000') // true
TransferCodeGenerator.validate('INVALID-CODE') // false
```

##### `parse(code: string): ParsedTransferCode | null`

Parses a transfer code and extracts its components.

```typescript
const parsed = TransferCodeGenerator.parse('GYM-123-20260501-500000')
// Returns: { orgId: 123, timestamp: '20260501', amount: 500000 }

const invalid = TransferCodeGenerator.parse('INVALID-CODE')
// Returns: null
```

### FileStorageBase

Base class for file-based storage with atomic writes. Implements the atomic write-then-rename pattern to ensure data consistency.

### Types

- `TransferIntent`: Represents an intention to pay via bank transfer
- `PendingTransfer`: Represents a transfer that couldn't be matched automatically
- `TransferIntentStatus`: Status of a transfer intent
- `PendingTransferStatus`: Status of a pending transfer
- `IntentFilters`: Filters for listing transfer intents
- `PendingTransferFilters`: Filters for listing pending transfers

## Usage

```typescript
import { TransferCodeGenerator } from '@onlemary/payment-core'

// Generate a transfer code
const code = TransferCodeGenerator.generate(123, 500000)
console.log(code) // "GYM-123-20260501-500000"

// Validate a code
const isValid = TransferCodeGenerator.validate(code)
console.log(isValid) // true

// Parse a code
const parsed = TransferCodeGenerator.parse(code)
console.log(parsed) // { orgId: 123, timestamp: '20260501', amount: 500000 }
```

## Testing

The module includes comprehensive unit tests:

```bash
npm test -- TransferCodeGenerator
```

**Test Coverage:**
- Code generation with various inputs
- Validation of valid and invalid codes
- Parsing of codes
- Round-trip integrity (generate → parse)
- Edge cases (min/max values)
- Error handling

## Implementation Status

- [x] TransferCodeGenerator (Task 2.1)
- [ ] TransferIntentStorage (Task 3)
- [ ] PendingTransferStorage (Task 4)
- [ ] TransferWebhookHandler (Task 6)
- [ ] ManualTransferStorage (Task 9)

## Requirements

See `.kiro/specs/mercadopago-transfer-intents/requirements.md` for detailed requirements.

## Design

See `.kiro/specs/mercadopago-transfer-intents/design.md` for detailed design documentation.
