import { expect, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

export type AxeSeverity = "critical" | "serious" | "moderate" | "minor";

export interface A11yResult {
  violations: AxeViolation[];
  passes: number;
  incomplete: number;
  inapplicable: number;
}

interface AxeViolation {
  id: string;
  impact: AxeSeverity;
  description: string;
  helpUrl: string;
  nodes: { html: string; target: string[] }[];
}

export async function scanPage(
  page: Page,
  options: {
    include?: string;
    disableRules?: string[];
    minImpact?: AxeSeverity;
  } = {},
): Promise<A11yResult> {
  const disabled = ["color-contrast", "button-name", ...(options.disableRules || [])];
  const builder = new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
    .disableRules(disabled);

  if (options.include) builder.include(options.include);

  const raw = await builder.analyze();
  const impactOrder: AxeSeverity[] = ["critical", "serious", "moderate", "minor"];
  const minIdx = impactOrder.indexOf(options.minImpact ?? "moderate");

  const violations = raw.violations
    .filter((v) => impactOrder.indexOf(v.impact as AxeSeverity) <= minIdx)
    .map((v) => ({
      id: v.id,
      impact: v.impact as AxeSeverity,
      description: v.description,
      helpUrl: v.helpUrl,
      nodes: v.nodes.map((n) => ({ html: n.html, target: n.target as string[] })),
    }));

  return {
    violations,
    passes: raw.passes.length,
    incomplete: raw.incomplete.length,
    inapplicable: raw.inapplicable.length,
  };
}

export async function assertNoCriticalViolations(page: Page, screenName = "page"): Promise<void> {
  const result = await scanPage(page, { minImpact: "serious" });
  if (result.violations.length === 0) return;

  const summary = result.violations
    .map(
      (v) =>
        `\n  [${v.impact.toUpperCase()}] ${v.id}: ${v.description}\n` +
        `  -> ${v.helpUrl}\n` +
        v.nodes
          .slice(0, 2)
          .map((n) => `  HTML: ${n.html.slice(0, 120)}...`)
          .join("\n"),
    )
    .join("\n");

  throw new Error(`A11y violations on screen "${screenName}":\n${summary}`);
}

export async function assertZeroViolations(page: Page, screenName = "page"): Promise<void> {
  const result = await scanPage(page, { minImpact: "minor" });
  const critical = result.violations.filter((v) => ["critical", "serious"].includes(v.impact));
  const moderate = result.violations.filter((v) => v.impact === "moderate");
  if (critical.length === 0 && moderate.length === 0) return;

  const all = [...critical, ...moderate];
  const summary = all.map((v) => `\n  [${v.impact}] ${v.id} - ${v.description}`).join("");
  throw new Error(`${all.length} a11y violation(s) on "${screenName}":${summary}`);
}

export async function assertMinTapTargets(page: Page, minPx = 44): Promise<void> {
  const violations = await page.evaluate((min) => {
    const selectors =
      "a, button, input, select, textarea, [role='button'], [role='link'], [tabindex]";
    const elements = Array.from(document.querySelectorAll<HTMLElement>(selectors));
    const bad: { tag: string; text: string; w: number; h: number }[] = [];

    elements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && (rect.width < min || rect.height < min)) {
        bad.push({
          tag: el.tagName,
          text: el.textContent?.trim().slice(0, 60) ?? "",
          w: Math.round(rect.width),
          h: Math.round(rect.height),
        });
      }
    });

    return bad;
  }, minPx);

  if (violations.length > 0) {
    const summary = violations.map((v) => `  ${v.tag} "${v.text}" - ${v.w}x${v.h}px`).join("\n");
    console.warn(`Tap targets below ${minPx}px:\n${summary}`);
  }
}

export async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(scrollWidth, "Page must not have horizontal scroll").toBeLessThanOrEqual(clientWidth + 1);
}

export async function tabThroughPage(page: Page, maxTabs = 50): Promise<string[]> {
  const focusedElements: string[] = [];
  await page.keyboard.press("Tab");

  for (let i = 0; i < maxTabs; i++) {
    const focusInfo = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      if (!el || el === document.body) return null;
      return {
        tag: el.tagName,
        ariaLabel: el.getAttribute("aria-label") ?? "",
        text: el.textContent?.trim().slice(0, 80) ?? "",
        role: el.getAttribute("role") ?? "",
        type: (el as HTMLInputElement).type ?? "",
      };
    });

    if (!focusInfo) break;
    const label =
      focusInfo.ariaLabel || focusInfo.text || `${focusInfo.tag}[${focusInfo.type || focusInfo.role}]`;
    focusedElements.push(label);
    await page.keyboard.press("Tab");
  }
  return focusedElements;
}
