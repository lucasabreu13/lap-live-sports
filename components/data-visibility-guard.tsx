"use client";

import { useEffect } from "react";

const PLACEHOLDER_PATTERNS = [
  /^não confirmad[oa]$/i,
  /^a definir$/i,
  /^não informad[oa]$/i,
  /^local não informado$/i,
  /^data a confirmar$/i,
  /^posição não publicada$/i,
  /^salário não publicado$/i,
  /^tipo não informado$/i,
  /^dados oficiais em atualização\.?$/i,
  /^classificação em atualização\.?$/i,
  /^agenda em atualização\.?$/i,
  /^temporada em atualização\.?$/i,
  /^—$/,
];

function normalizedText(element: Element) {
  return (element.textContent || "").replace(/\s+/g, " ").trim();
}

function isPlaceholder(value: string) {
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value));
}

function hidePlaceholder(element: HTMLElement) {
  const container = element.closest<HTMLElement>("article, tr, li, .empty-card, .game-panel__empty, .agenda-empty, .status-note");
  if (container) {
    container.hidden = true;
    container.setAttribute("data-lap-hidden-missing", "true");
    return;
  }
  element.hidden = true;
  element.setAttribute("data-lap-hidden-missing", "true");
}

function restoreRealData(root: ParentNode) {
  root.querySelectorAll<HTMLElement>("[data-lap-hidden-missing='true']").forEach((element) => {
    const text = normalizedText(element);
    if (text && !isPlaceholder(text)) {
      element.hidden = false;
      element.removeAttribute("data-lap-hidden-missing");
    }
  });
}

function clean(root: ParentNode) {
  restoreRealData(root);
  root.querySelectorAll<HTMLElement>("strong, span, small, p, td, dd").forEach((element) => {
    const text = normalizedText(element);
    if (text && isPlaceholder(text)) hidePlaceholder(element);
  });

  root.querySelectorAll<HTMLElement>("section, article, div").forEach((element) => {
    if (element.closest("header, nav, footer")) return;
    const visibleChildren = [...element.children].filter((child) => !(child as HTMLElement).hidden);
    if (!visibleChildren.length && !normalizedText(element)) element.hidden = true;
  });
}

export function DataVisibilityGuard() {
  useEffect(() => {
    let scheduled = 0;
    const run = () => {
      window.cancelAnimationFrame(scheduled);
      scheduled = window.requestAnimationFrame(() => clean(document.body));
    };
    run();
    const observer = new MutationObserver(run);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(scheduled);
    };
  }, []);
  return null;
}
