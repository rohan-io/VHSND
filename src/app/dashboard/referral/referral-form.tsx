'use client';

import * as z from 'zod';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { useAppForm } from '@/lib/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { REFERRAL_FACILITIES } from '@/data/referrals';
import type { Beneficiary } from '@/data/types';
import { createReferral } from '@/features/referrals/api/service';

const referralFormSchema = z.object({
  beneficiaryId: z.string().min(1, 'Select a beneficiary'),
  facility: z.string().min(1, 'Select a facility'),
  reason: z.string().min(5, 'Reason must be at least 5 characters'),
  date: z.string().min(1, 'Date is required'),
  notes: z.string()
});

const facilityOptions = REFERRAL_FACILITIES.map((f) => ({ value: f, label: f }));

export function ReferralForm({ beneficiaries }: { beneficiaries: Beneficiary[] }) {
  const router = useRouter();
  const beneficiaryOptions = beneficiaries.map((b) => ({
    value: b.id,
    label: `${b.name} — ${b.village}`
  }));

  const createMutation = useMutation({
    mutationFn: createReferral,
    onSuccess: () => {
      toast.success('Referred');
      router.push('/dashboard/referral');
      router.refresh();
    },
    onError: () => toast.error('Could not submit referral — is local-api running?')
  });

  const form = useAppForm({
    defaultValues: {
      beneficiaryId: '',
      facility: '',
      reason: '',
      date: '',
      notes: ''
    },
    validators: {
      onSubmit: referralFormSchema
    },
    onSubmit: async ({ value }) => {
      const beneficiary = beneficiaries.find((b) => b.id === value.beneficiaryId);
      await createMutation.mutateAsync({
        beneficiary_id: value.beneficiaryId,
        beneficiary_name: beneficiary?.name ?? value.beneficiaryId,
        facility: value.facility,
        reason: value.reason,
        date: value.date,
        notes: value.notes || undefined
      });
      form.reset();
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Referral Details</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className='space-y-6'
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          <form.AppField
            name='beneficiaryId'
            children={(field) => (
              <field.SelectField
                label='Beneficiary'
                required
                options={beneficiaryOptions}
                placeholder='Select a beneficiary'
              />
            )}
          />

          <form.AppField
            name='facility'
            children={(field) => (
              <field.SelectField
                label='Facility'
                required
                options={facilityOptions}
                placeholder='Select a facility'
              />
            )}
          />

          <form.AppField
            name='reason'
            children={(field) => (
              <field.TextareaField
                label='Reason for Referral'
                required
                placeholder='Describe the reason for referral'
                rows={3}
              />
            )}
          />

          <form.AppField
            name='date'
            children={(field) => <field.TextField label='Date' required type='date' />}
          />

          <form.AppField
            name='notes'
            children={(field) => (
              <field.TextareaField
                label='Notes'
                placeholder='Additional notes (optional)'
                rows={3}
              />
            )}
          />

          <form.AppForm>
            <form.SubmitButton>Mark Referred</form.SubmitButton>
          </form.AppForm>
        </form>
      </CardContent>
    </Card>
  );
}
