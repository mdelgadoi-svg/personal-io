# v1.9.3: a window of the app left open never writes its older data over newer data.
# Reproduces Nov 2, 2026: a tab open since the evening saved its old copy at midnight and the night's plan was lost.
import json, datetime
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:8765/'
st = {"version": 1, "settings": {}, "goals": [{"id": "life", "title": "Keep life running", "why": "x"}],
      "tasks": [{"id": "old", "title": "Old task", "goalId": "life", "priority": "nice", "minutes": 30, "place": "everywhere", "status": "open", "createdAt": "2026-10-30T10:00:00Z"}],
      "events": [], "days": {}, "log": [], "journal": [], "returns": [], "lastOpenDate": "2026-11-01", "lastDailyCheck": "2026-11-01"}
# A sleeping tab can miss the other tab's update, so tab A does not get it.
DEAF = "const _ael=window.addEventListener; window.addEventListener=function(t,...r){ if(t==='storage') return; return _ael.call(this,t,...r) }"
errors = []
titles = lambda pg: sorted(t['title'] for t in json.loads(pg.evaluate("localStorage.getItem('personal-io:v1')"))['tasks'])
with sync_playwright() as p:
    ctx = p.chromium.launch().new_context()
    ctx.add_init_script(f"if(!localStorage.getItem('seeded')){{localStorage.setItem('personal-io:v1', {json.dumps(json.dumps(st))});localStorage.setItem('seeded','1')}}")
    a = ctx.new_page(); a.on('pageerror', lambda e: errors.append(str(e)))
    a.add_init_script(DEAF); a.clock.install(time=datetime.datetime(2026, 11, 1, 18, 0))
    a.goto(BASE + '#start'); a.wait_for_selector('.col-day')
    b = ctx.new_page(); b.on('pageerror', lambda e: errors.append(str(e)))
    b.clock.install(time=datetime.datetime(2026, 11, 1, 22, 0))
    b.goto(BASE + '#start'); b.wait_for_selector('.col-day')
    b.fill('#cap-text', 'Planned last night'); b.click('[data-action="quick-add"]'); b.wait_for_timeout(300)
    a.clock.fast_forward('06:05:00'); a.wait_for_timeout(500)
    print('after midnight in the old tab:', titles(b))
    if a.locator('#modal[open]').count(): a.keyboard.press('Escape'); a.wait_for_timeout(200)
    a.fill('#cap-text', 'Typed in the old tab'); a.click('[data-action="quick-add"]'); a.wait_for_timeout(300)
    print('after an edit in the old tab:', titles(b))
print('errors', errors)
