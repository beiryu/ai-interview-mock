/**
 * Never-claim entries must be things the documents don't mention. The model
 * listed "Spring", "Angular", "Go"… (all in the CV) and notes like "Team size
 * for X (not specified)"; claiming those as unknown would make the coach
 * deny real experience. Dropped in code, not trusted to the prompt.
 */
export function notInDocuments(entries: string[], documents: string) {
  const text = documents.toLowerCase()
  return entries.filter((entry) => {
    const name = entry.trim()
    if (!name || name.length > 40 || /not specified|\(.*\)$/i.test(name))
      return false
    const keyword = name.split(/[\s,(/]+/)[0].toLowerCase()
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    return !new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(text)
  })
}
