import type { ComponentChildren } from 'preact';

export const Section = ({ id, title, note, children }: { id: string; title: string; note?: string; children: ComponentChildren }) => (
  <section id={id} class="ligungi-ds__section">
    <h2>{title}</h2>
    {note && <p class="ligungi-notice">{note}</p>}
    {children}
  </section>
);

export const Example = ({ label, children }: { label: string; children: ComponentChildren }) => (
  <div class="ligungi-ds__example">
    <span class="ligungi-ds__label">{label}</span>
    <div class="ligungi-ds__demo">{children}</div>
  </div>
);
