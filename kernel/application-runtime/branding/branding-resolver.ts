/**
 * @kernel/application-runtime/branding — branding resolver.
 *
 * Branding never changes protocol behavior. The resolver produces a flat
 * `ResolvedBranding` the host application layer renders from. The kernel does
 * NOT interpret theme colors — it only records + resolves them.
 */

import type { ApplicationBranding, BrandingTheme } from "../applications/application-manifest";

export interface ResolvedBranding {
  readonly displayName: string;
  readonly tagline?: string;
  readonly theme: BrandingTheme;
  readonly logoUrl?: string;
  readonly faviconUrl?: string;
  readonly iconUrl?: string;
  readonly ogImageUrl?: string;
  readonly titleTemplate: string;
  readonly landingPageRef?: string;
  readonly emailTemplates: readonly { name: string; subjectTemplate: string; bodyTemplateRef: string }[];
  readonly metadata: Readonly<Record<string, string>>;
}

const DEFAULT_THEME: BrandingTheme = {
  primary: "#0f172a",
  secondary: "#475569",
  accent: "#0ea5e9",
  background: "#ffffff",
  surface: "#f8fafc",
  text: "#0f172a",
  textMuted: "#64748b",
  mode: "light",
};

const DEFAULT_TITLE_TEMPLATE = "{{displayName}}";

export function resolveBranding(branding: ApplicationBranding): ResolvedBranding {
  return {
    displayName: branding.displayName,
    tagline: branding.tagline,
    theme: { ...DEFAULT_THEME, ...branding.theme },
    logoUrl: branding.assets.logoUrl,
    faviconUrl: branding.assets.faviconUrl,
    iconUrl: branding.assets.iconUrl,
    ogImageUrl: branding.assets.ogImageUrl,
    titleTemplate: branding.titleTemplate ?? DEFAULT_TITLE_TEMPLATE,
    landingPageRef: branding.landingPageRef,
    emailTemplates: branding.emailTemplates,
    metadata: branding.metadata,
  };
}
