export type VariantSegment = "youth" | "adult" | "socks" | "shoes";

export type ProductPickOption = {
  id: string;
  name: string;
  /** Standaard bedrukkingskosten (excl. btw) per stuk voor dit product. */
  printingExclCents: number;
  youth: { modelNumber: string; sizes: string[] };
  adult: { modelNumber: string; sizes: string[] };
  socks?: { modelNumber: string; sizes: string[] };
  shoes?: { modelNumber: string; sizes: string[] };
};
