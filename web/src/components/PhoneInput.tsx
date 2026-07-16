import { useMemo } from 'react';

// Ordered longest-code-first so value parsing picks the most specific match.
const COUNTRY_CODES = [
  { code: '+972', label: '🇮🇱 +972' },
  { code: '+44', label: '🇬🇧 +44' },
  { code: '+49', label: '🇩🇪 +49' },
  { code: '+33', label: '🇫🇷 +33' },
  { code: '+34', label: '🇪🇸 +34' },
  { code: '+31', label: '🇳🇱 +31' },
  { code: '+61', label: '🇦🇺 +61' },
  { code: '+64', label: '🇳🇿 +64' },
  { code: '+52', label: '🇲🇽 +52' },
  { code: '+55', label: '🇧🇷 +55' },
  { code: '+81', label: '🇯🇵 +81' },
  { code: '+1', label: '🇺🇸 +1' },
];
const DEFAULT_CODE = '+1';

function splitValue(value: string): { code: string; national: string } {
  if (value.startsWith('+')) {
    const match = COUNTRY_CODES.find((c) => value.startsWith(c.code));
    if (match) return { code: match.code, national: value.slice(match.code.length) };
    // Unknown country code: keep digits editable under the default prefix.
    return { code: DEFAULT_CODE, national: value.replace(/\D/g, '') };
  }
  return { code: DEFAULT_CODE, national: value.replace(/\D/g, '') };
}

interface PhoneInputProps {
  id?: string;
  value: string;
  onChange: (full: string) => void;
  required?: boolean;
  disabled?: boolean;
  ariaDescribedBy?: string;
}

/** International phone entry: country-code select (+1 default) + national number.
 *  Emits E.164-style strings ('+15550100') or '' when the number part is empty. */
export default function PhoneInput({ id, value, onChange, required, disabled, ariaDescribedBy }: PhoneInputProps) {
  const { code, national } = useMemo(() => splitValue(value), [value]);

  function emit(nextCode: string, nextNational: string): void {
    const digits = nextNational.replace(/\D/g, '');
    onChange(digits === '' ? '' : `${nextCode}${digits}`);
  }

  return (
    <div className="phone-input">
      <select
        aria-label="Country code"
        value={code}
        disabled={disabled}
        onChange={(e) => emit(e.target.value, national)}
      >
        {[...COUNTRY_CODES]
          .sort((a, b) => Number(a.code.slice(1)) - Number(b.code.slice(1)))
          .map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
      </select>
      <input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="555 010 9999"
        value={national}
        required={required}
        disabled={disabled}
        aria-describedby={ariaDescribedBy}
        onChange={(e) => emit(code, e.target.value)}
      />
    </div>
  );
}
