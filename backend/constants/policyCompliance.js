const POLICY_EXCLUSION_CODES = Object.freeze([
  'war_and_civil_unrest',
  'pandemic_epidemic',
  'terrorism',
  'nuclear_radiation',
  'force_majeure',
  'criminal_activity',
]);

const DEFAULT_POLICY_EXCLUSIONS = Object.freeze([
  'war_and_civil_unrest',
  'pandemic_epidemic',
  'terrorism',
  'nuclear_radiation',
]);

const DEFAULT_UNDERWRITING_GUIDELINES = Object.freeze({
  minCoverageAmount: 100,
  maxCoverageAmount: 10000,
  maxClaimsPerPolicy: 3,
});

module.exports = {
  POLICY_EXCLUSION_CODES,
  DEFAULT_POLICY_EXCLUSIONS,
  DEFAULT_UNDERWRITING_GUIDELINES,
};
