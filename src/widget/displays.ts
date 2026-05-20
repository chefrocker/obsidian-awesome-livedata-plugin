import type { DisplayType, WidgetConfig } from "../parser/block-parser";

export interface DisplayContext {
    el: HTMLElement;
    cfg: WidgetConfig;
}

export function renderDisplay(ctx: DisplayContext, value: unknown): void {
    ctx.el.empty();
    switch (ctx.cfg.display) {
        case "number":    return renderNumber(ctx, value);
        case "text":      return renderText(ctx, value);
        case "badge":     return renderBadge(ctx, value);
        case "toggle":    return renderToggle(ctx, value);
        case "gauge":     return renderGauge(ctx, value);
        case "sparkline": return renderSparkline(ctx, value);
        case "progress":  return renderProgress(ctx, value);
        default:          return renderText(ctx, value);
    }
}

function renderNumber(ctx: DisplayContext, value: unknown): void {
    const numStr = formatNumber(value);
    const color = colorForValue(ctx.cfg, value);
    const span = ctx.el.createSpan({ cls: "live-data-widget-number", text: numStr });
    if (color) span.style.color = color;
    if (ctx.cfg.unit) ctx.el.createSpan({ cls: "live-data-widget-unit", text: ` ${ctx.cfg.unit}` });
}

function renderText(ctx: DisplayContext, value: unknown): void {
    const span = ctx.el.createSpan({ cls: "live-data-widget-text", text: String(value ?? "—") });
    const color = colorForValue(ctx.cfg, value);
    if (color) span.style.color = color;
    if (ctx.cfg.unit) ctx.el.createSpan({ cls: "live-data-widget-unit", text: ` ${ctx.cfg.unit}` });
}

function renderBadge(ctx: DisplayContext, value: unknown): void {
    const str = String(value ?? "").trim();
    const variant = classifyBadge(str);
    const badge = ctx.el.createDiv({ cls: `live-data-widget-badge live-data-widget-badge-${variant}` });
    badge.setText(str || "—");
}

function classifyBadge(s: string): "ok" | "warn" | "error" | "neutral" {
    const low = s.toLowerCase();
    if (["ok", "up", "online", "ready", "success", "true", "1", "on", "enabled"].includes(low)) return "ok";
    if (["warn", "warning", "degraded", "stale", "caution"].includes(low)) return "warn";
    if (["err", "error", "down", "offline", "fail", "failed", "false", "0", "off", "disabled"].includes(low)) return "error";
    return "neutral";
}

function renderToggle(ctx: DisplayContext, value: unknown): void {
    const truthy = isTruthy(value);
    const wrap = ctx.el.createDiv({ cls: "live-data-widget-toggle" });
    wrap.createSpan({ cls: truthy ? "live-data-widget-toggle-on" : "live-data-widget-toggle-off", text: truthy ? "ON" : "OFF" });
}

function renderGauge(ctx: DisplayContext, value: unknown): void {
    const n = Number(value);
    if (!Number.isFinite(n)) { ctx.el.setText("—"); return; }
    const min = parseFloat(ctx.cfg.raw?.gaugeMin ?? "0");
    const max = parseFloat(ctx.cfg.raw?.gaugeMax ?? "100");
    const pct = Math.min(100, Math.max(0, ((n - min) / (max - min)) * 100));
    const color = colorForValue(ctx.cfg, n);

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "120");
    svg.setAttribute("height", "70");
    svg.setAttribute("viewBox", "0 0 120 70");
    svg.classList.add("live-data-widget-gauge");

    const bg = document.createElementNS("http://www.w3.org/2000/svg", "path");
    bg.setAttribute("d", "M 10 60 A 50 50 0 0 1 110 60");
    bg.setAttribute("fill", "none");
    bg.setAttribute("stroke", "var(--background-modifier-border)");
    bg.setAttribute("stroke-width", "8");
    svg.appendChild(bg);

    const fill = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const angle = (pct / 100) * Math.PI;
    const x = 60 + 50 * Math.cos(Math.PI + angle);
    const y = 60 + 50 * Math.sin(Math.PI + angle);
    fill.setAttribute("d", `M 60 60 L 60 10 A 50 50 0 0 1 ${x} ${y} Z`);
    fill.setAttribute("fill", color || "var(--interactive-accent)");
    fill.setAttribute("opacity", "0.6");
    svg.appendChild(fill);

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", "60");
    text.setAttribute("y", "55");
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("font-size", "16");
    text.setAttribute("font-weight", "600");
    text.setAttribute("fill", color || "var(--text-normal)");
    text.textContent = pct.toFixed(0) + "%";
    svg.appendChild(text);

    ctx.el.appendChild(svg);
}

function renderSparkline(ctx: DisplayContext, value: unknown): void {
    const key = `sparkline:${ctx.cfg.url ?? ctx.cfg.topic ?? ""}`;
    const w = window as unknown as Record<string, unknown>;
    const store = (w.__ldh_sparklines = (w.__ldh_sparklines as Record<string, number[]>) || {}) as Record<string, number[]>;
    if (!store[key]) store[key] = [];
    const hist = store[key];
    hist.push(Number(value));
    if (hist.length > 60) hist.shift();

    const canvas = document.createElement("canvas");
    canvas.width = 120;
    canvas.height = 40;
    canvas.classList.add("live-data-widget-sparkline");
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d || hist.length === 0) { ctx.el.appendChild(canvas); return; }

    const min = Math.min(...hist);
    const max = Math.max(...hist);
    const range = max === min ? 1 : max - min;

    ctx2d.strokeStyle = "var(--interactive-accent)";
    ctx2d.lineWidth = 2;
    ctx2d.beginPath();
    for (let i = 0; i < hist.length; i++) {
        const x = (i / (hist.length - 1 || 1)) * canvas.width;
        const norm = (hist[i] - min) / range;
        const y = canvas.height - norm * canvas.height;
        if (i === 0) ctx2d.moveTo(x, y);
        else ctx2d.lineTo(x, y);
    }
    ctx2d.stroke();
    ctx.el.appendChild(canvas);
}

function renderProgress(ctx: DisplayContext, value: unknown): void {
    const n = Number(value);
    if (!Number.isFinite(n)) { ctx.el.setText("—"); return; }
    const pct = Math.min(100, Math.max(0, n));
    const color = colorForValue(ctx.cfg, n);
    const wrap = ctx.el.createDiv({ cls: "live-data-widget-progress-wrap" });
    const bar = wrap.createDiv({ cls: "live-data-widget-progress-bar" });
    bar.style.width = pct + "%";
    bar.style.backgroundColor = color || "var(--interactive-accent)";
    wrap.createSpan({ cls: "live-data-widget-progress-label", text: pct.toFixed(0) + "%" });
}

function colorForValue(cfg: WidgetConfig, value: unknown): string | null {
    const ranges = cfg.raw?.colorRanges;
    if (!ranges) return null;
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    const pairs = ranges.split(";").map(p => {
        const [min, max, color] = p.split(":").map(x => x.trim());
        return { min: parseFloat(min), max: parseFloat(max), color };
    });
    for (const { min, max, color } of pairs) {
        if (n >= min && n <= max) return color;
    }
    return null;
}

function formatNumber(value: unknown): string {
    if (typeof value === "number") return String(value);
    const n = Number(String(value).replace(",", "."));
    if (Number.isFinite(n)) return String(n);
    return String(value ?? "—");
}

function isTruthy(v: unknown): boolean {
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v !== 0;
    const s = String(v ?? "").trim().toLowerCase();
    return ["true", "1", "on", "yes", "ok", "enabled"].includes(s);
}

export const ALL_DISPLAYS: DisplayType[] = ["number", "text", "badge", "toggle", "gauge", "sparkline", "progress"];
