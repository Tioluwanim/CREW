// Nigerian commercial banks by CBN bank code (the code the backend's payout provider expects as `bankCode`).
// Ecobank is first: it is CREW's primary rail.
export const BANKS = [
  { code: '050', name: 'Ecobank Nigeria' },
  { code: '044', name: 'Access Bank' },
  { code: '011', name: 'First Bank of Nigeria' },
  { code: '214', name: 'First City Monument Bank (FCMB)' },
  { code: '070', name: 'Fidelity Bank' },
  { code: '058', name: 'Guaranty Trust Bank (GTBank)' },
  { code: '082', name: 'Keystone Bank' },
  { code: '076', name: 'Polaris Bank' },
  { code: '101', name: 'Providus Bank' },
  { code: '221', name: 'Stanbic IBTC Bank' },
  { code: '232', name: 'Sterling Bank' },
  { code: '033', name: 'United Bank for Africa (UBA)' },
  { code: '032', name: 'Union Bank' },
  { code: '215', name: 'Unity Bank' },
  { code: '035', name: 'Wema Bank' },
  { code: '057', name: 'Zenith Bank' },
] as const;

export const ECOBANK_CODE = '050';

export function bankName(code: string | null | undefined): string {
  return BANKS.find((b) => b.code === code)?.name ?? (code ? `Bank ${code}` : '');
}
