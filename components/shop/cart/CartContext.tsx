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

const STORAGE_KEY = "kleding-cart-v1";

export type CartLine = {
  productId: string;
  quantity: number;
  name: string;
  priceCents: number;
  slug: string;
};

type CartContextValue = {
  lines: CartLine[];
  ready: boolean;
  addLine: (line: Omit<CartLine, "quantity"> & { quantity?: number }) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeLine: (productId: string) => void;
  clear: () => void;
  totalQuantity: number;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CartLine[];
        // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate winkelmand na mount (geen SSR localStorage)
        if (Array.isArray(parsed)) setLines(parsed);
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
      const i = prev.findIndex((x) => x.productId === line.productId);
      if (i === -1) return [...prev, { ...line, quantity: q }];
      const next = [...prev];
      next[i] = { ...next[i], quantity: next[i].quantity + q };
      return next;
    });
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity < 1) {
      setLines((prev) => prev.filter((x) => x.productId !== productId));
      return;
    }
    setLines((prev) => prev.map((x) => (x.productId === productId ? { ...x, quantity } : x)));
  }, []);

  const removeLine = useCallback((productId: string) => {
    setLines((prev) => prev.filter((x) => x.productId !== productId));
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
