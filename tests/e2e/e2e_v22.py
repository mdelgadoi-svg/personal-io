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
    card = pg.inner_text('.next'); assert 'Send application' in card and 'Open the draft' in card and 'start 1 minute' in card.lower(), card
    go = pg.locator('.next [data-action="start-task"]').bounding_box(); assert go['y'] + go['height'] < 500 and go['height'] >= 44 and go['width'] < 260, go  # a small button in its place, not a full-width one
    assert pg.evaluate('document.documentElement.scrollWidth') <= 390, 'no sideways scroll'
    words = len(pg.evaluate("(() => { const v = document.getElementById('view').cloneNode(true); v.querySelector('.today-cal')?.remove(); document.body.appendChild(v); const t = v.innerText; v.remove(); return t; })()").split()); assert words <= 60, f'{words} words on Today (not counting the calendar hours)'
    assert pg.locator('#view button:visible, #view a:visible, #view input:visible').count() - pg.locator('#cal-today button:visible').count() <= 14
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
    pg.click('.dl-row:has-text("Pay rent") .dl-check'); pg.wait_for_timeout(200)   # a double tap stays done
    assert next(t for t in data(pg)['tasks'] if t['id'] == 'b')['status'] == 'done'
    pg.wait_for_timeout(800); pg.click('.dl-row:has-text("Pay rent") .dl-check'); pg.wait_for_timeout(200)
    assert next(t for t in data(pg)['tasks'] if t['id'] == 'b')['status'] == 'open'

    # the add line: its choices show only while typing; a day in the title becomes the deadline
    assert not pg.locator('[data-action="cap-important"]').is_visible() and not pg.locator('[data-action="quick-done"]').is_visible()
    pg.fill('#cap-text', 'Call mom Friday'); assert pg.locator('[data-action="quick-done"]').is_visible()
    pg.click('[data-action="cap-important"]')
    assert pg.evaluate("document.activeElement.id") == 'cap-text', 'the cursor stays in the box after the star'
    assert pg.input_value('#cap-text') == 'Call mom Friday'
    pg.press('#cap-text', 'Enter'); pg.wait_for_timeout(200)
    mom = next(t for t in data(pg)['tasks'] if t['title'] == 'Call mom'); assert mom['important'] and mom['deadline'] == '2026-11-20', mom
    toast = pg.inner_text('#toasts'); assert 'Added to your tasks: Call mom' in toast and '🤔' not in toast, toast
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
    pg.wait_for_timeout(800); pg.click('.next [data-action="complete-task"]'); pg.wait_for_timeout(150)
    assert 'Pay rent' in pg.inner_text('.next')
    pg.click('.next [data-action="complete-task"]'); pg.wait_for_timeout(150)   # a second quick tap must not finish the next task too
    assert next(t for t in data(pg)['tasks'] if t['id'] == 'b')['status'] == 'open' and 'Pay rent' in pg.inner_text('.next')
    for _ in range(2): pg.wait_for_timeout(800); pg.click('.next [data-action="complete-task"]'); pg.wait_for_timeout(150)
    assert pg.locator('.next').count() == 0 and 'All done for today.' in pg.inner_text('#view')

    # the phone header has Pause with its word; a computer shows the same Today, centered
    cal = pg.locator('#cal-today'); assert cal.count() == 1 and 'Pause' in pg.inner_text('.pause-btn')   # the day's calendar, under the list on a phone
    assert pg.locator('#cal-today .legend').count() == 0 and '★' not in cal.inner_text() and 'Class' in cal.inner_text(), cal.inner_text()
    assert cal.bounding_box()['y'] > pg.locator('.capture').bounding_box()['y']
    assert pg.locator('.bottom-nav a').count() == 4 and pg.locator('.bottom-nav [data-action="new-task"]').count() == 0
    wide = b.new_context(viewport={'width': 1400, 'height': 900})
    wide.add_init_script("if(!sessionStorage.getItem('seeded')){localStorage.setItem('personal-io:v1', %s);sessionStorage.setItem('seeded','1')}" % json.dumps(json.dumps(st)))
    w = wide.new_page(); w.clock.set_fixed_time(datetime.datetime(2026, 11, 16, 9, 42)); w.on('pageerror', lambda e: errors.append(str(e)))
    w.goto(BASE + '#today'); w.wait_for_selector('.next')
    band = w.locator('.next').bounding_box(); assert band['width'] >= 1380 and w.evaluate('document.documentElement.scrollWidth') <= 1400, band  # the green band runs edge to edge on a computer
    side = w.locator('.today-cal').bounding_box(); lst = w.locator('.dayline').bounding_box()
    assert side['x'] > lst['x'] + lst['width'] and side['y'] < lst['y'] + lst['height'], (side, lst)  # on a computer the calendar is on the right of the list
    font = w.evaluate("document.fonts.ready.then(() => [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family).join(','))")
    assert 'Roboto' in font, font
    w.context.close()

    # a pasted link as a task name wraps inside the card; the task whose time is running is the one on top;
    # a day with only a starred meeting never says "All done"
    odd = json.loads(json.dumps(st))
    odd['tasks'][0]['title'] = 'https://example.com/' + 'averyveryverylongpathwithoutanyspaces' * 4
    odd['tasks'][0]['progress'] = 'page-3-of-the-application-form-without-spaces-' * 3
    for name, state, hour, minute in [('long', odd, 9, 42), ('running', st, 11, 5)]:
        c = b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
        c.add_init_script("if(!sessionStorage.getItem('seeded')){localStorage.setItem('personal-io:v1', %s);sessionStorage.setItem('seeded','1')}" % json.dumps(json.dumps(state)))
        x = c.new_page(); x.clock.set_fixed_time(datetime.datetime(2026, 11, 16, hour, minute)); x.on('pageerror', lambda e: errors.append(str(e)))
        x.goto(BASE + '#today'); x.wait_for_selector('.next')
        assert x.evaluate('document.documentElement.scrollWidth') <= 390, name + ': sideways scroll'
        if name == 'running': assert 'Pay rent' in x.inner_text('.next'), x.inner_text('.next')
        if name == 'long':
            x.click('.next [data-action="start-task"]'); x.wait_for_selector('[data-form="starter"]')
            assert x.evaluate("document.getElementById('modal').scrollWidth <= document.getElementById('modal').clientWidth + 1"), 'start window scrolls sideways'
        c.close()
    meet = json.loads(json.dumps(st))
    meet['tasks'] = [dict(T('m', 'Advisor meeting', True, 30), eventRef={'src': 'own', 'id': 'e2', 'date': D}, fixedDate=D, fixedTime='15:30')]
    meet['events'].append({"id": "e2", "title": "Advisor meeting", "date": D, "start": "15:30", "minutes": 30, "repeat": "none"})
    meet['days'][D].update(taskIds=['m'], times={}, focus=[], proposed=['m'])
    c = b.new_context(viewport={'width': 390, 'height': 844})
    c.add_init_script("if(!sessionStorage.getItem('seeded')){localStorage.setItem('personal-io:v1', %s);sessionStorage.setItem('seeded','1')}" % json.dumps(json.dumps(meet)))
    x = c.new_page(); x.clock.set_fixed_time(datetime.datetime(2026, 11, 16, 11, 20)); x.on('pageerror', lambda e: errors.append(str(e)))
    x.goto(BASE); x.wait_for_selector('.dayline')   # no address: the app opens on Today
    v = x.inner_text('.today-main'); assert 'All done' not in x.inner_text('#view') and v.count('Advisor meeting') == 1, v
    print('all v2.2 checks passed')
print('PAGE ERRORS', errors)
assert not errors, errors
