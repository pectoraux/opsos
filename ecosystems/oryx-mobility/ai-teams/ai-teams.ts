/**
 * Oryx AI Workforce — invisible operational workers, not chatbots.
 *
 * Uses the frozen AI Workforce Runtime (M14) to define AI teams that handle
 * negotiation, pricing, matching, routing, risk, and marketplace operations.
 *
 * These are registered as agent definitions — the platform runtime manages
 * their lifecycle, memory, collaboration, and boundaries.
 */

// ── AI Team Definitions ─────────────────────────────────────────────────────

export interface AITeamDefinition {
  readonly id: string;
  readonly name: string;
  readonly roles: readonly AIRoleDefinition[];
  readonly objectives: readonly string[];
}

export interface AIRoleDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly decisionAuthority: "advisory" | "conditional" | "full";
  readonly capabilities: readonly string[];
  readonly boundaries: {
    readonly maxDecisionCost: number;
    readonly requiresApprovalAbove: number;
    readonly allowedActions: readonly string[];
    readonly forbiddenActions: readonly string[];
    readonly maxAutonomousDurationMs: number;
    readonly escalationOnTimeout: boolean;
  };
}

// ── Negotiation Team ────────────────────────────────────────────────────────

export const negotiationTeam: AITeamDefinition = {
  id: "oryx.team.negotiation",
  name: "Negotiation Team",
  roles: [
    {
      id: "oryx.role.negotiator",
      name: "Lead Negotiator",
      description: "Automatically negotiates with providers: counter-offers, dynamic pricing, pooling, fleet discounts, corporate rates, subscription benefits.",
      decisionAuthority: "conditional",
      capabilities: ["negotiate", "counter-offer", "evaluate-pricing", "apply-discounts"],
      boundaries: {
        maxDecisionCost: 500,
        requiresApprovalAbove: 200,
        allowedActions: ["negotiate", "counter-offer", "apply-discount", "accept-offer", "reject-offer"],
        forbiddenActions: ["charge-card", "cancel-trip", "modify-route"],
        maxAutonomousDurationMs: 30000,
        escalationOnTimeout: true,
      },
    },
    {
      id: "oryx.role.pricing-analyst",
      name: "Pricing Analyst",
      description: "Analyzes fare fairness, detects surge pricing, evaluates discount eligibility.",
      decisionAuthority: "advisory",
      capabilities: ["analyze-pricing", "detect-surge", "evaluate-fairness", "recommend-discount"],
      boundaries: {
        maxDecisionCost: 0,
        requiresApprovalAbove: 0,
        allowedActions: ["analyze", "recommend"],
        forbiddenActions: ["negotiate", "accept", "reject", "charge"],
        maxAutonomousDurationMs: 10000,
        escalationOnTimeout: false,
      },
    },
  ],
  objectives: [
    "Secure the best fare for the passenger",
    "Apply all eligible discounts (pooling, corporate, subscription)",
    "Never exceed 30 seconds negotiation time",
    "Escalate to human if negotiation fails",
  ],
};

// ── Matching Team ───────────────────────────────────────────────────────────

export const matchingTeam: AITeamDefinition = {
  id: "oryx.team.matching",
  name: "Matching Team",
  roles: [
    {
      id: "oryx.role.matcher",
      name: "Lead Matcher",
      description: "Evaluates ALL providers and produces a single ranked list. The customer never sees separate providers.",
      decisionAuthority: "full",
      capabilities: ["match", "rank", "filter", "score"],
      boundaries: {
        maxDecisionCost: 0,
        requiresApprovalAbove: 0,
        allowedActions: ["match", "rank", "filter", "score", "recommend"],
        forbiddenActions: ["negotiate", "charge", "cancel"],
        maxAutonomousDurationMs: 5000,
        escalationOnTimeout: true,
      },
    },
  ],
  objectives: [
    "Evaluate all available providers (platform, partner, third-party, corporate, autonomous)",
    "Score by ETA, fare, rating, features, pooling, benefits",
    "Return one ranked list — never separate by provider",
  ],
};

// ── Routing Team ────────────────────────────────────────────────────────────

export const routingTeam: AITeamDefinition = {
  id: "oryx.team.routing",
  name: "Routing Team",
  roles: [
    {
      id: "oryx.role.router",
      name: "Lead Router",
      description: "Computes routes, ETAs, and alternatives. Integrates with the routing engine for traffic-aware estimates.",
      decisionAuthority: "full",
      capabilities: ["compute-route", "estimate-eta", "find-alternatives", "traffic-aware"],
      boundaries: {
        maxDecisionCost: 0,
        requiresApprovalAbove: 0,
        allowedActions: ["compute", "estimate", "recommend-route"],
        forbiddenActions: ["modify-destination", "cancel"],
        maxAutonomousDurationMs: 10000,
        escalationOnTimeout: false,
      },
    },
  ],
  objectives: [
    "Compute the fastest route with traffic awareness",
    "Provide at least 2 alternative routes",
    "Estimate pickup time and trip duration",
  ],
};

// ── Risk Team ───────────────────────────────────────────────────────────────

export const riskTeam: AITeamDefinition = {
  id: "oryx.team.risk",
  name: "Risk Team",
  roles: [
    {
      id: "oryx.role.risk-assessor",
      name: "Risk Assessor",
      description: "Evaluates safety risks: driver history, vehicle condition, route safety, weather, time of day.",
      decisionAuthority: "conditional",
      capabilities: ["assess-risk", "check-history", "evaluate-safety", "flag-concerns"],
      boundaries: {
        maxDecisionCost: 0,
        requiresApprovalAbove: 0,
        allowedActions: ["assess", "flag", "recommend-deny", "recommend-approve"],
        forbiddenActions: ["deny", "approve", "cancel"],
        maxAutonomousDurationMs: 5000,
        escalationOnTimeout: true,
      },
    },
  ],
  objectives: [
    "Assess driver safety (certifications, ratings, history)",
    "Assess vehicle safety (inspection status, condition)",
    "Assess route safety (weather, time, area)",
    "Flag concerns for human review when needed",
  ],
};

// ── Marketplace Team ────────────────────────────────────────────────────────

export const marketplaceTeam: AITeamDefinition = {
  id: "oryx.team.marketplace",
  name: "Marketplace Team",
  roles: [
    {
      id: "oryx.role.marketplace-operator",
      name: "Marketplace Operator",
      description: "Manages the mobility exchange: clears bids, matches offers, resolves conflicts, optimizes liquidity.",
      decisionAuthority: "full",
      capabilities: ["clear-marketplace", "match-bids", "resolve-conflicts", "optimize-liquidity"],
      boundaries: {
        maxDecisionCost: 1000,
        requiresApprovalAbove: 500,
        allowedActions: ["clear", "match", "resolve", "optimize", "publish"],
        forbiddenActions: ["charge", "refund", "cancel-trip"],
        maxAutonomousDurationMs: 60000,
        escalationOnTimeout: true,
      },
    },
  ],
  objectives: [
    "Maintain marketplace liquidity across all provider types",
    "Clear bids within 60 seconds",
    "Ensure fair competition — no provider preference",
    "Optimize for passenger outcome, not provider revenue",
  ],
};

// ── All Teams ───────────────────────────────────────────────────────────────

export const oryxAITeams: readonly AITeamDefinition[] = [
  negotiationTeam,
  matchingTeam,
  routingTeam,
  riskTeam,
  marketplaceTeam,
];
