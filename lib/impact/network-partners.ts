export const TBI_NETWORK_PARTNERS = [
  { code: "GH", name: "Tropenbos Ghana", country: "Ghana", region: "West Africa", host: true },
  { code: "BO", name: "Tropenbos Bolivia", country: "Bolivia", region: "South America", host: false },
  { code: "CO", name: "Tropenbos Colombia", country: "Colombia", region: "South America", host: false },
  { code: "CD", name: "Tropenbos DR Congo", country: "DR Congo", region: "Central/East Africa", host: false },
  { code: "ET", name: "Tropenbos Ethiopia", country: "Ethiopia", region: "Central/East Africa", host: false },
  { code: "ID", name: "Tropenbos Indonesia", country: "Indonesia", region: "Southeast Asia", host: false },
  { code: "PH", name: "Tropenbos Philippines", country: "Philippines", region: "Southeast Asia", host: false },
  { code: "SR", name: "Tropenbos Suriname", country: "Suriname", region: "South America", host: false },
  { code: "UG", name: "Tropenbos Uganda", country: "Uganda", region: "Central/East Africa", host: false },
  { code: "VN", name: "Tropenbos Vietnam", country: "Vietnam", region: "Southeast Asia", host: false },
] as const;

export type TbiPartnerCode = (typeof TBI_NETWORK_PARTNERS)[number]["code"];
export type TbiPartner = (typeof TBI_NETWORK_PARTNERS)[number];

export const TBI_PARTNER_COUNTRIES = TBI_NETWORK_PARTNERS.filter((partner) => !partner.host);

export function getPartnerByCode(code: string): TbiPartner | undefined {
  return TBI_NETWORK_PARTNERS.find((partner) => partner.code === code);
}

export function isValidPartnerCode(code: string): code is TbiPartnerCode {
  return getPartnerByCode(code) !== undefined;
}
