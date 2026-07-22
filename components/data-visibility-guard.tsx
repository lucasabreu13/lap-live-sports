"use client";

import { useEffect } from "react";

const PLACEHOLDER_PATTERNS = [
  /^não confirmad[oa]$/i,
  /^a definir$/i,
  /^a confirmar$/i,
  /^horário a confirmar$/i,
  /^local a confirmar$/i,
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

function elements(root: ParentNode, selector: string) {
  const matches = [...root.querySelectorAll<HTMLElement>(selector)];
  if (root instanceof HTMLElement && root.matches(selector)) matches.unshift(root);
  return matches;
}

function markHidden(element: HTMLElement) {
  element.hidden = true;
  element.setAttribute("data-lap-hidden-missing", "true");
}

function hidePlaceholder(element: HTMLElement) {
  if ((element.tagName === "STRONG" || element.tagName === "SMALL") && element.parentElement?.tagName === "SPAN") {
    markHidden(element.parentElement);
    return;
  }
  const container = element.closest<HTMLElement>("article, tr, li, .empty-card, .game-panel__empty, .agenda-empty, .status-note");
  if (container) {
    markHidden(container);
    return;
  }
  markHidden(element);
}

function restoreRealData(root: ParentNode) {
  elements(root, "[data-lap-hidden-missing='true']").forEach((element) => {
    const text = normalizedText(element);
    if (text && !isPlaceholder(text)) {
      element.hidden = false;
      element.removeAttribute("data-lap-hidden-missing");
    }
  });
}

function clean(root: ParentNode) {
  restoreRealData(root);
  elements(root, "strong, span, small, p, td, dd").forEach((element) => {
    const text = normalizedText(element);
    if (text && isPlaceholder(text)) hidePlaceholder(element);
  });

  elements(root, "section, article, div").forEach((element) => {
    if (element.closest("header, nav, footer")) return;
    const visibleChildren = [...element.children].filter((child) => !(child as HTMLElement).hidden);
    if (!visibleChildren.length && !normalizedText(element)) element.hidden = true;
  });
}

export function DataVisibilityGuard() {
  useEffect(() => {
    let scheduled = 0;
    const pending = new Set<ParentNode>();
    const flush = () => {
      scheduled = 0;
      const roots = [...pending];
      pending.clear();
      roots.forEach(clean);
    };
    const schedule = (root: ParentNode) => {
      pending.add(root);
      if (!scheduled) scheduled = window.requestAnimationFrame(flush);
    };

    clean(document.body);
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "characterData" && mutation.target.parentElement) schedule(mutation.target.parentElement);
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) schedule(node);
          else if (node.parentElement) schedule(node.parentElement);
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      if (scheduled) window.cancelAnimationFrame(scheduled);
      pending.clear();
    };
  }, []);
  return null;
}
