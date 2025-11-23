declare module 'node:test' {
  export type Hook = () => void | Promise<void>;
  export function beforeEach(fn: Hook): void;
  export function describe(name: string, fn: Hook): void;
  export function test(name: string, fn: Hook): void;
}

declare module 'node:assert' {
  namespace assert {
    function ok(value: unknown, message?: string | Error): asserts value;
    function strictEqual<T>(actual: T, expected: T, message?: string | Error): void;
  }
  export = assert;
}
