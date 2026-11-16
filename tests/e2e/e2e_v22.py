# v2.2: Today is one thing on top, then the day in order, then one line to add.
# Checks on a phone: the start button is on the first screen, the list keeps time order with calendar
# events in it, done can be undone, the add line shows its choices only while typing,
# and a start is saved with where it came from and how long after the planned time.
import json, datetime
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:8765/'
D = '2026-11-16'
def T(i, title, imp=False, mins=30, steps=None):
    return {"id": i, "title": title, "goalId": "life", "important": imp, "deadline": D if i == 'a' else '', "minutes": mins, "place": "everywhere",
            "status": "open", "firstSteps": steps or [], "createdAt": "2026-11-10T10:00:00Z"}
st = {"version": 1, "settings": {}, "goals": [{"id": "life", "title": "Keep life running", "why": "x"}],
      "tasks": [T('a', 'Send application', True, 60, ['Open the draft']), T('b', 'Pay rent', False, 10), T('c', 'Study finance', True, 90)],
      "events": [{"id": "e1", "title": "Class", "date": D, "start": "12:00", "minutes": 90, "repeat": "none"}],
      "days": {D: {"taskIds": ["a", "b", "c"], "times": {"a": "09:30", "b": "11:00", "c": "14:00"}, "slots": 3, "set": True, "reviewed": {}, "googleIds": [], "focus": ["a", "c"], "proposed": ["a", "b", "c"]}},
      "log": [], "journal": [], "returns": [], "moments": [], "lastOpenDate": D, "lastDailyCheck": D}
errors = []
data = lambda pg: json.loads(pg.evaluate("localStorage.getItem('personal-io:v1')"))
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
    ctx.add_init_script("if(!sessionStorage.getItem('seeded')){localStorage.setItem('personal-io:v1', %s);sessionStorage.setItem('seeded','1')}" % json.dumps(json.dumps(st)))
    pg = ctx.new_page(); pg.clock.set_fixed_time(datetime.datetime(2026, 11, 16, 9, 42)); pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(BASE + '#today'); pg.wait_for_selector('.next')

    # one thing on top, its start button on the first screen, and the whole page close to one screen
    card = pg.inner_text('.next'); assert 'Send application' in card and 'Open the draft' in card and 'Start 1 minute' in card, card
    go = pg.locator('.next [data-action="start-task"]').bounding_box(); assert go['y'] + go['height'] < 500 and go['height'] >= 48, go
    assert pg.evaluate('document.documentElement.scrollWidth') <= 390, 'no sideways scroll'
    words = len(pg.inner_text('#view').split()); assert words <= 60, f'{words} words on Today'
    assert pg.locator('#view button:visible, #view a:visible, #view input:visible').count() <= 14
    for old in ['.summary-line', '.goal-today', '.chip', '#view .eyebrow']: assert pg.locator(old).count() == 0, old

    # the rest of the day in time order, with the calendar event in its place; no symbol code
    rows = [r.replace('\n', ' ') for r in pg.locator('.dayline .dl-row').all_inner_texts()]
    assert len(rows) == 3 and rows[0].startswith('11:00 AM Pay rent') and rows[1].startswith('12:00 PM Class') and rows[2].startswith('2:00 PM Study finance'), rows
    view = pg.inner_text('#view'); assert not any(x in view for x in ['★', '!', '🤔', 'To do', '▶', '✓']), view
    assert pg.locator('.next .dl-star').count() == 1 and pg.locator('.dl-row .dl-star').count() == 1
    small = pg.evaluate("[...document.querySelectorAll('#view button, #view a')].filter(e => e.offsetParent && (e.getBoundingClientRect().height < 44 || e.getBoundingClientRect().width < 44)).map(e => e.className + ' ' + e.textContent.trim().slice(0, 20))")
    assert not small, small

    # done from the list, and undone with the same circle
    pg.click('.dl-row:has-text("Pay rent") .dl-check'); pg.wait_for_timeout(200)
    assert next(t for t in data(pg)['tasks'] if t['id'] == 'b')['status'] == 'done'
    assert pg.locator('.dl-row.is-done:has-text("Pay rent")').count() == 1
    pg.click('.dl-row:has-text("Pay rent") .dl-check'); pg.wait_for_timeout(200)
    assert next(t for t in data(pg)['tasks'] if t['id'] == 'b')['status'] == 'open'

    # the add line: its choices show only while typing; a day in the title becomes the deadline
    assert not pg.locator('[data-action="cap-important"]').is_visible() and not pg.locator('[data-action="quick-done"]').is_visible()
    pg.fill('#cap-text', 'Call mom Friday'); assert pg.locator('[data-action="quick-done"]').is_visible()
    pg.click('[data-action="cap-important"]'); pg.press('#cap-text', 'Enter'); pg.wait_for_timeout(200)
    mom = next(t for t in data(pg)['tasks'] if t['title'] == 'Call mom'); assert mom['important'] and mom['deadline'] == '2026-11-20', mom
    pg.keyboard.press('Escape'); pg.locator('#cap-text').blur()

    # a start: opening the start screen is not yet a start; "Done, I started" is, 12 minutes after 9:30 AM
    pg.click('.next [data-action="start-task"]'); pg.wait_for_selector('[data-form="starter"]')
    s = pg.inner_text('[data-form="starter"]'); assert 'Open the draft' in s and 'STEP' not in s.upper().replace('STEPS', '') and '60s' not in s, s
    m = [x for x in data(pg)['moments'] if x['kind'] == 'start'][-1]
    assert m['from'] == 'next' and m['v'] == 2 and 'began' not in m and isinstance(m['sinceOpen'], int), m
    pg.click('[data-action="starter-next"]'); pg.wait_for_timeout(200)
    m = [x for x in data(pg)['moments'] if x['kind'] == 'start'][-1]; assert m.get('began') and m['delay'] == 12, m
    pg.click('[data-action="starter-close"]'); pg.wait_for_timeout(200)
    pg.click('.dl-row:has-text("Study finance") .dl-main'); pg.wait_for_selector('[data-form="starter"]')
    m = [x for x in data(pg)['moments'] if x['kind'] == 'start'][-1]; assert m['from'] == 'row' and m['taskId'] == 'c', m
    pg.click('[data-action="starter-close"]'); pg.wait_for_timeout(200)   # closed without starting: not counted
    pg.click('[data-action="open-settings"]'); line = pg.inner_text('.stats-line')
    assert line.startswith('1 start on 1 day. Usually 12 min after the planned time.'), line
    pg.keyboard.press('Escape')

    # the top card moves on when its task is done; with everything done the screen says so
    pg.click('.next [data-action="complete-task"]'); pg.wait_for_timeout(200)
    assert 'Pay rent' in pg.inner_text('.next')
    for _ in range(2): pg.click('.next [data-action="complete-task"]'); pg.wait_for_timeout(200)
    assert pg.locator('.next').count() == 0 and 'All done for today.' in pg.inner_text('#view')

    # a wide screen keeps the hour calendar beside the list; the phone header has Pause with its word
    assert not pg.locator('#cal-today').is_visible() and 'Pause' in pg.inner_text('.pause-btn')
    assert pg.locator('.bottom-nav a').count() == 5 and pg.locator('.bottom-nav [data-action="new-task"]').count() == 0
    wide = b.new_context(viewport={'width': 1400, 'height': 900})
    wide.add_init_script("if(!sessionStorage.getItem('seeded')){localStorage.setItem('personal-io:v1', %s);sessionStorage.setItem('seeded','1')}" % json.dumps(json.dumps(st)))
    w = wide.new_page(); w.clock.set_fixed_time(datetime.datetime(2026, 11, 16, 9, 42)); w.on('pageerror', lambda e: errors.append(str(e)))
    w.goto(BASE + '#today'); w.wait_for_selector('.next'); assert w.locator('#cal-today').is_visible()
    font = w.evaluate("document.fonts.ready.then(() => [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family).join(','))")
    assert 'Figtree' in font, font
    print('all v2.2 checks passed')
print('PAGE ERRORS', errors)
