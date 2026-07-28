/**
 * @kernel/application-runtime/localization — locale resolver.
 *
 * Resolves the default locale + supported locales from the manifest. The host
 * application layer loads the resource bundle via `resourceBundleRef`.
 */

import type { LocaleDeclaration } from "../applications/application-manifest";

export interface ResolvedLocalization {
  readonly defaultLocale?: string;
  readonly supportedLocales: readonly LocaleDeclaration[];
}

export function resolveLocalization(locales: readonly LocaleDeclaration[]): ResolvedLocalization {
  const defaultLocale = locales.find((l) => l.default)?.code;
  return { defaultLocale, supportedLocales: locales };
}
