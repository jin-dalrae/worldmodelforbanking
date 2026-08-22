export type Merchant = {
  name: string;
  mcc: string;
  category: string;
  ticket: number;
};

export const MERCHANTS: Merchant[] = [
  { name: "Hearth & Staple", mcc: "5411", category: "groceries", ticket: 78 },
  { name: "Northbound Fuel", mcc: "5541", category: "gas", ticket: 52 },
  { name: "Kiln Coffee", mcc: "5814", category: "restaurants", ticket: 14 },
  { name: "Rivermark Pharmacy", mcc: "5912", category: "health", ticket: 36 },
  { name: "Cedar Transit", mcc: "4111", category: "transit", ticket: 22 },
  { name: "Lumen Utilities", mcc: "4900", category: "utilities", ticket: 164 },
  { name: "Harbor Rent", mcc: "6513", category: "housing", ticket: 1680 },
  { name: "Aperture Streaming", mcc: "4899", category: "subscriptions", ticket: 16 },
  { name: "Field & Thread", mcc: "5651", category: "retail", ticket: 64 },
  { name: "Pylon Wireless", mcc: "4814", category: "telecom", ticket: 89 },
  { name: "West Clinic", mcc: "8011", category: "health", ticket: 240 },
  { name: "Atlas Auto", mcc: "7538", category: "auto", ticket: 310 },
  { name: "Kindling Books", mcc: "5942", category: "retail", ticket: 22 },
  { name: "Sable Grocers", mcc: "5411", category: "groceries", ticket: 112 },
  { name: "Nightshade Bar", mcc: "5813", category: "restaurants", ticket: 48 },
  { name: "Vertigo Amusement Park", mcc: "7996", category: "entertainment", ticket: 96 },
  { name: "Orpheum Cinema", mcc: "7832", category: "entertainment", ticket: 21 },
  { name: "Meridian Airways", mcc: "4511", category: "travel", ticket: 340 },
  { name: "Cordwell Hotel", mcc: "7011", category: "travel", ticket: 190 },
];

export const CATEGORIES = [
  "groceries",
  "gas",
  "restaurants",
  "health",
  "transit",
  "utilities",
  "housing",
  "subscriptions",
  "retail",
  "telecom",
  "auto",
  "entertainment",
  "travel",
] as const;
