// Shared list of supported Nigerian banks + CBN/Paystack codes.
// Used by the admin cleaner-edit panel and the keeper self-service bank
// screen so the two never drift apart. bank_code is validated against this
// list server-side, and bank_name is derived from it (never trusted from
// the client) when saving a bank account.
export interface NigerianBank {
  code: string;
  name: string;
}

export const NIGERIAN_BANKS: NigerianBank[] = [
  { code: "011", name: "First Bank of Nigeria" },
  { code: "033", name: "United Bank for Africa (UBA)" },
  { code: "044", name: "Access Bank" },
  { code: "050", name: "EcoBank Nigeria" },
  { code: "057", name: "Zenith Bank" },
  { code: "058", name: "Guaranty Trust Bank (GTB)" },
  { code: "070", name: "Fidelity Bank" },
  { code: "076", name: "Polaris Bank" },
  { code: "082", name: "Keystone Bank" },
  { code: "221", name: "Stanbic IBTC Bank" },
  { code: "232", name: "Sterling Bank" },
  { code: "032", name: "Union Bank of Nigeria" },
  { code: "035", name: "Wema Bank" },
  { code: "50211", name: "Kuda Microfinance Bank" },
  { code: "100004", name: "Opay (OPay Digital Services)" },
  { code: "100033", name: "PalmPay" },
  { code: "50515", name: "Moniepoint Microfinance Bank" },
];

export function bankNameForCode(code: string): string | null {
  return NIGERIAN_BANKS.find((b) => b.code === code)?.name ?? null;
}
