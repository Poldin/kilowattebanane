export function xmlBlocks(xml: string, tag: string) {
  const re = new RegExp(
    `<(?:[\\w.-]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?${tag}>`,
    "gi",
  );
  return [...xml.matchAll(re)].map((match) => match[1]);
}

export function xmlText(xml: string, tag: string) {
  const inner = xmlBlocks(xml, tag)[0];
  if (inner == null) return null;
  const direct = inner.replace(/<[\s\S]*>/g, "").trim();
  return direct || null;
}

export function xmlTexts(xml: string, tag: string) {
  return xmlBlocks(xml, tag)
    .map((inner) => inner.replace(/<[\s\S]*>/g, "").trim())
    .filter(Boolean);
}
