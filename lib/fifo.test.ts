import { describe, expect, it } from "vitest";
import { Fifo } from "./fifo";

describe("Fifo", () => {
  it("push/pop works", () => {
    const q = new Fifo<number>();
    q.push(1);
    q.push(2);
    expect(q.size).toBe(2);
    expect(q.pop()).toBe(1);
    expect(q.pop()).toBe(2);
    expect(q.pop()).toBeUndefined();
  });
});

