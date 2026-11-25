import { useState } from 'preact/hooks';
import { SiteIcon } from '../../players/ProfileAbout.tsx';
import { QrCode } from '../../components/QrCode.tsx';
import { Checkbox, ColorField, Field, FieldRow, OptionCards, RadioGroup, Select, SettingRow, Slider, SubmitButton, Toggle } from '../../components/ui.tsx';
import { Example, Section } from './parts.tsx';

export const FormsSection = () => {
  const [mode, setMode] = useState('advanced');
  const [color, setColor] = useState('#e3c389');
  const [minutes, setMinutes] = useState(10);
  const [sliderSeconds, setSliderSeconds] = useState(30);
  const [switched, setSwitched] = useState(true);
  const [checked, setChecked] = useState(true);
  const [choice, setChoice] = useState<'white' | 'random' | 'black'>('random');
  const [level, setLevel] = useState(2);
  return (
    <Section id="forms" title="Forms" note="components/ui.tsx">
      <form class="form3 ligungi-ds__form" onSubmit={(e) => e.preventDefault()}>
        <Field label="Field with select and help" htmlFor="ds-mode" help="Help text sits under the control.">
          <Select
            id="ds-mode"
            value={mode}
            options={[
              { value: 'intro', label: 'Introductory' },
              { value: 'advanced', label: 'Advanced' },
            ]}
            onChange={setMode}
          />
        </Field>
        <FieldRow>
          <Field label="FieldRow: left" htmlFor="ds-min">
            <Select id="ds-min" value={minutes} options={[5, 10, 15].map((m) => ({ value: m, label: m }))} onChange={setMinutes} />
          </Field>
          <Field label="FieldRow: right" htmlFor="ds-text">
            <input id="ds-text" class="form-control" placeholder="Text input (.form-control)" />
          </Field>
        </FieldRow>
        <Field
          label={
            <>
              <SiteIcon site="youtube" /> Prefixed input (.ligungi-prefixed): only the end of an address is typed
            </>
          }
          htmlFor="ds-prefixed"
        >
          <div class="ligungi-prefixed">
            <span class="ligungi-prefixed__prefix" aria-hidden="true">
              youtube.com/@
            </span>
            <input id="ds-prefixed" class="form-control" value="gon" readOnly />
          </div>
        </Field>
        <Checkbox id="ds-check" checked={checked} onChange={setChecked} label="Checkbox" help="Optional help, aligned with the label." />
        <Checkbox id="ds-check-off" checked={false} onChange={() => {}} label="Disabled checkbox" disabled />
        <Field label="RadioGroup">
          <RadioGroup
            name="ds-color"
            value={choice}
            options={[
              { value: 'white', label: 'White' },
              { value: 'random', label: 'Random' },
              { value: 'black', label: 'Black' },
            ]}
            onChange={setChoice}
          />
        </Field>
        <SubmitButton>SubmitButton</SubmitButton>
      </form>
      <Example label="Settings rows (SettingRow + Toggle, OptionCards for choices), as on the preferences page">
        <div class="form3" style={{ width: '100%' }}>
          <SettingRow title="Toggle setting" help="Simple on or off settings use a switch; the title toggles it too." htmlFor="ds-switch">
            <Toggle id="ds-switch" checked={switched} onChange={setSwitched} label="Toggle setting" />
          </SettingRow>
          <div class="ligungi-setting">
            <OptionCards
              name="ds-stacked"
              legend="Choice setting"
              layout="segmented"
              value={choice}
              options={[
                { value: 'white', label: 'White' },
                { value: 'random', label: 'Random' },
                { value: 'black', label: 'Black' },
              ]}
              onChange={setChoice}
              help="A choice among a few options is a segmented OptionCards in a .ligungi-setting row."
            />
          </div>
        </div>
      </Example>
      <Example label="Slider: a value from a list (not a numeric range), label and value on one row; arrow keys step through the list">
        <div class="form3" style={{ display: 'grid', gap: '0.75rem', width: '100%', maxWidth: '30rem' }}>
          <Slider id="ds-slider-minutes" label="Minutes" values={[1, 2, 3, 5, 10, 15, 20, 30, 45, 60, 90, 120, 180]} value={minutes} onChange={setMinutes} />
          <Slider id="ds-slider-seconds" label="Seconds per move" values={[10, 20, 30, 60]} value={sliderSeconds} format={(s) => `${s} s`} onChange={setSliderSeconds} />
        </div>
      </Example>
      <Example label="OptionCards: one choice among a few, as cards (layout cards, row or segmented); cards stack on phones">
        <div style={{ display: 'grid', gap: '1.25rem', width: '100%' }}>
          <OptionCards
            name="ds-cards"
            legend="Level"
            value={level}
            options={[1, 2, 3].map((n) => ({ value: n, badge: n, label: ['Random', 'Greedy', 'Careful'][n - 1]!, hint: 'One line of help.' }))}
            onChange={setLevel}
          />
          <OptionCards
            name="ds-row"
            legend="Your colour"
            layout="row"
            value={choice}
            options={(['white', 'random', 'black'] as const).map((value) => ({
              value,
              label: value,
              icon: <span class={`ligungi-choice__disc ligungi-choice__disc--${value}`} aria-hidden="true" />,
            }))}
            onChange={setChoice}
          />
          <OptionCards
            name="ds-segmented"
            legend="Mode"
            layout="segmented"
            value={mode}
            options={['intro', 'beginner', 'intermediate', 'advanced'].map((value) => ({ value, label: value }))}
            onChange={setMode}
          />
        </div>
      </Example>
      <Example label="ColorField, and .ligungi-warnings for things worth fixing that are not errors">
        <div class="ligungi-custom-board">
          <FieldRow>
            <ColorField id="ds-color" label="Board color" value={color} onChange={setColor} />
          </FieldRow>
          <ul class="ligungi-warnings">
            <li>Lines and coordinates are hard to see.</li>
          </ul>
        </div>
      </Example>
      <Example label="Two-step verification (account page): QrCode, a code field, recovery codes">
        <div class="ligungi-two-factor__setup">
          <QrCode text="otpauth://totp/ligungi:Example?secret=JBSWY3DPEHPK3PXP&issuer=ligungi" label="QR code example" />
          <div class="form3">
            <p class="ligungi-two-factor__key">
              Key: <code>JBSW Y3DP EHPK 3PXP</code>
            </p>
            <Field label="Code from the app" htmlFor="ds-code" help="Monospaced, with one-time-code autocomplete.">
              <input id="ds-code" class="form-control ligungi-code-input" autoComplete="one-time-code" value="123 456" readOnly />
            </Field>
            <ol class="ligungi-recovery__codes">
              {['kmpei-7uyqm', 'sfeg3-pead2', 'wwzr3-pw374', '6gdzu-6dydt'].map((code) => (
                <li key={code}>
                  <code>{code}</code>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Example>
    </Section>
  );
};
