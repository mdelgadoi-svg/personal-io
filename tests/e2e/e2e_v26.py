# v2.6: Life Planning first; one morning question instead of the welcome; the goal map with this week's measure.
import json, datetime
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:8765/'
D = '2026-11-25'
st = {"settings": {}, "goals": [
        {"id": "job", "title": "A job in the Bay Area", "why": "Close to the fund I want to build"},
        {"id": "school", "title": "Pass every course", "why": ""},
        {"id": "life", "title": "Keep life running", "why": ""}],
      "tasks": [{"id": "a", "status": "open", "title": "Send 2 outreach messages", "goalId": "job", "important": True, "minutes": 30},
                {"id": "b", "status": "done", "title": "Coffee chat notes", "goalId": "job", "minutes": 20, "doneAt": "2026-11-24T18:00:00"},
                {"id": "c", "status": "open", "title": "PPM homework", "goalId": "school", "minutes": 60, "deadline": "2026-11-20"}],
      "events": [], "days": {}, "log": [], "journal": [], "returns": [], "moments": [], "lastOpenDate": "2026-11-21"}
errors = []
data = lambda pg: json.loads(pg.evaluate("localStorage.getItem('personal-io:v1')"))
def page(b, w, h, seed=st):
    c = b.new_context(viewport={'width': w, 'height': h})
    c.add_init_script("if(!sessionStorage.getItem('seeded')){localStorage.setItem('personal-io:v1', %s);sessionStorage.setItem('seeded','1')}" % json.dumps(json.dumps(seed)))
    pg = c.new_page(); pg.clock.set_fixed_time(datetime.datetime(2026, 11, 25, 9, 0)); pg.on('pageerror', lambda e: errors.append(str(e)))
    return pg
with sync_playwright() as p:
    b = p.chromium.launch()
    for w, h in [(390, 844), (1280, 900)]:
        pg = page(b, w, h)
        pg.goto(BASE); pg.wait_for_selector('[data-form="morning"]')
        assert pg.evaluate('location.hash') in ('', '#'), 'no address'
        q = pg.inner_text('[data-form="morning"]')
        assert 'Good morning' in q and 'review your calendar today' in q, q
        assert 'PPM' not in q and 'Did you already' not in q and 'Send 2' not in q, 'no list of old work'
        assert pg.inner_text('#view h1') == 'Life Planning', 'Life Planning is the first page'
        nav = '.tabs a' if w > 800 else '.bottom-nav a'
        assert [a.strip().upper() for a in pg.locator(nav).all_inner_texts()][0] == 'LIFE PLANNING'
        pg.click('[data-action="morning-calendar"]'); pg.wait_for_selector('.plan')
        assert pg.evaluate('location.hash') == '#plan' and 'Plan my day' in pg.inner_text('#view h1')
        m = [x for x in data(pg)['moments'] if x['kind'] == 'morning']; assert len(m) == 1 and m[0]['chose'] == 'calendar', m
        pg.reload(); pg.wait_for_timeout(9000)
        assert pg.locator('[data-form="morning"]').count() == 0, 'asked once a day'
        # the goal map
        pg.goto(BASE + '#goals'); pg.wait_for_selector('.lp-goal')
        v = pg.inner_text('#view')
        assert 'A job in the Bay Area' in v and 'Close to the fund' in v
        first = pg.locator('.lp-goal').first.inner_text()
        assert '1 started this week' in first and '1 done' in first and '1 waiting' in first, first
        assert 'Why does it matter to you?' in pg.locator('.lp-goal').nth(1).inner_text()
        assert pg.locator('[data-action="copy-life-prompt"]').count() == 1
        assert pg.evaluate('document.documentElement.scrollWidth') <= w, 'no sideways scroll'
        assert '★' not in v and '🤔' not in v, 'no symbol code on Life Planning'
        pg.screenshot(path=f'tests/e2e/out/v26_life_{w}.png', full_page=True)
        pg.context.close()
    # Esc closes the question and keeps the day where it was
    pg = page(b, 390, 844)
    pg.goto(BASE + '#today'); pg.wait_for_selector('[data-form="morning"]'); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    assert pg.evaluate('location.hash') == '#today' and pg.locator('dialog[open]').count() == 0
    assert data(pg)['moments'][-1]['chose'] is None
    pg.context.close()
    # a brand-new start: no question, just Life Planning
    fresh = {**st, "goals": [st['goals'][2]], "tasks": []}
    pg = page(b, 390, 844, fresh)
    pg.goto(BASE); pg.wait_for_timeout(9000)
    assert pg.locator('[data-form="morning"]').count() == 0 and 'one goal you can reach' in pg.inner_text('#view')
    pg.context.close()
    print('all v2.6 checks passed')
print('PAGE ERRORS', errors)
assert not errors, errors
