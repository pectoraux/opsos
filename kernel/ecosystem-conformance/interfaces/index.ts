/**
 * @kernel/ecosystem-conformance/interfaces — public surface.
 *
 * The Ecosystem Conformance Suite: the GATE that validates any .opspkg before
 * installation. If a package fails, it is REJECTED. No ecosystem bypasses the
 * platform (ADR-0024).
 */
export * from "../domain";
export * from "../application";
export * from "../infrastructure";
