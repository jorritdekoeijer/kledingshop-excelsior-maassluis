export type VariantSegment = "youth" | "adult";

export type ProductPickOption = {
  id: string;
  name: string;
  /** Standaard bedrukkingskosten (excl. btw) per stuk voor dit product. */
  printingExclCents: number;
  youth: { modelNumber: string; sizes: string[] };
  adult: { modelNumber: string; sizes: string[] };
};
