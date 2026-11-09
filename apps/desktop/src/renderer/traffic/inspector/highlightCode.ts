import { createHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import json from "@shikijs/langs/json";
import html from "@shikijs/langs/html";
import xml from "@shikijs/langs/xml";
import css from "@shikijs/langs/css";
import javascript from "@shikijs/langs/javascript";
import http from "@shikijs/langs/http";
import githubLight from "@shikijs/themes/github-light";
import githubDark from "@shikijs/themes/github-dark";

export type CodeLanguage = "json" | "html" | "xml" | "css" | "javascript" | "http" | "text";
let highlighter: ReturnType<typeof createHighlighterCore> | undefined;

export async function tokenizeCode(code: string, language: CodeLanguage) {
  highlighter ??= createHighlighterCore({
    langs: [json, html, xml, css, javascript, http],
    themes: [githubLight, githubDark],
    engine: createJavaScriptRegexEngine(),
  });
  const engine = await highlighter;
  return engine.codeToTokens(code, {
    lang: language,
    themes: { light: "github-light", dark: "github-dark" },
  }).tokens;
}
