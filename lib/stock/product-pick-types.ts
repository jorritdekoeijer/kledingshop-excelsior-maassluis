export type VariantSegment = "youth" | "adult";

export type ProductPickOption = {
  id: string;
  name: string;
  youth: { modelNumber: string; sizes: string[] };
  adult: { modelNumber: string; sizes: string[] };
};
