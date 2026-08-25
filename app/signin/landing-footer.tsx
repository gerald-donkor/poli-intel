import { ShieldCheck } from "lucide-react";

export function LandingFooter() {
  return (
    <footer data-anim="footer" className="mt-auto border-t border-line bg-card">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-4 py-10 tablet:px-8 tablet:py-12">
        <div className="grid grid-cols-1 gap-8 laptop:grid-cols-12">
          {/* Tropenbos Identity */}
          <div data-anim="footer-item" className="flex flex-col gap-3 laptop:col-span-6">
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="size-[16px] rounded-[2px] border-2 border-primary"
              />
              <span className="text-[13px] font-semibold tracking-[0.12em] uppercase text-primary">
                EviBrief · Tropenbos Ghana
              </span>
            </div>
            <p className="max-w-[480px] text-body leading-relaxed text-ink-3">
              Policy Intelligence & Brief Generator module built for Tropenbos Ghana,
              connecting landscape empirical research in Juabeso-Bia and Sefwi-Wiawso
              to national and international policy windows.
            </p>
          </div>

          {/* Network and Governance Details */}
          <div className="grid grid-cols-1 gap-6 tablet:grid-cols-2 laptop:col-span-6">
            <div data-anim="footer-item" className="flex flex-col gap-2">
              <span className="font-mono text-meta font-semibold uppercase tracking-wider text-ink">
                Network Affiliation
              </span>
              <p className="text-meta leading-relaxed text-ink-3">
                Part of the{" "}
                <strong className="font-medium text-ink">
                  Tropenbos International
                </strong>{" "}
                network operating across 10 countries in Africa, Latin America,
                and Asia.
              </p>
            </div>

            <div data-anim="footer-item" className="flex flex-col gap-2">
              <span className="font-mono text-meta font-semibold uppercase tracking-wider text-ink">
                Data Governance
              </span>
              <p className="text-meta leading-relaxed text-ink-3">
                Community testimonies, field observations, and farmer tenure data
                are strictly protected under institutional ethics and consent
                protocols.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Line */}
        <div
          data-anim="footer-item"
          className="flex flex-col items-center justify-between gap-4 border-t border-line/60 pt-6 text-meta text-ink-3 tablet:flex-row"
        >
          <p className="text-center tablet:text-left">
            © {new Date().getFullYear()} Tropenbos Ghana. All rights reserved.
            Institutional use only.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="size-3.5 text-primary" />
              <span>WCAG 2.1 AA Compliant</span>
            </span>
            <span>·</span>
            <span>Research-First Design</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
