const LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<]+)/g;

const LINK_CLASS =
  "underline decoration-neutral-300 underline-offset-2 hover:text-foreground dark:decoration-neutral-600";

function RichInline({ text }: { text: string }) {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  const re = new RegExp(LINK_RE.source, "g");
  for (const match of text.matchAll(re)) {
    const index = match.index ?? 0;
    if (index > last) nodes.push(text.slice(last, index));
    const label = match[1];
    const href = match[2] ?? match[3];
    if (href) {
      nodes.push(
        <a
          key={`${href}-${index}`}
          href={href}
          target="_blank"
          rel="noreferrer"
          className={LINK_CLASS}
        >
          {label || href}
        </a>,
      );
    }
    last = index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes.length > 0 ? nodes : text;
}

export function LearnRichText({
  text,
  className,
  inline = false,
}: {
  text: string;
  className?: string;
  inline?: boolean;
}) {
  const blocks = text.split(/\n+/).map((block) => block.trim()).filter(Boolean);
  if (blocks.length === 0) return null;
  if (inline) {
    return (
      <span className={className}>
        <RichInline text={blocks.join(" ")} />
      </span>
    );
  }
  return (
    <div className={className}>
      {blocks.map((block, index) => (
        <p key={index} className={index > 0 ? "mt-3" : undefined}>
          <RichInline text={block} />
        </p>
      ))}
    </div>
  );
}
