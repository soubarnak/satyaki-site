// Real syntax parsing for content tests. Test support only: never import
// this from shipped code, so the client bundle does not grow. Neither
// parser executes the code it reads.

import { execFileSync } from "node:child_process";
import { parse as parseJava } from "java-parser";

export function pythonParses(code: string): boolean {
  try {
    execFileSync("python3", ["-c", "import ast,sys; ast.parse(sys.stdin.read())"], {
      input: code,
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 20000,
    });
    return true;
  } catch {
    return false;
  }
}

export function javaParses(code: string): boolean {
  try {
    parseJava(code);
    return true;
  } catch {
    return false;
  }
}

/** Java snippets are bare statements; wrap them so the parser accepts them. */
export function javaSnippetParses(snippet: string): boolean {
  return javaParses(
    `public class Main {\n    public static void main(String[] args) {\n${snippet}\n    }\n}\n`,
  );
}
