import type { Block, Village } from './types';

export const VILLAGES: Village[] = [
  { name: 'Mangarajpur', block: 'Jajpur Sadar' },
  { name: 'Badatrilochanpur', block: 'Jajpur Sadar' },
  { name: 'Balarampur', block: 'Jajpur Sadar' },
  { name: 'Gandhapal', block: 'Sukinda' },
  { name: 'Baradiha', block: 'Sukinda' },
  { name: 'Kantira', block: 'Sukinda' },
  { name: 'Nuadihi', block: 'Sukinda' },
  { name: 'Singadia', block: 'Sukinda' }
];

export function blockForVillage(village: string): Block {
  return VILLAGES.find((v) => v.name === village)?.block ?? 'Sukinda';
}
