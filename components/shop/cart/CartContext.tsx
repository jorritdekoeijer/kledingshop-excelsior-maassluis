"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

const STORAGE_KEY = "kleding-cart-v2";
const LEGACY_STORAGE_KEY = "kleding-cart-v1";

export type CartLine = {
  /** Uniek per product + variant + maat */
  lineId: string;
  productId: string;
  quantity: number;
  name: string;
  priceCents: number;
  slug: string;
  variant?: "youth" | "adult" | "socks" | "shoes";
  sizeLabel?: string;
};

type CartContextValue = {
  lines: CartLine[];
  ready: boolean;
  addLine: (line: Omit<CartLine, "quantity"> & { quantity?: number }) => void;
  setQuantity: (lineId: string, quantity: number) => void;
  removeLine: (lineId: string) => void;
  clear: () => void;
  totalQuantity: number;
};

const CartContext = createContext<CartContextValue | null>(null);

function migrateLegacyLines(raw: unknown): CartLine[] | null {
  if (!Array.isArray(raw)) return null;
  const out: CartLine[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const productId = typeof o.productId === "string" ? o.productId : null;
    if (!productId) continue;
    const quantity = typeof o.quantity === "number" && o.quantity >= 1 ? Math.floor(o.quantity) : 1;
    const name = typeof o.name === "string" ? o.name : "";
    const priceCents = typeof o.priceCents === "number" ? o.priceCents : 0;
    const slug = typeof o.slug === "string" ? o.slug : "";
    out.push({
      lineId: productId,
      productId,
      quantity,
      name,
      priceCents,
      slug
    });
  }
  return out;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      let raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacy) {
          const migrated = migrateLegacyLines(JSON.parse(legacy));
          if (migrated?.length) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
            localStorage.removeItem(LEGACY_STORAGE_KEY);
            setLines(migrated);
            setReady(true);
            return;
          }
        }
      }
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          const next: CartLine[] = [];
          for (const x of parsed) {
            if (!x || typeof x !== "object") continue;
            const o = x as Record<string, unknown>;
            const lineId = typeof o.lineId === "string" ? o.lineId : typeof o.productId === "string" ? o.productId : null;
            const productId = typeof o.productId === "string" ? o.productId : null;
            if (!lineId || !productId) continue;
            const quantity = typeof o.quantity === "number" && o.quantity >= 1 ? Math.floor(o.quantity) : 1;
            next.push({
              lineId,
              productId,
              quantity,
              name: typeof o.name === "string" ? o.name : "",
              priceCents: typeof o.priceCents === "number" ? o.priceCents : 0,
              slug: typeof o.slug === "string" ? o.slug : "",
              variant:
                o.variant === "youth" || o.variant === "adult" || o.variant === "socks" || o.variant === "shoes"
                  ? o.variant
                  : undefined,
              sizeLabel: typeof o.sizeLabel === "string" ? o.sizeLabel : undefined
            });
          }
          setLines(next);
        }
      }
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      /* ignore */
    }
  }, [lines, ready]);

  const addLine = useCallback((line: Omit<CartLine, "quantity"> & { quantity?: number }) => {
    const q = line.quantity ?? 1;
    setLines((prev) => {
      const i = prev.findIndex((x) => x.lineId === line.lineId);
      if (i === -1) return [...prev, { ...line, quantity: q }];
      const next = [...prev];
      next[i] = { ...next[i], quantity: next[i].quantity + q };
      return next;
    });
  }, []);

  const setQuantity = useCallback((lineId: string, quantity: number) => {
    if (quantity < 1) {
      setLines((prev) => prev.filter((x) => x.lineId !== lineId));
      return;
    }
    setLines((prev) => prev.map((x) => (x.lineId === lineId ? { ...x, quantity } : x)));
  }, []);

  const removeLine = useCallback((lineId: string) => {
    setLines((prev) => prev.filter((x) => x.lineId !== lineId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const totalQuantity = useMemo(() => lines.reduce((s, l) => s + l.quantity, 0), [lines]);

  const value = useMemo(
    () => ({ lines, ready, addLine, setQuantity, removeLine, clear, totalQuantity }),
    [lines, ready, addLine, setQuantity, removeLine, clear, totalQuantity]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart moet binnen CartProvider gebruikt worden");
  return ctx;
}
