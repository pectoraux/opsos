/**
 * Cleaning Applications — branding + configuration only.
 *
 * Each application is merely: branding, configuration, permissions, feature
 * flags, routing, tenant configuration. No duplicated business logic.
 *
 * Built using defineApplication() from @kernel/api/v1.
 */

import { defineApplication } from "@kernel/api/v1";
import { asId } from "@kernel/api/v1";

const NOW = 1700000000000;

// ── Eks-Clean Application ───────────────────────────────────────────────────

export const eksCleanApp = defineApplication({
  id: "eks-clean",
  name: "eks-clean",
  displayName: "Eks-Clean",
  description: "Eks-Clean — residential cleaning service. Powered by the Residential Cleaning Protocol.",
  organizationId: asId<"OrganizationId">("org-eks-group"),
  tenantId: asId<"TenantId">("tenant-eks"),
  protocolId: "cleaning.protocol.residential",
  protocolVersion: "1.0.0",
  version: "1.0.0",
  branding: {
    displayName: "Eks-Clean",
    tagline: "Professional cleaning, on demand.",
    theme: {
      primary: "#0d9488",
      secondary: "#0f766e",
      accent: "#14b8a6",
      background: "#ffffff",
      surface: "#f0fdfa",
      text: "#134e4a",
      textMuted: "#5eead4",
      mode: "light",
    },
    assets: { logoUrl: "/logo.svg", faviconUrl: "/logo.svg" },
    titleTemplate: "{{displayName}} — Professional Cleaning",
    emailTemplates: [{ name: "welcome", subjectTemplate: "Welcome to {{displayName}}", bodyTemplateRef: "eks-clean.email.welcome" }],
    metadata: { publisher: "Eks Group", category: "cleaning" },
  },
  routing: { pathPrefix: "/apps/eks-clean", rootRoute: false, domains: [{ domain: "clean.eksgroup.com", primary: true, sslEnabled: true }] },
  configurationSchema: { version: 1, fields: [
    { key: "defaultLocale", type: "string", required: true, default: "en" },
    { key: "serviceRadius", type: "number", required: true, default: 50 },
    { key: "ecoFriendly", type: "boolean", required: false, default: true },
  ]},
  configuration: [
    { layer: "protocol", values: { defaultLocale: "en" } },
    { layer: "application", values: { serviceRadius: 30, ecoFriendly: true } },
  ],
  featureFlags: [
    { key: "subscriptions", default: false },
    { key: "marketplace", default: false },
    { key: "eco-friendly", default: true },
    { key: "supplies-included", default: true },
    { key: "pet-friendly", default: true },
    { key: "same-day", default: true },
  ],
  authentication: [{ kind: "oauth", providerId: "payswap", enabled: true, configRef: "eks-clean.auth.payswap" }],
  navigation: [
    { id: "dashboard", label: "Dashboard", viewRef: "eks-clean.view.dashboard", order: 10 },
    { id: "book", label: "Book Cleaning", viewRef: "eks-clean.view.book", order: 20 },
    { id: "history", label: "History", viewRef: "eks-clean.view.history", order: 30 },
    { id: "settings", label: "Settings", viewRef: "eks-clean.view.settings", order: 40 },
  ],
  localization: [
    { code: "en", displayName: "English", default: true, resourceBundleRef: "eks-clean.i18n.en" },
    { code: "fr", displayName: "Français", default: false, resourceBundleRef: "eks-clean.i18n.fr" },
  ],
  uiExtensions: [
    { mountPoint: "booking.form", componentRef: "eks-clean.ui.booking-form", enabled: true },
    { mountPoint: "cleaner.profile", componentRef: "eks-clean.ui.cleaner-profile", enabled: true },
  ],
  installedModules: [{ moduleId: "cleaning.residential.core", version: "1.0.0", enabled: true }],
});

// ── Sparkle Cleaning Application ────────────────────────────────────────────

export const sparkleApp = defineApplication({
  id: "sparkle",
  name: "sparkle",
  displayName: "Sparkle Cleaning",
  description: "Sparkle — commercial cleaning service. Powered by the Commercial Cleaning Protocol.",
  organizationId: asId<"OrganizationId">("org-sparkle"),
  tenantId: asId<"TenantId">("tenant-sparkle"),
  protocolId: "cleaning.protocol.commercial",
  protocolVersion: "1.0.0",
  version: "1.0.0",
  branding: {
    displayName: "Sparkle Cleaning",
    tagline: "Spotless commercial spaces.",
    theme: { primary: "#7c3aed", secondary: "#6d28d9", accent: "#8b5cf6", background: "#ffffff", surface: "#f5f3ff", text: "#4c1d95", textMuted: "#c4b5fd", mode: "light" },
    assets: { logoUrl: "/logo.svg" },
    titleTemplate: "{{displayName}} — Commercial Cleaning",
    emailTemplates: [],
    metadata: { publisher: "Sparkle Inc.", category: "cleaning" },
  },
  routing: { pathPrefix: "/apps/sparkle", rootRoute: false, domains: [{ domain: "sparkle.clean", primary: true, sslEnabled: true }] },
  configurationSchema: { version: 1, fields: [
    { key: "defaultLocale", type: "string", required: true, default: "en" },
    { key: "recurringContracts", type: "boolean", required: false, default: true },
    { key: "complianceReporting", type: "boolean", required: false, default: true },
  ]},
  configuration: [{ layer: "application", values: { recurringContracts: true, complianceReporting: true } }],
  featureFlags: [
    { key: "recurring", default: true },
    { key: "compliance-reporting", default: true },
    { key: "night-shift", default: true },
    { key: "marketplace", default: false },
  ],
  authentication: [{ kind: "oauth", providerId: "payswap", enabled: true, configRef: "sparkle.auth.payswap" }],
  navigation: [
    { id: "dashboard", label: "Dashboard", viewRef: "sparkle.view.dashboard", order: 10 },
    { id: "contracts", label: "Contracts", viewRef: "sparkle.view.contracts", order: 20 },
    { id: "reports", label: "Reports", viewRef: "sparkle.view.reports", order: 30 },
  ],
  localization: [{ code: "en", displayName: "English", default: true, resourceBundleRef: "sparkle.i18n.en" }],
  uiExtensions: [{ mountPoint: "contract.management", componentRef: "sparkle.ui.contract-mgmt", enabled: true }],
  installedModules: [{ moduleId: "cleaning.commercial.core", version: "1.0.0", enabled: true }],
});

// ── FreshHome Application (Airbnb Turnover) ─────────────────────────────────

export const freshHomeApp = defineApplication({
  id: "freshhome",
  name: "freshhome",
  displayName: "FreshHome",
  description: "FreshHome — Airbnb turnover cleaning. Powered by the Residential Cleaning Protocol.",
  organizationId: asId<"OrganizationId">("org-freshhome"),
  tenantId: asId<"TenantId">("tenant-freshhome"),
  protocolId: "cleaning.protocol.residential",
  protocolVersion: "1.0.0",
  version: "1.0.0",
  branding: {
    displayName: "FreshHome",
    tagline: "Guest-ready in 2 hours.",
    theme: { primary: "#f59e0b", secondary: "#d97706", accent: "#fbbf24", background: "#ffffff", surface: "#fffbeb", text: "#78350f", textMuted: "#fcd34d", mode: "light" },
    assets: { logoUrl: "/logo.svg" },
    titleTemplate: "{{displayName}} — Turnover Cleaning",
    emailTemplates: [],
    metadata: { publisher: "FreshHome", category: "cleaning", segment: "airbnb" },
  },
  routing: { pathPrefix: "/apps/freshhome", rootRoute: false, domains: [{ domain: "freshhome.app", primary: true, sslEnabled: true }] },
  configurationSchema: { version: 1, fields: [
    { key: "defaultLocale", type: "string", required: true, default: "en" },
    { key: "turnaroundHours", type: "number", required: true, default: 2 },
  ]},
  configuration: [{ layer: "application", values: { turnaroundHours: 2 } }],
  featureFlags: [
    { key: "instant-book", default: true },
    { key: "supplies-included", default: true },
    { key: "linen-service", default: true },
    { key: "photo-report", default: true },
  ],
  authentication: [{ kind: "oauth", providerId: "payswap", enabled: true, configRef: "freshhome.auth.payswap" }],
  navigation: [
    { id: "dashboard", label: "Dashboard", viewRef: "freshhome.view.dashboard", order: 10 },
    { id: "schedule", label: "Schedule", viewRef: "freshhome.view.schedule", order: 20 },
    { id: "photos", label: "Photo Reports", viewRef: "freshhome.view.photos", order: 30 },
  ],
  localization: [{ code: "en", displayName: "English", default: true, resourceBundleRef: "freshhome.i18n.en" }],
  uiExtensions: [{ mountPoint: "turnover.checklist", componentRef: "freshhome.ui.checklist", enabled: true }],
  installedModules: [{ moduleId: "cleaning.residential.core", version: "1.0.0", enabled: true }],
});

// ── All Applications ────────────────────────────────────────────────────────

export const cleaningApplications = [eksCleanApp, sparkleApp, freshHomeApp];
