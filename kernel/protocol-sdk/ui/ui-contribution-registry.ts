/**
 * @kernel/protocol-sdk/ui — protocol-declared UI extensions + navigation.
 *
 * `componentRef` / `viewRef` are OPAQUE strings — the kernel does NOT link
 * React components. The host application resolves them at render time.
 */

import type { SemverString } from "../manifest/protocol-manifest";

export interface UIExtensionContribution {
  readonly id: string;
  readonly ownerProtocolId: string;
  readonly version: SemverString;
  readonly mountPoint: string;
  readonly componentRef: string;
  readonly props?: Readonly<Record<string, unknown>>;
  readonly priority?: number;
}

export interface NavigationContribution {
  readonly id: string;
  readonly ownerProtocolId: string;
  readonly version: SemverString;
  readonly label: string;
  readonly viewRef: string;
  readonly parent?: string;
  readonly order: number;
  readonly iconRef?: string;
  readonly requiredPermission?: string;
}

export interface UIContributionRegistry {
  registerUI(ext: UIExtensionContribution): void;
  registerNav(nav: NavigationContribution): void;
  unregister(protocolId: string): void;
  listUI(): readonly UIExtensionContribution[];
  listUIByMountPoint(mountPoint: string): readonly UIExtensionContribution[];
  listNav(): readonly NavigationContribution[];
  listNavByParent(parent?: string): readonly NavigationContribution[];
  listByProtocol(protocolId: string): { ui: readonly UIExtensionContribution[]; nav: readonly NavigationContribution[] };
}

export class InMemoryUIContributionRegistry implements UIContributionRegistry {
  private readonly ui = new Map<string, UIExtensionContribution>();
  private readonly nav = new Map<string, NavigationContribution>();

  registerUI(ext: UIExtensionContribution): void { this.ui.set(ext.id, ext); }
  registerNav(nav: NavigationContribution): void { this.nav.set(nav.id, nav); }

  unregister(protocolId: string): void {
    for (const [id, e] of this.ui) if (e.ownerProtocolId === protocolId) this.ui.delete(id);
    for (const [id, n] of this.nav) if (n.ownerProtocolId === protocolId) this.nav.delete(id);
  }

  listUI(): readonly UIExtensionContribution[] { return Array.from(this.ui.values()); }
  listUIByMountPoint(mountPoint: string): readonly UIExtensionContribution[] {
    return this.listUI().filter((e) => e.mountPoint === mountPoint);
  }
  listNav(): readonly NavigationContribution[] { return Array.from(this.nav.values()); }
  listNavByParent(parent?: string): readonly NavigationContribution[] {
    return this.listNav().filter((n) => (n.parent ?? undefined) === (parent ?? undefined));
  }
  listByProtocol(protocolId: string) {
    return {
      ui: this.listUI().filter((e) => e.ownerProtocolId === protocolId),
      nav: this.listNav().filter((n) => n.ownerProtocolId === protocolId),
    };
  }
}
