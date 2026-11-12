import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import { useT } from '../i18n/index.ts';

export const Modal = ({ title, onClose, children }: { title: string; onClose: () => void; children: ComponentChildren }) => {
  const t = useT();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div class="ligungi-modal" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div class="ligungi-modal__box box" role="dialog" aria-modal="true" aria-label={title}>
        <div class="close-button-anchor">
          <button type="button" class="close-button" aria-label={t.common.close} data-icon={'\ue02a'} onClick={onClose} />
        </div>
        <div class="dialog-content">
          <h2>{title}</h2>
          {children}
        </div>
      </div>
    </div>
  );
};
