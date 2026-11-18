import { describe, expect, it } from "vitest";
import * as fs from "node:fs";

// Acceptance: no real name / DOB fields anywhere in the auth schema.
describe("auth schema contains only the allowed Account fields", () => {
  it("has no real-name or birth-date columns in schema or migration", () => {
    const schema = fs.readFileSync("lib/server/auth-schema.ts", "utf8").toLowerCase();
    const migration = fs.readFileSync("db/migrations/0001_auth.sql", "utf8").toLowerCase();
    for (const banned of ["real_name", "realname", "full_name", "fullname", "first_name", "last_name", "date_of_birth", "dob", "birthdate", "birth_date"]) {
      expect(schema).not.toContain(banned);
      expect(migration).not.toContain(banned);
    }
    for (const keep of ["username", "email", "password_hash", "progress_json"]) {
      expect(schema).toContain(keep);
      expect(migration).toContain(keep);
    }
  });
});
