import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { api } from '../api/client';
import type { CitiesResponse, City } from '../api/types';
import { namesCityExactly } from '../lib/location';

interface LocationAutocompleteProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  maxLength?: number;
  ariaInvalid?: boolean;
  /** Extra id(s) to reference from aria-describedby (e.g. an inline error). */
  ariaDescribedBy?: string;
  /** Direction-aware guidance shown under the field. */
  hint?: string;
  /** Example value shown in the empty field (e.g. "Oakland, CA"). */
  placeholder?: string;
}

/**
 * Controlled location input with debounced city suggestions. Free text is always
 * allowed — this is help, not validation — so it never blocks form submission.
 */
export default function LocationAutocomplete({
  id,
  value,
  onChange,
  required,
  maxLength,
  ariaInvalid,
  ariaDescribedBy,
  hint,
  placeholder,
}: LocationAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<City[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);

  const listId = useId();
  const hintId = useId();
  const blurTimer = useRef<number | undefined>(undefined);
  // Set right before a programmatic value change (picking a suggestion) so the
  // fetch effect doesn't immediately reopen the dropdown for the chosen label.
  const skipFetch = useRef(false);
  // Latest value, readable from the async blur resolution without re-binding it.
  const valueRef = useRef(value);
  valueRef.current = value;
  const resolveController = useRef<AbortController | undefined>(undefined);

  useEffect(() => {
    if (skipFetch.current) {
      skipFetch.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setOpen(false);
      setHighlight(-1);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      api<CitiesResponse>(`/api/cities?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((res) => {
          const cities = res.cities ?? [];
          setSuggestions(cities);
          setOpen(cities.length > 0);
          setHighlight(-1);
        })
        .catch(() => {
          // Network error, abort, or empty — treat all as "no suggestions", silently.
        });
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [value]);

  useEffect(
    () => () => {
      window.clearTimeout(blurTimer.current);
      resolveController.current?.abort();
    },
    [],
  );

  /** The missed-dropdown-tap rule, client half (the server enforces the same at
   *  create/edit): leaving the field with text that names exactly one of its
   *  suggestions outright adopts the canonical label — the poster sees "Reno"
   *  become "Reno, NV" instead of finding out from an admin fixing it later.
   *  Named-outright, not suggestion-count: trigram fuzz means "Reno" also
   *  suggests El Reno, OK. Fetches fresh rather than trusting `suggestions`,
   *  which lags the debounce and may belong to an earlier keystroke. */
  function resolveIfUnique(): void {
    const typed = valueRef.current;
    const q = typed.trim();
    if (q.length < 2) return;
    resolveController.current?.abort();
    const controller = new AbortController();
    resolveController.current = controller;
    api<CitiesResponse>(`/api/cities?q=${encodeURIComponent(q)}`, { signal: controller.signal })
      .then((res) => {
        const named = (res.cities ?? []).filter((c) => namesCityExactly(q, c));
        if (named.length !== 1) return;
        const city = named[0]!;
        // The field may have been refocused and edited while this was in
        // flight — never overwrite text the resolution wasn't asked about.
        if (valueRef.current !== typed || city.label === typed) return;
        skipFetch.current = true;
        onChange(city.label);
      })
      .catch(() => {
        // Offline or aborted — the server applies the same rule at post time.
      });
  }

  function pick(city: City): void {
    skipFetch.current = true;
    onChange(city.label);
    setSuggestions([]);
    setOpen(false);
    setHighlight(-1);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (!open || suggestions.length === 0) {
      if (e.key === 'Escape') setOpen(false);
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlight((h) => (h + 1) % suggestions.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlight((h) => (h <= 0 ? suggestions.length - 1 : h - 1));
        break;
      case 'Enter':
        // Only intercept when a suggestion is highlighted — otherwise let the form submit.
        if (highlight >= 0) {
          e.preventDefault();
          pick(suggestions[highlight]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        setHighlight(-1);
        break;
      default:
        break;
    }
  }

  const describedBy = [hintId, ariaDescribedBy].filter(Boolean).join(' ') || undefined;
  const activeOptionId = open && highlight >= 0 ? `${listId}-opt-${highlight}` : undefined;

  return (
    <div className="loc-field">
      <input
        id={id}
        type="text"
        role="combobox"
        required={required}
        maxLength={maxLength}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
        onBlur={() => {
          blurTimer.current = window.setTimeout(() => setOpen(false), 120);
          resolveIfUnique();
        }}
        autoComplete="off"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeOptionId}
        aria-describedby={describedBy}
        aria-invalid={ariaInvalid}
      />
      {open && suggestions.length > 0 && (
        <ul className="loc-suggest" id={listId} role="listbox">
          {suggestions.map((city, i) => (
            <li
              key={`${city.label}-${i}`}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={i === highlight}
              className="loc-suggest-option"
              onMouseDown={(e) => {
                // Keep focus on the input so the click lands before blur closes the list.
                e.preventDefault();
                pick(city);
              }}
              onMouseEnter={() => setHighlight(i)}
            >
              {city.label}
            </li>
          ))}
        </ul>
      )}
      <p id={hintId} className="field-hint">
        {hint ??
          'Your actual city only — the app automatically finds people along your route. Adding anything else (neighborhoods, notes) breaks that matching.'}
      </p>
    </div>
  );
}
