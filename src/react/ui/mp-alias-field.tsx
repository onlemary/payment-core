'use client'

import type { InputHTMLAttributes } from 'react'

export interface MpAliasFieldProps {
  value?: string
  onChange?: (value: string) => void
  inputProps?: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>
}

export function MpAliasField({ value, onChange, inputProps }: MpAliasFieldProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
        Alias o CVU de MercadoPago
      </label>
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder="Ej: mp.alias.ejemplo"
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        {...inputProps}
      />
      <p className="text-xs text-muted-foreground">
        Cuando un miembro paga con este alias, el sistema le da un código
        (ej: GYM-123-20260515-50000) que tiene que escribir en el concepto
        de la transferencia. Después MercadoPago nos avisa, y si el código
        y el monto coinciden, se marca como pagado automáticamente. Si no
        coinciden, queda pendiente para que lo revises.
      </p>
    </div>
  )
}
