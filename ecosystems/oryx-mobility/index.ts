/**
 * Oryx Mobility Ecosystem — Index
 *
 * This is the entry point for the Oryx Mobility ecosystem package.
 * It exports the domain definition, protocol, marketplace, AI teams,
 * experiences, twins, and connectors.
 *
 * IMPORTANT: This ecosystem imports ONLY from @kernel/api/v1.
 * It does NOT modify any platform code.
 * It registers extensions through the Protocol SDK.
 * It must pass the Ecosystem Conformance Suite before installation.
 */

export { oryxMobilityDomain } from "./domain/mobility-domain";
export { oryxMobilityProtocol } from "./protocol/mobility-protocol";
export {
  aggregateOffers,
  evaluateParcelBids,
  type MobilityProvider,
  type MarketplaceOffer,
  type AggregationRequest,
  type AggregationResult,
  type ParcelBid,
  type ParcelBiddingResult,
  type ProviderType,
} from "./marketplace/marketplace";
export {
  negotiationTeam,
  matchingTeam,
  routingTeam,
  riskTeam,
  marketplaceTeam,
  oryxAITeams,
  type AITeamDefinition,
} from "./ai-teams/ai-teams";
export {
  bookingJourneyStages,
  parcelJourneyStages,
  explainabilityTemplates,
  trackingStates,
  uiExtensions,
  type ExplainabilityTemplate,
} from "./experiences/experiences";
export {
  twinConfigs,
  type TripTwinState,
  type DriverTwinState,
  type VehicleTwinState,
  type MarketTwinState,
  type NetworkTwinState,
} from "./twins/twins";
export {
  oryxConnectors,
  routingConnector,
  paymentConnector,
  mapsConnector,
  geocodingConnector,
  thirdPartyConnectors,
  type RoutingRequest,
  type RoutingResponse,
} from "./connectors/connectors";
