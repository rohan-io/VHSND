// Integration-style test: no component-rendering test infra (jsdom/RTL)
// exists in this repo yet, so this exercises the same code path the referral
// form's onSubmit actually calls — the real createReferral()/getReferrals()
// functions hitting a mocked fetch — rather than adding a new test stack for
// one test. See admin-web/src/app/dashboard/referral/referral-form.tsx.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createReferral, getReferrals } from './service';

describe('referrals api service', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('POSTs a new referral to /api/referrals with the right shape', async () => {
    const apiReferral = {
      id: 'REF-LOCAL-1',
      beneficiary_id: 'BEN-2026-500',
      beneficiary_name: 'Sasmita Jena',
      facility: 'CHC Sukinda',
      reason: 'Test reason',
      date: '2026-09-28',
      follow_up_status: 'Pending' as const,
      notes: null
    };
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(apiReferral), { status: 201 })
    );

    const result = await createReferral({
      beneficiary_id: 'BEN-2026-500',
      beneficiary_name: 'Sasmita Jena',
      facility: 'CHC Sukinda',
      reason: 'Test reason',
      date: '2026-09-28'
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('http://localhost:3001/api/referrals');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toMatchObject({ beneficiary_id: 'BEN-2026-500' });
    expect(result).toEqual({
      id: 'REF-LOCAL-1',
      beneficiaryId: 'BEN-2026-500',
      beneficiaryName: 'Sasmita Jena',
      facility: 'CHC Sukinda',
      reason: 'Test reason',
      date: '2026-09-28',
      followUpStatus: 'Pending',
      notes: undefined
    });
  });

  it('maps GET /api/referrals rows into the Referral shape', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            id: 'REF-2026-001',
            beneficiary_id: 'BEN-2026-502',
            beneficiary_name: 'Rojalin Behera',
            facility: 'DHH Jajpur',
            reason: 'Advanced maternal age',
            date: '2026-09-14',
            follow_up_status: 'Referred',
            notes: 'Transport arranged'
          }
        ]),
        { status: 200 }
      )
    );

    const referrals = await getReferrals();
    expect(referrals).toEqual([
      {
        id: 'REF-2026-001',
        beneficiaryId: 'BEN-2026-502',
        beneficiaryName: 'Rojalin Behera',
        facility: 'DHH Jajpur',
        reason: 'Advanced maternal age',
        date: '2026-09-14',
        followUpStatus: 'Referred',
        notes: 'Transport arranged'
      }
    ]);
  });

  it('throws a friendly ApiError when the server is unreachable', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(getReferrals()).rejects.toThrow('Cannot reach the local API server');
  });
});
