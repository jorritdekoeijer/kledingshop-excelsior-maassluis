export type FifoLike<T> = {
  push: (_item: T) => void;
  pop: () => T | undefined;
  readonly size: number;
};

