import type { FormField } from '@ptw/shared';

interface Props {
  field: FormField;
  value: unknown;
  onChange: (v: unknown) => void;
  error?: string;
}

export function FormFieldInput({ field, value, onChange, error }: Props) {
  return (
    <div className="field">
      <label className="label">
        {field.labelHe}
        {field.required && <span className="required">*</span>}
      </label>
      {field.helpHe && <div className="help" style={{ marginTop: 0, marginBottom: 6 }}>{field.helpHe}</div>}
      {renderInput(field, value, onChange)}
      {error && <div className="error-text">{error}</div>}
    </div>
  );
}

function renderInput(f: FormField, value: unknown, onChange: (v: unknown) => void) {
  switch (f.type) {
    case 'datetime':
      return (
        <input
          className="input"
          type="datetime-local"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'date_range': {
      const v = (value as { start: string; end: string }) ?? { start: '', end: '' };
      return (
        <div className="field-row">
          <input
            className="input"
            type="date"
            value={v.start}
            onChange={(e) => onChange({ ...v, start: e.target.value })}
          />
          <input
            className="input"
            type="date"
            value={v.end}
            onChange={(e) => onChange({ ...v, end: e.target.value })}
          />
        </div>
      );
    }
    case 'short_text':
      return (
        <input
          className="input"
          type="text"
          maxLength={f.maxLength}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'long_text':
      return (
        <textarea
          className="textarea"
          maxLength={f.maxLength}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'email':
      return (
        <input
          className="input"
          type="email"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'phone': {
      const v = (value as { countryCode?: string; number?: string }) ?? {};
      return (
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="input"
            style={{ width: 90 }}
            value={v.countryCode ?? '+972'}
            onChange={(e) => onChange({ ...v, countryCode: e.target.value })}
          />
          <input
            className="input"
            type="tel"
            value={v.number ?? ''}
            onChange={(e) => onChange({ ...v, number: e.target.value })}
          />
        </div>
      );
    }
    case 'radio_yes_no':
      return (
        <div style={{ display: 'flex', gap: 16 }}>
          <label>
            <input
              type="radio"
              name={f.id}
              checked={value === 'yes'}
              onChange={() => onChange('yes')}
            /> כן
          </label>
          <label>
            <input
              type="radio"
              name={f.id}
              checked={value === 'no'}
              onChange={() => onChange('no')}
            /> לא
          </label>
        </div>
      );
    case 'dropdown': {
      const opts = f.options ?? [];
      if (opts.length === 0) {
        return (
          <input
            className="input"
            placeholder="(אין אופציות מסונכרנות מתבל - הזן ידנית)"
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
          />
        );
      }
      return (
        <select
          className="select"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">בחר…</option>
          {opts.map((o) => (
            <option key={o.value} value={o.value}>{o.labelHe}</option>
          ))}
        </select>
      );
    }
    case 'multi_select': {
      const arr = (value as string[]) ?? [];
      const opts = f.options ?? [];
      if (opts.length === 0) {
        return (
          <input
            className="input"
            placeholder="(הפרד אופציות בפסיק - אין אופציות מסונכרנות)"
            value={arr.join(', ')}
            onChange={(e) => onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
          />
        );
      }
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {opts.map((o) => (
            <label key={o.value}>
              <input
                type="checkbox"
                checked={arr.includes(o.value)}
                onChange={(e) =>
                  onChange(
                    e.target.checked ? [...arr, o.value] : arr.filter((x) => x !== o.value),
                  )
                }
              /> {o.labelHe}
            </label>
          ))}
        </div>
      );
    }
    case 'checkbox_group': {
      const arr = (value as string[]) ?? [];
      const opts = f.options ?? [];
      return (
        <div style={{ display: 'flex', gap: 16 }}>
          {opts.map((o) => (
            <label key={o.value}>
              <input
                type="checkbox"
                checked={arr.includes(o.value)}
                onChange={(e) =>
                  onChange(
                    e.target.checked ? [...arr, o.value] : arr.filter((x) => x !== o.value),
                  )
                }
              /> {o.labelHe}
            </label>
          ))}
        </div>
      );
    }
    case 'signature_name':
      return (
        <input
          className="input"
          type="text"
          maxLength={f.maxLength ?? 30}
          placeholder="שם מלא לחתימה"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'file':
      return (
        <div className="help">
          קבצים מצורפים מנוהלים בעמוד פרטי הבקשה לאחר השמירה.
        </div>
      );
  }
}
