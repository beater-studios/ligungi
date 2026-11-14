import type { ComponentChildren } from 'preact';

/**
 * Shared form building blocks. Every screen uses these instead of raw markup, so spacing, alignment and states
 * stay consistent. They render lila's form classes plus ligungi's own (see the design system page at /design).
 */

interface FieldProps {
  readonly label?: ComponentChildren;
  /** Id of the control the label points to. Without it the label is plain text (for option groups). */
  readonly htmlFor?: string;
  readonly help?: ComponentChildren;
  readonly children: ComponentChildren;
}

export const Field = ({ label, htmlFor, help, children }: FieldProps) => (
  <div class="form-group ligungi-field">
    {label !== undefined &&
      (htmlFor ? (
        <label class="form-label" for={htmlFor}>
          {label}
        </label>
      ) : (
        <span class="form-label">{label}</span>
      ))}
    {children}
    {help !== undefined && <small class="form-help">{help}</small>}
  </div>
);

export const FieldRow = ({ children }: { children: ComponentChildren }) => <div class="ligungi-field-row">{children}</div>;

export interface Option<T> {
  readonly value: T;
  readonly label: ComponentChildren;
  readonly disabled?: boolean;
  readonly title?: string;
}

interface SelectProps<T> {
  readonly id?: string;
  readonly value: T;
  readonly options: readonly Option<T>[];
  readonly onChange: (value: T) => void;
  readonly ariaLabel?: string;
}

export const Select = <T,>({ id, value, options, onChange, ariaLabel }: SelectProps<T>) => (
  <select
    id={id}
    class="form-control ligungi-select"
    aria-label={ariaLabel}
    value={String(value)}
    onChange={(event) => {
      const selected = options.find((option) => String(option.value) === (event.target as HTMLSelectElement).value);
      if (selected) onChange(selected.value);
    }}
  >
    {options.map((option) => (
      <option key={String(option.value)} value={String(option.value)} disabled={option.disabled}>
        {option.label}
      </option>
    ))}
  </select>
);

interface CheckboxProps {
  readonly id: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly label: ComponentChildren;
  readonly help?: ComponentChildren;
  readonly disabled?: boolean;
  readonly title?: string;
}

export const Checkbox = ({ id, checked, onChange, label, help, disabled = false, title }: CheckboxProps) => (
  <div class={`form-group ligungi-check${disabled ? ' is-disabled' : ''}`} title={title}>
    <input
      type="checkbox"
      id={id}
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange((event.target as HTMLInputElement).checked)}
    />
    <label for={id}>{label}</label>
    {help !== undefined && <small class="form-help">{help}</small>}
  </div>
);

interface RadioGroupProps<T> {
  /** Shared `name` of the inputs, also the prefix of their ids (`${name}-${value}`). */
  readonly name: string;
  readonly value: T;
  readonly options: readonly Option<T>[];
  readonly onChange: (value: T) => void;
}

export const RadioGroup = <T,>({ name, value, options, onChange }: RadioGroupProps<T>) => (
  <group class="radio">
    {options.map((option) => {
      const id = `${name}-${String(option.value)}`;
      return (
        <div key={id} title={option.title}>
          <input
            type="radio"
            id={id}
            name={name}
            checked={option.value === value}
            disabled={option.disabled}
            onChange={() => onChange(option.value)}
          />
          <label for={id}>{option.label}</label>
        </div>
      );
    })}
  </group>
);

export interface CardOption<T> extends Option<T> {
  /** Big text over the label, such as a level number. */
  readonly badge?: ComponentChildren;
  readonly icon?: ComponentChildren;
  /** One line under the label. */
  readonly hint?: ComponentChildren;
}

interface OptionCardsProps<T> {
  /** Shared `name` of the inputs, also the prefix of their ids (`${name}-${value}`). */
  readonly name: string;
  readonly legend: ComponentChildren;
  readonly value: T;
  readonly options: readonly CardOption<T>[];
  readonly onChange: (value: T) => void;
  readonly help?: ComponentChildren;
  /** `cards` stack into rows on phones, `row` stays side by side, `segmented` is a compact switch. */
  readonly layout?: 'cards' | 'row' | 'segmented';
}

/** One choice among a few, as cards: native radio inputs, so the keyboard and screen readers treat it as a group. */
export const OptionCards = <T,>({ name, legend, value, options, onChange, help, layout = 'cards' }: OptionCardsProps<T>) => (
  <fieldset class={`ligungi-choice ligungi-choice--${layout}`}>
    <legend class="ligungi-choice__legend">{legend}</legend>
    <div class="ligungi-choice__options">
      {options.map((option) => {
        const id = `${name}-${String(option.value)}`;
        const checked = option.value === value;
        return (
          <label
            key={id}
            for={id}
            class={`ligungi-choice__option${checked ? ' is-checked' : ''}${option.disabled ? ' is-disabled' : ''}`}
            title={option.title}
          >
            <input
              class="ligungi-choice__input"
              type="radio"
              id={id}
              name={name}
              checked={checked}
              disabled={option.disabled}
              onChange={() => onChange(option.value)}
            />
            {option.badge !== undefined && <span class="ligungi-choice__badge">{option.badge}</span>}
            {option.icon}
            <span class="ligungi-choice__text">
              <span class="ligungi-choice__label">{option.label}</span>
              {option.hint !== undefined && <span class="ligungi-choice__hint">{option.hint}</span>}
            </span>
          </label>
        );
      })}
    </div>
    {help !== undefined && <small class="form-help">{help}</small>}
  </fieldset>
);

export const SubmitButton = ({ children, disabled = false }: { children: ComponentChildren; disabled?: boolean }) => (
  <div class="ligungi-actions">
    <button type="submit" class="button ligungi-submit" disabled={disabled}>
      {children}
    </button>
  </div>
);

interface ToggleProps {
  readonly id: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  /** Accessible name; the visible label is usually a `SettingRow` title pointing at `id`. */
  readonly label: string;
  readonly disabled?: boolean;
}

/** On/off switch (lila's cmn-toggle) for settings that are simply on or off. */
export const Toggle = ({ id, checked, onChange, label, disabled = false }: ToggleProps) => (
  <span class="cmn-toggle">
    <input
      type="checkbox"
      role="switch"
      id={id}
      checked={checked}
      disabled={disabled}
      aria-label={label}
      onChange={(event) => onChange((event.target as HTMLInputElement).checked)}
    />
    <label for={id} title={label} />
  </span>
);

interface SettingRowProps {
  readonly title: ComponentChildren;
  readonly help?: ComponentChildren;
  /** Id of the control, so the title also toggles it (switches). */
  readonly htmlFor?: string;
  /** Puts the control under the text, for wide controls such as option groups. */
  readonly stacked?: boolean;
  readonly children: ComponentChildren;
}

/** One setting: its name and a short explanation, with the control beside them (or below, when `stacked`). */
export const SettingRow = ({ title, help, htmlFor, stacked = false, children }: SettingRowProps) => (
  <div class={`ligungi-setting${stacked ? ' ligungi-setting--stacked' : ''}`}>
    <div class="ligungi-setting__text">
      {htmlFor ? (
        <label class="ligungi-setting__title" for={htmlFor}>
          {title}
        </label>
      ) : (
        <span class="ligungi-setting__title">{title}</span>
      )}
      {help !== undefined && <small class="ligungi-setting__help">{help}</small>}
    </div>
    <div class="ligungi-setting__control">{children}</div>
  </div>
);
