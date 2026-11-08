export function normalizeProcessTargetTokens(value: string): string[] {
  const targets = new Map<string, string>();
  for (const token of value.split(",")) {
    const target = token.trim();
    if (target && !targets.has(target.toLowerCase())) {
      targets.set(target.toLowerCase(), target);
    }
  }
  return [...targets.values()];
}

export function isProcessTargetGroupSelected(selected: string[], group: string): boolean {
  const groupTokens = normalizeProcessTargetTokens(group);
  const selectedTokens = new Set(selected.map((target) => target.toLowerCase()));
  return (
    groupTokens.length > 0 &&
    groupTokens.every((target) => selectedTokens.has(target.toLowerCase()))
  );
}

export function updateProcessTargetSelection(selected: string[], group: string): string[] {
  const groupTokens = normalizeProcessTargetTokens(group);
  if (isProcessTargetGroupSelected(selected, group)) {
    const removedTokens = new Set(groupTokens.map((target) => target.toLowerCase()));
    return normalizeProcessTargetTokens(selected.join(",")).filter(
      (target) => !removedTokens.has(target.toLowerCase()),
    );
  }
  return normalizeProcessTargetTokens([...selected, ...groupTokens].join(","));
}
