import { useMemo } from 'react'
import { currencyOptions, detectUserCurrency } from '../lib/currency'
import { SelectField } from './ui'

export function CurrencySelect({ value, onChange, hint }: { value: string; onChange: (code: string) => void; hint?: string }) {
  const options = useMemo(() => currencyOptions(), [])
  const detected = useMemo(() => detectUserCurrency(), [])
  return (
    <SelectField label="Your currency" hint={hint} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o.code} value={o.code}>
          {o.name} ({o.code}){o.code === detected ? ' · detected' : ''}
        </option>
      ))}
    </SelectField>
  )
}
