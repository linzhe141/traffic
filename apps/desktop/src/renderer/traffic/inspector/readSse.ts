export interface SseEvent {
  label: string;
  detail: string;
  text: string;
}

export function createSseReader() {
  let pending = "";
  let endingCr = false;
  let event = "message";
  let lastId = "";
  let data: string[] = [];

  return (text: string): SseEvent[] => {
    if (!text) return [];
    if (endingCr && text.startsWith("\n")) text = text.slice(1);
    endingCr = text.endsWith("\r");
    const lines = (pending + text.replace(/\r\n?/g, "\n")).split("\n");
    pending = lines.pop() ?? "";
    const events: SseEvent[] = [];
    for (const line of lines) {
      if (!line) {
        if (data.length)
          events.push({
            label: event,
            detail: lastId ? `ID ${lastId}` : "",
            text: data.join("\n"),
          });
        event = "message";
        data = [];
        continue;
      }
      const separator = line.indexOf(":");
      const field = separator < 0 ? line : line.slice(0, separator);
      const value = separator < 0 ? "" : line.slice(separator + 1).replace(/^ /, "");
      if (field === "data") data.push(value);
      else if (field === "event") event = value || "message";
      else if (field === "id" && !value.includes("\0")) lastId = value;
    }
    return events;
  };
}
