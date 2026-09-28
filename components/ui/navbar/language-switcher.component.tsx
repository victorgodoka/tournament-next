'use client';

import Button from '@ui/button';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

/** Mesmo nome lido por `i18n/request.ts`. */
const LOCALE_COOKIE = 'NEXT_LOCALE';
const ONE_YEAR = 60 * 60 * 24 * 365;

export const LanguageSwitcher = () => {
  const router = useRouter();
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  const handleSwitch = (nextLocale: string) => {
    document.cookie = `${LOCALE_COOKIE}=${nextLocale};path=/;max-age=${ONE_YEAR};samesite=lax`;
    // Sem prefixo de locale na URL: o idioma vem do cookie, então basta re-renderizar no servidor.
    startTransition(() => router.refresh());
  };

  return (
    <div className="flex gap-2">
      <Button
        disabled={isPending}
        size="mono"
        aria-pressed={locale === 'en'}
        variant={locale === 'en' ? 'secondary' : 'ghost'}
        onClick={() => handleSwitch('en')}
      >
        EN
      </Button>
      <Button
        disabled={isPending}
        size="mono"
        aria-pressed={locale === 'pt'}
        variant={locale === 'pt' ? 'secondary' : 'ghost'}
        onClick={() => handleSwitch('pt')}
      >
        PT
      </Button>
    </div>
  )
}
