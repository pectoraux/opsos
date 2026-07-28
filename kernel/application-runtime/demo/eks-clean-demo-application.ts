/**
 * @kernel/application-runtime/demo — the reference Demo Application.
 *
 * "Eks-Clean Demo" powered by the Demo Protocol (opsos.protocol.demo@1.0.0).
 *
 * This is NOT a cleaning application — it has no cleaning logic. It proves the
 * Application Runtime: a single protocol (the Demo Protocol from the Protocol
 * SDK) powers a branded, configured, tenant-aware application instance. A
 * future Cleaning Protocol could power Eks-Clean, Sparkle Cleaning, CleanPro
 * Nigeria, and HomeCare Ghana the same way — four applications, one protocol,
 * no duplicated business logic.
 */

import { defineApplication } from "../sdk";
import type { ApplicationManifest } from "../applications/application-manifest";
import { asId } from "@kernel/shared-kernel";

export const eksCleanDemoApplication: ApplicationManifest = defineApplication({
  id: "eks-clean-demo",
  name: "eks-clean-demo",
  displayName: "Eks-Clean Demo",
  description:
    "Reference application for Application Runtime self-test. Powered by the Demo Protocol — NO cleaning logic.",
  organizationId: asId<"OrganizationId">("org-eks-group"),
  tenantId: asId<"TenantId">("tenant-eks"),
  protocolId: "opsos.protocol.demo",
  protocolVersion: "1.0.0",
  version: "1.0.0",

  branding: {
    displayName: "Eks-Clean Demo",
    tagline: "Operations, managed.",
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
    assets: {
      logoUrl: "/logo.svg",
      faviconUrl: "/logo.svg",
      iconUrl: "/logo.svg",
    },
    titleTemplate: "{{displayName}} — Operations, managed.",
    emailTemplates: [
      {
        name: "welcome",
        subjectTemplate: "Welcome to {{displayName}}",
        bodyTemplateRef: "eks-clean.email.welcome",
      },
    ],
    metadata: {
      publisher: "Eks Group",
      category: "operations",
    },
  },

  routing: {
    pathPrefix: "/apps/eks-clean-demo",
    rootRoute: false,
    domains: [
      { domain: "clean.eksgroup.demo", primary: true, sslEnabled: true },
    ],
    regions: ["west-africa"],
  },

  configurationSchema: {
    version: 1,
    fields: [
      { key: "defaultLocale", type: "string", required: true, default: "en", description: "Default locale code" },
      { key: "maxConcurrentJobs", type: "number", required: true, default: 100, description: "Max concurrent operational jobs" },
      { key: "aiRecommendations", type: "boolean", required: false, default: true, description: "Enable AI recommendations" },
    ],
  },
  configuration: [
    { layer: "protocol", values: { defaultLocale: "en", maxConcurrentJobs: 50 } },
    { layer: "application", values: { maxConcurrentJobs: 100, aiRecommendations: true } },
  ],

  featureFlags: [
    { key: "subscriptions", default: false, description: "Enable subscription billing" },
    { key: "marketplace", default: false, description: "Enable marketplace" },
    { key: "aiRecommendations", default: true, description: "Enable AI recommendations" },
    { key: "multiRegion", default: false, description: "Enable multi-region routing" },
  ],

  authentication: [
    { kind: "oauth", providerId: "payswap", enabled: true, configRef: "eks-clean.auth.payswap", scopes: ["openid", "profile"] },
    { kind: "password", providerId: "local", enabled: false, configRef: "eks-clean.auth.local" },
  ],

  navigation: [
    { id: "dashboard", label: "Dashboard", viewRef: "eks-clean.view.dashboard", order: 10, iconRef: "icon-dashboard" },
    { id: "operations", label: "Operations", viewRef: "eks-clean.view.operations", order: 20, iconRef: "icon-operations" },
    { id: "analytics", label: "Analytics", viewRef: "eks-clean.view.analytics", order: 30, iconRef: "icon-analytics", featureFlag: "aiRecommendations" },
    { id: "marketplace", label: "Marketplace", viewRef: "eks-clean.view.marketplace", order: 40, iconRef: "icon-marketplace", featureFlag: "marketplace" },
  ],

  localization: [
    { code: "en", displayName: "English", default: true, resourceBundleRef: "eks-clean.i18n.en" },
    { code: "fr", displayName: "Français", default: false, resourceBundleRef: "eks-clean.i18n.fr" },
  ],

  uiExtensions: [
    { mountPoint: "dashboard.sidebar", componentRef: "eks-clean.ui.sidebar-widget", enabled: true },
    { mountPoint: "operations.detail.header", componentRef: "eks-clean.ui.status-badge", enabled: true },
  ],

  installedModules: [
    { moduleId: "demo.core", version: "1.0.0", enabled: true },
  ],
});

export default eksCleanDemoApplication;
