/**
 * F-24: Web Dashboard Export.
 * Renders a note with all its widgets as a standalone HTML dashboard.
 */

export function renderDashboardHtml(noteTitle: string, content: string, liveDataBlocks: Array<{ topic?: string; url?: string; value: unknown }>): string {
    const blocksHtml = liveDataBlocks
        .map((b) => `<div class="widget"><strong>${b.topic ?? b.url ?? "Widget"}</strong><p>${b.value}</p></div>`)
        .join("\n");

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${noteTitle} - Live Dashboard</title>
    <style>
        body { font-family: sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 { color: #333; }
        .widgets { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; }
        .widget { background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .widget strong { display: block; margin-bottom: 10px; color: #0066cc; }
        .widget p { margin: 0; font-size: 24px; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <h1>${noteTitle}</h1>
        <div class="widgets">${blocksHtml}</div>
        <p style="margin-top: 40px; color: #999; font-size: 12px;">Generated with Live Data Hub</p>
    </div>
</body>
</html>`;
}
