import type { FullResult, Reporter, TestCase, TestResult } from "@playwright/test/reporter";
import { readFile, writeFile } from "node:fs/promises";

export function redactCredentials(text: string) {
  for (const [name, value] of Object.entries(process.env)) {
    if (value && /^E2E_MEMBER_.*_(EMAIL|PASSWORD)$/.test(name)) text = text.replaceAll(value, "[redacted]");
  }
  return text;
}

// Never persist API-step parameters. Traces, automatic screenshots and automatic
// DOM snapshots are separately disabled for credentialed runs in the config.
export default class CredentialSafeReporter implements Reporter {
  private counts: Record<string, number> = {};
  onStdOut(chunk: string | Buffer) { process.stdout.write(redactCredentials(String(chunk))); }
  onStdErr(chunk: string | Buffer) { process.stderr.write(redactCredentials(String(chunk))); }
  async onTestEnd(test: TestCase, result: TestResult) {
    this.counts[result.status] = (this.counts[result.status] ?? 0) + 1;
    console.log(redactCredentials(`${result.status}: ${test.titlePath().filter(Boolean).join(" › ")}`));
    for (const error of result.errors) console.error(redactCredentials(error.message ?? error.value ?? "Test failed."));
    for (const attachment of result.attachments) {
      if (!attachment.path || !/^(text\/|application\/json)/.test(attachment.contentType)) continue;
      const text = await readFile(attachment.path, "utf8");
      const safe = redactCredentials(text);
      if (text !== safe) await writeFile(attachment.path, safe);
    }
  }
  onError(error: { message?: string; value?: string }) { console.error(redactCredentials(error.message ?? error.value ?? "Test runner failed.")); }
  onEnd(result: FullResult) { console.log(JSON.stringify({ status: result.status, tests: this.counts })); }
  printsToStdio() { return true; }
}
