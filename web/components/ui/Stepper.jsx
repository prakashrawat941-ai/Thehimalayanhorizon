import { cx } from './cx';
import { UiIcon } from './icons';

/**
 * Progress through a flow. steps: [{ key, label }]; `current` is the active key.
 * Uses an ordered list with aria-current="step"; state is also written as text for screen readers.
 */
export function Stepper({ steps, current, labels = {}, className }) {
  const l = { done: 'completed', current: 'current step', todo: 'not started', nav: 'Progress', ...labels };
  const idx = Math.max(0, steps.findIndex((s) => s.key === current));
  return (
    <ol className={cx('ui-stepper', className)} aria-label={l.nav}>
      {steps.map((s, i) => {
        const state = i < idx ? 'done' : i === idx ? 'current' : 'todo';
        return (
          <li key={s.key} className={cx('ui-step', `is-${state}`)} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="ui-step-dot" aria-hidden="true">{state === 'done' ? <UiIcon name="check" size={14} /> : i + 1}</span>
            <span className="ui-step-label">{s.label}<span className="ui-sr-only"> ({l[state]})</span></span>
          </li>
        );
      })}
    </ol>
  );
}
