import { parseBriefBody } from "@/lib/briefs/body";

/**
 * The generated document, read-only.
 *
 * THE SERIF IS NOT USED HERE, AND THAT IS THE POINT. Inter is the product's own
 * voice and all generated prose is the product's voice; Source Serif 4 is
 * reserved for quoted or verbatim material, which on this screen means the
 * citation list and the flagged claims (§11.6). Setting generated prose in the
 * serif would erase the one visual mechanism a reader has for telling what the
 * model wrote from what a source said — in a product whose whole proposition is
 * traceability.
 *
 * Editing arrives with the Tiptap prompt. This renders the stored `bodyText`.
 */
export function BriefBody({ bodyText }: { bodyText: string }) {
  const { title, blocks } = parseBriefBody(bodyText);

  return (
    <article className="bg-card border-line rounded-card flex min-w-0 flex-col gap-5 border p-4 tablet:p-6 desktop:p-8">
      <h2 className="text-ink text-h1 font-semibold break-words">{title}</h2>

      {blocks.map((block) => (
        <section key={block.offset} className="flex min-w-0 flex-col gap-2">
          <h3
            className={
              block.body === ""
                ? "text-ink-3 text-meta border-line border-b pb-1 font-semibold tracking-[0.06em] uppercase break-words"
                : "text-ink text-h3 font-semibold break-words"
            }
          >
            {block.heading}
          </h3>
          {block.body === "" ? null : (
            <div className="text-ink-2 flex max-w-[70ch] flex-col gap-2 text-[14.5px] leading-[1.7]">
              {block.body.split("\n").map((line, index) => (
                <p key={index} className="break-words">
                  {line}
                </p>
              ))}
            </div>
          )}
        </section>
      ))}
    </article>
  );
}
