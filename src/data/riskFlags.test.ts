import { describe, it, expect } from 'vitest';
import { bucketRiskReasons } from './riskFlags';

describe('bucketRiskReasons', () => {
  it('returns all 5 category keys present even when empty', () => {
    const result = bucketRiskReasons([]);
    expect(Object.keys(result)).toEqual([
      'Maternal Age',
      'Previous Obstetric History',
      'Current Pregnancy Complications',
      'Maternal Medical Conditions',
      'Pregnancy-Related Factors'
    ]);
    expect(result['Maternal Age']).toEqual([]);
  });

  it('buckets age auto-flag under Maternal Age', () => {
    const result = bucketRiskReasons(['Adolescent pregnancy (under 18 years)']);
    expect(result['Maternal Age']).toEqual(['Adolescent pregnancy (under 18 years)']);
  });

  it("buckets grand multipara under Maternal Age (per riskAssessment.ts's own section-1 convention)", () => {
    const result = bucketRiskReasons(['Grand multipara (5 or more pregnancies)']);
    expect(result['Maternal Age']).toEqual(['Grand multipara (5 or more pregnancies)']);
  });

  it('buckets Rh-negative under Maternal Age', () => {
    const result = bucketRiskReasons(['Rh-negative blood group (O-)']);
    expect(result['Maternal Age']).toEqual(['Rh-negative blood group (O-)']);
  });

  it('buckets obstetric history reasons', () => {
    const result = bucketRiskReasons(['Previous caesarean section or uterine surgery']);
    expect(result['Previous Obstetric History']).toEqual([
      'Previous caesarean section or uterine surgery'
    ]);
  });

  it('buckets current pregnancy complications', () => {
    const result = bucketRiskReasons(['Hypertension, pre-eclampsia or eclampsia']);
    expect(result['Current Pregnancy Complications']).toEqual([
      'Hypertension, pre-eclampsia or eclampsia'
    ]);
  });

  it('buckets medical conditions', () => {
    const result = bucketRiskReasons(['Severe respiratory disease']);
    expect(result['Maternal Medical Conditions']).toEqual(['Severe respiratory disease']);
  });

  it('buckets pregnancy-related factors', () => {
    const result = bucketRiskReasons(['Very low or high BMI']);
    expect(result['Pregnancy-Related Factors']).toEqual(['Very low or high BMI']);
  });

  it('buckets comorbidities under Maternal Medical Conditions', () => {
    const result = bucketRiskReasons(['Known comorbidity: HIV']);
    expect(result['Maternal Medical Conditions']).toEqual(['Known comorbidity: HIV']);
  });

  it('catch-all buckets free-text and clinician override under Pregnancy-Related Factors', () => {
    const result = bucketRiskReasons(['Other: Unusual cord insertion', 'Flagged by clinician']);
    expect(result['Pregnancy-Related Factors']).toEqual([
      'Other: Unusual cord insertion',
      'Flagged by clinician'
    ]);
  });

  it('never throws on an unmapped string, falls back to the catch-all', () => {
    expect(() => bucketRiskReasons(['Some future reason not yet mapped'])).not.toThrow();
    const result = bucketRiskReasons(['Some future reason not yet mapped']);
    expect(result['Pregnancy-Related Factors']).toContain('Some future reason not yet mapped');
  });

  it('handles multiple reasons across categories, one per bucket', () => {
    const result = bucketRiskReasons([
      'Advanced maternal age (35 years or older, especially first pregnancy)',
      'Previous caesarean section or uterine surgery',
      'Hypertension, pre-eclampsia or eclampsia',
      'Severe respiratory disease',
      'Very low or high BMI'
    ]);
    expect(result['Maternal Age']).toHaveLength(1);
    expect(result['Previous Obstetric History']).toHaveLength(1);
    expect(result['Current Pregnancy Complications']).toHaveLength(1);
    expect(result['Maternal Medical Conditions']).toHaveLength(1);
    expect(result['Pregnancy-Related Factors']).toHaveLength(1);
  });
});
