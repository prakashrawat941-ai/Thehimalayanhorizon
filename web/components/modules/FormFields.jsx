'use client';
import { Field, Input, Select, Textarea } from '@/components/ui';
import { ERRORS, tr } from '@/lib/modules/labels';
import { optionsOf } from '@/lib/modules/entities';

/** Renders a field spec list. Values are plain strings, numbers or File objects (for file fields). */
export function FormFields({ fields, values, errors = {}, onChange, lang = 'en', disabled = false }) {
  const t = tr(lang);
  const set = (k, v) => onChange({ ...values, [k]: v });
  return (
    <div className="ui-form-grid">
      {fields.map((f) => {
        if (f.when && !f.when(values)) return null;
        const err = errors[f.key] ? t(ERRORS[errors[f.key]] || ERRORS.required) : undefined;
        const hint = f.hint ? t(f.hint) : undefined;
        const common = { name: f.key, disabled: disabled || f.readOnly, readOnly: f.readOnly || undefined };
        let control;
        if (f.type === 'textarea') {
          control = <Textarea {...common} rows={4} maxLength={f.maxLength} value={values[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} />;
        } else if (f.type === 'select') {
          control = (
            <Select {...common} value={values[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)}>
              <option value="">{lang === 'hi' ? 'चुनें' : 'Choose'}</option>
              {optionsOf(f.options).map((o) => <option key={o.value} value={o.value}>{t(o.label)}</option>)}
            </Select>
          );
        } else if (f.type === 'file') {
          control = <Input {...common} type="file" accept={f.accept} onChange={(e) => set(f.key, e.target.files?.[0] || null)} />;
        } else {
          const type = { email: 'email', phone: 'tel', number: 'number', money: 'text', date: 'date', time: 'time' }[f.type] || 'text';
          control = (
            <Input
              {...common}
              type={type}
              inputMode={f.type === 'money' ? 'decimal' : f.type === 'phone' ? 'tel' : undefined}
              min={f.type === 'number' ? f.min : undefined}
              max={f.type === 'number' ? f.max : undefined}
              maxLength={['text', 'email', undefined].includes(f.type) ? f.maxLength : undefined}
              autoComplete={f.type === 'email' ? 'email' : f.type === 'phone' ? 'tel' : 'off'}
              value={values[f.key] ?? ''}
              onChange={(e) => set(f.key, e.target.value)}
            />
          );
        }
        return (
          <Field key={f.key} label={t(f.label)} hint={hint} error={err} required={!!f.required} className={f.type === 'textarea' ? 'ui-span-2' : undefined}>
            {control}
          </Field>
        );
      })}
    </div>
  );
}

/** Copy of values safe to store or send as JSON: File objects become their names. */
export function serialisable(values) {
  const out = {};
  for (const [k, v] of Object.entries(values || {})) {
    if (typeof File !== 'undefined' && v instanceof File) out[k] = v.name;
    else if (v && typeof v === 'object' && 'name' in v && 'size' in v) out[k] = v.name;
    else out[k] = v;
  }
  return out;
}
