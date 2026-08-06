import "server-only";

import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * The rendered Word bytes, converted to PDF by Pandoc.
 *
 * ONE DOCUMENT MAPPING, NOT TWO — the same argument `gdoc.ts` makes, and the
 * reason this module takes bytes rather than a Tiptap document. A second
 * mapping (document → Markdown → Pandoc) would be a second place for the
 * headings, the citation keys, the References section, the flag notice and the
 * open-claims list to be expressed, and therefore a second place for a brief to
 * reach a ministry looking unflagged (§16.8, §9.5, `hallucination-guard`).
 * Inheriting the guard contract beats controlling the typography, and it is
 * also what keeps the PDF page-for-page the Word file the §16.1 length targets
 * were written against.
 *
 * PANDOC IS AN EXTERNAL BINARY, AND ITS ABSENCE IS A HANDLED STATE rather than
 * a crash (`tiptap-editor` → Export). `pandocConfig()` returns null unless the
 * deployment declares `PANDOC_BIN`, the same `null`-when-unconfigured shape
 * `driveOAuthConfig()` and `whatsappConfig()` use. There is no `which pandoc`
 * probe: a declaration is a confirmation where a probe is a guess that costs a
 * process spawn on every export. Vercel does not ship Pandoc, so on the current
 * hosting target PDF is simply not offered — no vendored binary, no build step,
 * no substitute JS library, because the contract names Pandoc.
 *
 * IT KNOWS NOTHING ABOUT BRIEFS, FLAGS, ROLES OR PRISMA. Bytes and a config in;
 * bytes or a typed reason out. The Route Handler authorises and reads.
 */

export type PandocConfig = {
  bin: string;
  pdfEngine: string;
};

/**
 * Pandoc's own default engine is `pdflatex`, which wants a multi-gigabyte TeX
 * installation a four-person organisation on free tiers will not have.
 * WeasyPrint renders through HTML/CSS and is a `pip install`.
 */
const DEFAULT_PDF_ENGINE = "weasyprint";

/** The only place either variable is read. Neither is `NEXT_PUBLIC_*` (§18). */
export function pandocConfig(): PandocConfig | null {
  const bin = process.env.PANDOC_BIN?.trim();

  if (!bin) return null;

  const pdfEngine = process.env.PANDOC_PDF_ENGINE?.trim();

  return { bin, pdfEngine: pdfEngine || DEFAULT_PDF_ENGINE };
}

/** For the page, mirroring `isDriveExportConfigured()`. */
export function isPdfExportConfigured(): boolean {
  return pandocConfig() !== null;
}

/**
 * A conversion that has not finished in a minute is not going to. The cap is
 * the denial-of-service control: a malformed document must not pin a process.
 */
const CONVERSION_TIMEOUT_MS = 60_000;

/** A brief is prose. A PDF larger than this is a fault, not a long document. */
const MAX_PDF_BYTES = 40 * 1024 * 1024;

/**
 * Pandoc's own chatter, bounded. It is never read into a log line — see below —
 * but an unbounded buffer for output nobody uses would still be a way to spend
 * memory.
 */
const MAX_DIAGNOSTIC_BYTES = 64 * 1024;

export type PdfRenderResult =
  // The same byte shape `renderBriefDocx` returns, so both downloads leave this
  // route the same way.
  | { ok: true; bytes: Uint8Array<ArrayBuffer> }
  | { ok: false; reason: "unavailable" | "failed" | "timeout" };

/**
 * `docx` in, PDF out, through a scratch directory.
 *
 * VIA FILES, AND THAT IS PANDOC'S DOCUMENTED SURFACE RATHER THAN A PREFERENCE.
 * The manual's `-t` list carries no `pdf` writer — PDF is selected by the
 * output file's `.pdf` extension ("To produce a PDF, specify an output file
 * with a .pdf extension") — and `-o -` is documented to write a non-textual
 * format to stdout for `docx`, `odt` and `epub` only. So the output cannot be a
 * pipe, and once a scratch directory exists for the output there is nothing
 * left for stdin to buy: feeding the input from the same directory also avoids
 * the `--file-scope`-implied-by-binary-input behaviour that reading a `docx`
 * from stdin runs into.
 *
 * THE DIRECTORY IS `mkdtemp`-RANDOM AND THE FILENAMES ARE FIXED. Neither
 * derives from a brief's title, which is document content (§7.6), and both are
 * removed in a `finally` whichever way the conversion ends.
 *
 * NO SHELL, EVER. `execFile` with an argument array; the only strings in it are
 * the two configured values and two paths this function generated. Nothing
 * officer-authored reaches the argument list.
 *
 * `--sandbox` IS DELIBERATELY NOT PASSED. The manual warns that the `docx`
 * reader needs data files a sandboxed run cannot reach and "will raise an
 * error" — it would break the only input this function ever receives, which is
 * a document this application rendered itself moments earlier rather than
 * anything uploaded.
 */
export async function renderPdfFromDocx(input: {
  config: PandocConfig;
  docxBytes: Uint8Array;
}): Promise<PdfRenderResult> {
  let directory: string;

  try {
    // 0o700 by construction on POSIX, and a name no one can predict.
    directory = await mkdtemp(join(tmpdir(), "evibrief-export-"));
  } catch {
    return { ok: false, reason: "failed" };
  }

  const sourcePath = join(directory, "brief.docx");
  const outputPath = join(directory, "brief.pdf");

  try {
    await writeFile(sourcePath, input.docxBytes, { mode: 0o600 });

    const run = await runPandoc({
      config: input.config,
      sourcePath,
      outputPath,
    });

    if (!run.ok) return run;

    const written = await stat(outputPath).catch(() => null);

    if (!written || written.size === 0 || written.size > MAX_PDF_BYTES) {
      // Pandoc exited 0 and left nothing usable behind. A truncated or absent
      // file is never sent as a download.
      console.warn("pandoc.convert.empty", { byteLength: written?.size ?? 0 });

      return { ok: false, reason: "failed" };
    }

    // Copied out of the Buffer's pooled allocation rather than handed over as a
    // view onto it.
    return { ok: true, bytes: new Uint8Array(await readFile(outputPath)) };
  } catch {
    return { ok: false, reason: "failed" };
  } finally {
    await rm(directory, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * The spawn itself, and the three ways it ends.
 *
 * NEVER LOG STDERR VERBATIM. A converter's diagnostics can quote the document
 * it was converting, and a brief's body is document content (§7.6). An exit
 * code is what goes in the log line, in `gdoc.ts`'s status-only style — never
 * the title, never a path, never a byte of the document.
 */
function runPandoc(input: {
  config: PandocConfig;
  sourcePath: string;
  outputPath: string;
}): Promise<{ ok: true } | { ok: false; reason: "unavailable" | "failed" | "timeout" }> {
  const args = [
    "--from=docx",
    `--pdf-engine=${input.config.pdfEngine}`,
    `--output=${input.outputPath}`,
    input.sourcePath,
  ];

  return new Promise((resolve) => {
    execFile(
      input.config.bin,
      args,
      {
        timeout: CONVERSION_TIMEOUT_MS,
        maxBuffer: MAX_DIAGNOSTIC_BYTES,
        windowsHide: true,
      },
      (error) => {
        if (!error) {
          resolve({ ok: true });
          return;
        }

        const failure = error as NodeJS.ErrnoException & {
          killed?: boolean;
          code?: number | string;
        };

        // The binary at PANDOC_BIN could not be started at all: a wrong path, a
        // file with no execute bit, a deployment that never had Pandoc.
        if (failure.code === "ENOENT" || failure.code === "EACCES") {
          console.warn("pandoc.convert.unavailable", { code: failure.code });

          resolve({ ok: false, reason: "unavailable" });
          return;
        }

        if (failure.killed) {
          console.warn("pandoc.convert.timeout", {
            timeoutMs: CONVERSION_TIMEOUT_MS,
          });

          resolve({ ok: false, reason: "timeout" });
          return;
        }

        // Pandoc ran and did not produce a document — a missing PDF engine
        // being the ordinary cause. Exit code only.
        console.warn("pandoc.convert.failed", {
          exitCode: typeof failure.code === "number" ? failure.code : null,
        });

        resolve({ ok: false, reason: "failed" });
      },
    );
  });
}
