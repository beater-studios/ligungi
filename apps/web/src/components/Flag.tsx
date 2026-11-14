import type { Country } from '@ligungi/protocol';
import { flagUrl } from '../flags.ts';
import { countryName, useT } from '../i18n/index.ts';

/** A country's flag, named for screen readers and on hover. */
export const Flag = ({ country }: { country: Country | null }) => {
  const t = useT();
  const url = country ? flagUrl(country) : undefined;
  if (!country || !url) return null;
  const name = countryName(t, country);
  return <img class="ligungi-flag" src={url} alt={name} title={name} width={20} height={15} loading="lazy" decoding="async" />;
};
