import { useMemo } from 'react';
import type { AdStatus } from '~/types/types';

function statusToColors(status: AdStatus): {
  textColor: string;
  backgroundColor: string;
  text: string;
} {
  switch (status) {
    case 'PENDING':
      return {
        textColor: '#0a7fb5',
        backgroundColor: '#e4f4ff',
        text: 'pending',
      };
    case 'NEEDS CORRECTION':
      return {
        textColor: '#A25',
        backgroundColor: '#fdd',
        text: 'needs correction',
      };
    case 'ACTIVE':
      return {
        textColor: '#00ad4e',
        backgroundColor: '#cdffe5',
        text: 'active',
      };
    case 'AWAITING PAYMENT':
      return {
        textColor: '#d69222',
        backgroundColor: '#ffeccc',
        text: 'awaiting payment',
      };
    case 'ENDED': {
      return {
        textColor: '#888',
        backgroundColor: '#e8e8e8',
        text: 'ended',
      };
    }
    default:
      return {
        backgroundColor: '#940',
        textColor: '#fdf',
        text: '???',
      };
  }
}

export default function AdStatus({ status }: { status: AdStatus }) {
  const { textColor, backgroundColor, text } = useMemo(
    () => statusToColors(status),
    [status]
  );

  return (
    <span
      className="border-2 border-solid py-[2px] px-1 rounded"
      style={{ color: 'black', borderColor: textColor, backgroundColor }}
    >
      {text.toUpperCase()}
    </span>
  );
}
