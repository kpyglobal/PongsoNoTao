#!/usr/bin/env python3
"""Playwright screenshots for the interactive guide. Short-lived static server."""
from __future__ import annotations

import http.server
import os
import socketserver
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path("/workspace/tao-rpg/dist")
OUT = Path("/workspace/tao-rpg/screenshots-guide")
PORT = 8841
CHROME = "/usr/bin/google-chrome"

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt, *args):
        pass


class ReuseServer(socketserver.TCPServer):
    allow_reuse_address = True

def start_server():
    httpd = ReuseServer(("127.0.0.1", PORT), Handler)
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    return httpd


def wait_ready(page):
    page.wait_for_function("() => document.documentElement.dataset.guideReady === '1'", timeout=20000)
    page.wait_for_function("() => document.fonts && document.fonts.status === 'loaded'", timeout=15000)
    page.wait_for_timeout(250)


def shot(page, name, full=True):
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / name
    page.screenshot(path=str(path), full_page=full, animations="disabled")
    print("wrote", path.name, path.stat().st_size // 1024, "KB")


def collect_errors(page, bucket):
    page.on("pageerror", lambda exc: bucket.append(f"pageerror: {exc}"))
    page.on("console", lambda msg: bucket.append(f"console.{msg.type}: {msg.text}") if msg.type == "error" else None)
    page.on("requestfailed", lambda req: bucket.append(f"requestfailed: {req.url} {req.failure}") if req.failure else None)
    page.on("response", lambda res: bucket.append(f"http{res.status}: {res.url}") if res.status >= 400 else None)


def run_viewport(browser, tag, viewport, device_scale, is_mobile, errors):
    context = browser.new_context(
        viewport=viewport,
        device_scale_factor=device_scale,
        is_mobile=is_mobile,
        has_touch=is_mobile,
        locale="zh-TW",
        color_scheme="light",
    )
    page = context.new_page()
    collect_errors(page, errors)
    page.goto(f"http://127.0.0.1:{PORT}/guide.html", wait_until="networkidle", timeout=30000)
    wait_ready(page)

    # Collapsed (default)
    shot(page, f"{tag}-01-collapsed.png", full=True)
    # Also a folded first screen for quick review
    shot(page, f"{tag}-01b-top.png", full=False)

    # Open quests, expand first main quest
    page.locator("#quest-spoiler [data-open]").click()
    page.wait_for_timeout(300)
    page.locator("#panel-main .q-node").first.click()
    page.wait_for_timeout(200)
    page.locator("#quests").scroll_into_view_if_needed()
    shot(page, f"{tag}-02-quests-open.png", full=False)
    # Full expanded quests (main tab)
    shot(page, f"{tag}-02b-quests-full.png", full=True)

    # Side + photo tabs briefly not required, but open photo for completeness
    page.locator('.tab[data-panel="panel-photo"]').click()
    page.wait_for_timeout(200)
    page.locator("#quests").scroll_into_view_if_needed()
    shot(page, f"{tag}-03-quests-photo.png", full=False)
    page.locator('.tab[data-panel="panel-main"]').click()

    # Open map, click a village
    page.locator("#map-spoiler [data-open]").click()
    page.wait_for_timeout(400)
    page.locator("#map").scroll_into_view_if_needed()
    page.wait_for_timeout(200)
    page.evaluate("""() => document.querySelector('.marker[data-id="imorod"]')?.click()""")
    page.wait_for_function("() => !!document.querySelector('#map-pop h3')", timeout=5000)
    page.locator(".map-stage-wrap").scroll_into_view_if_needed()
    page.wait_for_timeout(200)
    shot(page, f"{tag}-04-map-open.png", full=False)

    # Hints: first click then second
    page.locator("#hidden").scroll_into_view_if_needed()
    first = page.locator(".hint-card").first
    first.click()
    page.wait_for_timeout(200)
    shot(page, f"{tag}-05-hint-armed.png", full=False)
    first.click()
    page.wait_for_timeout(200)
    shot(page, f"{tag}-06-hint-open.png", full=False)

    # Everything open, full page
    shot(page, f"{tag}-07-expanded-full.png", full=True)

    context.close()


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    httpd = start_server()
    errors = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                executable_path=CHROME,
                args=["--no-sandbox", "--disable-gpu", "--hide-scrollbars"],
                headless=True,
            )
            run_viewport(
                browser,
                "desktop",
                {"width": 1440, "height": 900},
                1,
                False,
                errors,
            )
            run_viewport(
                browser,
                "mobile",
                {"width": 393, "height": 852},
                2,
                True,
                errors,
            )
            browser.close()
    finally:
        httpd.shutdown()

    report = OUT / "report.txt"
    # filter noisy chrome console if any
    unique = []
    for e in errors:
        if e not in unique:
            unique.append(e)
    report.write_text("\n".join(unique) + ("\n" if unique else "no console/network errors\n"), encoding="utf-8")
    print("--- errors ---")
    print(report.read_text())
    if unique:
        print(f"FAIL: {len(unique)} issues", file=sys.stderr)
        sys.exit(1)
    print("OK: no console or network errors")


if __name__ == "__main__":
    main()
