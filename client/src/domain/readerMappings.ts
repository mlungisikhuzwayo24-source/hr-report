import type { Direction } from './types';

export const readerMappings: Readonly<Record<string, Exclude<Direction, 'UNKNOWN'>>> = {
  'Main Door T and A Reader (IN)': 'IN',
  'Main Door T and A Reader (OUT)': 'OUT',
  'Basement T and A (IN)': 'IN',
  'Main Door T and A Reader  (IN)': 'IN',
  'Main Door T and A Reader  (OUT)': 'OUT',
};

export function directionForReader(readerName: string): Direction {
  return readerMappings[readerName] ?? 'UNKNOWN';
}
