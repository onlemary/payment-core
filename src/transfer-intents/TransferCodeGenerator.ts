/**
 * TransferCodeGenerator - Generates and validates unique transfer codes
 * 
 * Transfer codes are used to identify payments in bank transfer concepts.
 * Format: GYM-{orgId}-{YYYYMMDD}-{amount}
 * Example: GYM-123-20260501-500000
 * 
 * Components:
 * - GYM: Fixed prefix
 * - orgId: Numeric organization ID (1-999999)
 * - timestamp: Date in YYYYMMDD format
 * - amount: Amount in cents (positive integer)
 */

/**
 * Parsed transfer code components
 */
export interface ParsedTransferCode {
  /** Numeric organization ID */
  orgId: number
  /** Date in YYYYMMDD format */
  timestamp: string
  /** Amount in cents */
  amount: number
}

/**
 * Static utility class for transfer code operations
 */
export class TransferCodeGenerator {
  /**
   * Regex pattern for validating transfer codes
   * Format: GYM-{orgId}-{YYYYMMDD}-{amount}
   * 
   * - GYM: Fixed prefix
   * - orgId: 1-6 digits (1-999999)
   * - timestamp: Exactly 8 digits (YYYYMMDD)
   * - amount: 1+ digits (positive integer)
   */
  private static readonly CODE_PATTERN = /^GYM-(\d{1,6})-(\d{8})-(\d+)$/

  /**
   * Generate a unique transfer code
   * 
   * @param orgId - Numeric organization ID (1-999999)
   * @param amount - Amount in cents (positive integer)
   * @returns Transfer code in format GYM-{orgId}-{YYYYMMDD}-{amount}
   * 
   * @throws Error if orgId is invalid (not in range 1-999999)
   * @throws Error if amount is invalid (not positive)
   * 
   * @example
   * ```typescript
   * const code = TransferCodeGenerator.generate(123, 500000)
   * // Returns: "GYM-123-20260501-500000"
   * ```
   */
  static generate(orgId: number, amount: number): string {
    // Validate orgId
    if (!Number.isInteger(orgId) || orgId < 1 || orgId > 999999) {
      throw new Error('orgId must be an integer between 1 and 999999')
    }

    // Validate amount
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error('amount must be a positive integer')
    }

    // Generate timestamp in YYYYMMDD format
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const timestamp = `${year}${month}${day}`

    // Construct transfer code
    return `GYM-${orgId}-${timestamp}-${amount}`
  }

  /**
   * Validate that a code matches the transfer code format
   * 
   * @param code - Code to validate
   * @returns true if code matches format, false otherwise
   * 
   * @example
   * ```typescript
   * TransferCodeGenerator.validate('GYM-123-20260501-500000') // true
   * TransferCodeGenerator.validate('INVALID-CODE') // false
   * TransferCodeGenerator.validate('GYM-0-20260501-500000') // false (orgId must be >= 1)
   * ```
   */
  static validate(code: string): boolean {
    if (!code || typeof code !== 'string') {
      return false
    }

    const match = code.match(this.CODE_PATTERN)
    if (!match) {
      return false
    }

    const [, orgIdStr, timestamp, amountStr] = match

    // Validate orgId is in valid range
    const orgId = parseInt(orgIdStr, 10)
    if (orgId < 1 || orgId > 999999) {
      return false
    }

    // Validate timestamp is a valid date
    if (!this.isValidTimestamp(timestamp)) {
      return false
    }

    // Validate amount is positive
    const amount = parseInt(amountStr, 10)
    if (amount <= 0) {
      return false
    }

    return true
  }

  /**
   * Parse a transfer code and extract its components
   * 
   * @param code - Transfer code to parse
   * @returns Parsed components or null if code is invalid
   * 
   * @example
   * ```typescript
   * const parsed = TransferCodeGenerator.parse('GYM-123-20260501-500000')
   * // Returns: { orgId: 123, timestamp: '20260501', amount: 500000 }
   * 
   * const invalid = TransferCodeGenerator.parse('INVALID-CODE')
   * // Returns: null
   * ```
   */
  static parse(code: string): ParsedTransferCode | null {
    if (!this.validate(code)) {
      return null
    }

    const match = code.match(this.CODE_PATTERN)
    if (!match) {
      return null
    }

    const [, orgIdStr, timestamp, amountStr] = match

    return {
      orgId: parseInt(orgIdStr, 10),
      timestamp,
      amount: parseInt(amountStr, 10),
    }
  }

  /**
   * Validate that a timestamp string is a valid date in YYYYMMDD format
   * 
   * @param timestamp - Timestamp string to validate (YYYYMMDD)
   * @returns true if timestamp is valid, false otherwise
   * 
   * @private
   */
  private static isValidTimestamp(timestamp: string): boolean {
    if (timestamp.length !== 8) {
      return false
    }

    const year = parseInt(timestamp.substring(0, 4), 10)
    const month = parseInt(timestamp.substring(4, 6), 10)
    const day = parseInt(timestamp.substring(6, 8), 10)

    // Basic validation
    if (year < 1900 || year > 2100) {
      return false
    }

    if (month < 1 || month > 12) {
      return false
    }

    if (day < 1 || day > 31) {
      return false
    }

    // Validate the date is actually valid (e.g., not Feb 31)
    const date = new Date(year, month - 1, day)
    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    )
  }
}
