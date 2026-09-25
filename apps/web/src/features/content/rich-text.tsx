import type {
  ReactNode,
} from "react";

function inlineText(
  text: string,
): ReactNode[] {
  const parts = text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean);

  return parts.map(
    (
      part,
      index,
    ) =>
      part.startsWith("**") &&
      part.endsWith("**") ? (
        <strong
          key={index}
          className="font-semibold text-foreground"
        >
          {part.slice(2, -2)}
        </strong>
      ) : (
        <span key={index}>
          {part}
        </span>
      ),
  );
}

export function CmsRichText({
  content,
}: {
  content: string;
}) {
  const blocks = content
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return (
    <div className="space-y-5 text-base leading-relaxed text-slate-600">
      {blocks.map(
        (
          block,
          index,
        ) => {
          if (/^###\s+/.test(block)) {
            return (
              <h3
                key={index}
                className="pt-2 text-lg font-bold text-foreground"
              >
                {inlineText(
                  block.replace(
                    /^###\s+/,
                    "",
                  ),
                )}
              </h3>
            );
          }

          if (/^##\s+/.test(block)) {
            return (
              <h2
                key={index}
                className="pt-4 text-2xl font-extrabold text-foreground"
              >
                {inlineText(
                  block.replace(
                    /^##\s+/,
                    "",
                  ),
                )}
              </h2>
            );
          }

          if (
            /^(-{3,}|\*{3,})$/.test(
              block,
            )
          ) {
            return (
              <hr
                key={index}
                className="border-slate-200/70"
              />
            );
          }

          const lines = block
            .split("\n")
            .map((line) => line.trim());

          if (
            lines.every((line) =>
              /^[-*•]\s+/.test(line),
            )
          ) {
            return (
              <ul
                key={index}
                className="list-disc space-y-2 ps-6"
              >
                {lines.map(
                  (
                    line,
                    lineIndex,
                  ) => (
                    <li key={lineIndex}>
                      {inlineText(
                        line.replace(
                          /^[-*•]\s+/,
                          "",
                        ),
                      )}
                    </li>
                  ),
                )}
              </ul>
            );
          }

          if (
            lines.every((line) =>
              /^\d+[.)]\s+/.test(line),
            )
          ) {
            return (
              <ol
                key={index}
                className="list-decimal space-y-2 ps-6"
              >
                {lines.map(
                  (
                    line,
                    lineIndex,
                  ) => (
                    <li key={lineIndex}>
                      {inlineText(
                        line.replace(
                          /^\d+[.)]\s+/,
                          "",
                        ),
                      )}
                    </li>
                  ),
                )}
              </ol>
            );
          }

          return (
            <p key={index}>
              {inlineText(block)}
            </p>
          );
        },
      )}
    </div>
  );
}
