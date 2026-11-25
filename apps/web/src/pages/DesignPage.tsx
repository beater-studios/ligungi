import { RadioGroup } from '../components/ui.tsx';
import { prefs, updatePrefs } from '../prefs/prefs.ts';
import { useStore } from '../core/store.ts';
import { PrinciplesSection } from './design/Principles.tsx';
import { ColorsSection } from './design/Colors.tsx';
import { TypographySection } from './design/Typography.tsx';
import { ButtonsSection } from './design/Buttons.tsx';
import { FormsSection } from './design/Forms.tsx';
import { FeedbackSection } from './design/Feedback.tsx';
import { PageBlocksSection } from './design/PageBlocks.tsx';
import { DataSection } from './design/Data.tsx';
import { GameSection } from './design/Game.tsx';

/**
 * Living reference of ligungi's UI: real components rendered with the real styles. Developer-facing, so it is in
 * English and not linked from the menus. Open /design while building a screen and reuse what is here.
 */
export const DesignPage = () => {
  const { theme } = useStore(prefs);
  const sections = [
    ['principles', 'Principles'],
    ['colors', 'Colors'],
    ['type', 'Typography'],
    ['buttons', 'Buttons'],
    ['forms', 'Forms'],
    ['feedback', 'Feedback'],
    ['pages', 'Page blocks'],
    ['data', 'Data'],
    ['game', 'Game'],
  ];

  return (
    <main class="page-menu ligungi-ds">
      <nav class="page-menu__menu subnav">
        {sections.map(([id, label]) => (
          <a key={id} href={`#${id}`} onClick={(e) => (e.preventDefault(), document.getElementById(id!)?.scrollIntoView({ behavior: 'smooth' }))}>
            {label}
          </a>
        ))}
      </nav>
      <div class="page-menu__content box box-pad">
        <div class="ligungi-ds__top">
          <h1 class="box__top">Design system</h1>
          <RadioGroup
            name="ds-theme"
            value={theme}
            options={(['light', 'dark', 'auto'] as const).map((value) => ({ value, label: value[0]!.toUpperCase() + value.slice(1) }))}
            onChange={(value) => updatePrefs({ theme: value })}
          />
        </div>

        <PrinciplesSection />
        <ColorsSection />
        <TypographySection />
        <ButtonsSection />
        <FormsSection />
        <FeedbackSection />
        <PageBlocksSection />
        <DataSection />
        <GameSection />
      </div>
    </main>
  );
};
