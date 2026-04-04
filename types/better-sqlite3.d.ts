declare module "better-sqlite3" {
  type RunResult = {
    changes: number;
    lastInsertRowid: number | bigint;
  };

  type Statement = {
    run(...params: unknown[]): RunResult;
    get<T = unknown>(...params: unknown[]): T;
  };

  export default class Database {
    constructor(path: string, options?: { readonly?: boolean; fileMustExist?: boolean });
    prepare(sql: string): Statement;
    close(): void;
  }
}
