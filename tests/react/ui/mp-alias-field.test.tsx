/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MpAliasField } from '../../../src/react/ui/mp-alias-field'

describe('MpAliasField', () => {
  it('renders with label and help text', () => {
    render(<MpAliasField />)
    expect(screen.getByText('Alias o CVU de MercadoPago')).toBeDefined()
    expect(screen.getByText(/Cuando un miembro paga con este alias/)).toBeDefined()
  })

  it('shows current value', () => {
    render(<MpAliasField value="mp.test.alias" />)
    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(input.value).toBe('mp.test.alias')
  })

  it('calls onChange when user types', () => {
    const onChange = vi.fn()
    render(<MpAliasField value="" onChange={onChange} />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'nuevo.alias' } })
    expect(onChange).toHaveBeenCalledWith('nuevo.alias')
  })
})
