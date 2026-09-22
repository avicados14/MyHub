from pathlib import Path
from playwright.sync_api import sync_playwright

BASE_URL = "http://127.0.0.1:4173"
OUTPUT = Path("/home/ubuntu/MyHub/artifacts")
OUTPUT.mkdir(parents=True, exist_ok=True)

checks = [
    ("dashboard-desktop", "/", 1440, 1000),
    ("calendar-tablet", "/#/calendar?view=week", 1024, 900),
    ("meal-planner-mobile", "/#/food?view=planner", 375, 812),
]

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    errors = []
    for name, path, width, height in checks:
        context = browser.new_context(viewport={"width": width, "height": height})
        page = context.new_page()
        page.on("console", lambda message, n=name: errors.append(f"{n}: console {message.type}: {message.text}") if message.type == "error" else None)
        page.on("pageerror", lambda error, n=name: errors.append(f"{n}: page error: {error}"))
        page.goto(f"{BASE_URL}{path}")
        page.wait_for_load_state("networkidle")
        page.screenshot(path=str(OUTPUT / f"{name}.png"), full_page=True)
        overflow = page.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth")
        if overflow:
            errors.append(f"{name}: horizontal document overflow")
        context.close()

    context = browser.new_context(viewport={"width": 320, "height": 720})
    page = context.new_page()
    page.on("console", lambda message: errors.append(f"grocery-mobile: console {message.type}: {message.text}") if message.type == "error" else None)
    page.on("pageerror", lambda error: errors.append(f"grocery-mobile: page error: {error}"))
    page.goto(f"{BASE_URL}/#/grocery")
    page.wait_for_load_state("networkidle")
    page.get_by_role("button", name="Generate from meal plan").click()
    page.get_by_role("button", name="Build shopping list").click()
    page.screenshot(path=str(OUTPUT / "grocery-mobile.png"), full_page=True)
    overflow = page.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth")
    if overflow:
        errors.append("grocery-mobile: horizontal document overflow")
    context.close()
    browser.close()

if errors:
    raise RuntimeError("\n".join(errors))

print("PASS: desktop, tablet, 375px mobile, and 320px grocery views rendered without console errors or document overflow.")
