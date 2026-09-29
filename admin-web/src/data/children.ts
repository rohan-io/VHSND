import type { ChildBeneficiary } from './types';
import { blockForVillage } from './villages';

export const CHILDREN: ChildBeneficiary[] = [
  {
    id: 'CHILD-MCH-7000',
    name: 'Aryan Jena',
    motherName: 'Sasmita Jena',
    motherId: 'BEN-2026-500',
    village: 'Mangarajpur',
    block: blockForVillage('Mangarajpur'),
    ageLabel: '45 Days'
  },
  {
    id: 'CHILD-MCH-7001',
    name: 'Anwesha Sahoo',
    motherName: 'Puspanjali Sahoo',
    motherId: 'BEN-2026-501',
    village: 'Badatrilochanpur',
    block: blockForVillage('Badatrilochanpur'),
    ageLabel: '3 Months 0 Days'
  }
];
