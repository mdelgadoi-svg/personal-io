# v2.3: the calm look, and Plan as one list (what matters, and how soon).
# Checks: Plan shows starred things on top and the rest below; one star and one "how soon" choice
# reorder the list; nothing asks him to build a day; calendar meetings can be starred from Plan;
# the Plan tab also covers the day builder and the old full list; buttons are small pills.
import json, datetime
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:8765/'
D = '2026-11-16'  # a Monday
def T(i, title, imp=False, deadline=''):
    return {"id": i, "title": title, "goalId": "life", "important": imp, "deadline": deadline, "minutes": 30, "place": "everywhere",
            "status": "open", "firstSteps": [], "createdAt": "2026-11-10T10:00:00Z"}
st = {"version": 1, "settings": {}, "goals": [{"id": "life", "title": "Keep life running", "why": "x"}],
      "tasks": [T('a', 'Send application', True, D), T('b', 'Pay rent', False, D), T('c', 'Read the report'), T('d', 'Call the dentist', False, '2026-12-09')],
      "events": [{"id": "e1", "title": "Class", "date": D, "start": "12:00", "minutes": 90, "repeat": "none"}],
      "days": {}, "log": [], "journal": [], "returns": [], "moments": [], "lastOpenDate": D, "lastDailyCheck": D}
errors = []
data = lambda pg: json.loads(pg.evaluate("localStorage.getItem('personal-io:v1')"))
task = lambda pg, i: next(t for t in data(pg)['tasks'] if t['id'] == i)
def page(b, w, h, phone):
    ctx = b.new_context(viewport={'width': w, 'height': h}, has_touch=phone, is_mobile=phone)
    ctx.add_init_script("if(!sessionStorage.getItem('seeded')){localStorage.setItem('personal-io:v1', %s);sessionStorage.setItem('seeded','1')}" % json.dumps(json.dumps(st)))
    pg = ctx.new_page(); pg.clock.set_fixed_time(datetime.datetime(2026, 11, 16, 9, 0)); pg.on('pageerror', lambda e: errors.append(str(e)))
    return pg
titles = lambda pg, i=0: [x.strip() for x in pg.locator('.pl-list').nth(i).locator('.pl-title').all_inner_texts()]
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = page(b, 390, 844, True)
    pg.goto(BASE + '#plan'); pg.wait_for_selector('.plan')
    assert pg.inner_text('.plan h1') == 'What matters'
    assert titles(pg, 0) == ['Send application'] and titles(pg, 1) == ['Pay rent', 'Call the dentist', 'Read the report'], (titles(pg, 0), titles(pg, 1))
    view = pg.inner_text('#view')
    for gone in ['slot', 'Slot', 'Use this plan', 'Set plan', 'Important + urgent', '★', '🤔', 'Goals 1/10']: assert gone not in view, gone
    assert pg.evaluate('document.documentElement.scrollWidth') <= 390
    assert pg.locator('.bottom-nav a[aria-current="page"]').inner_text().strip() == 'Plan'

    # one star: it moves up; the star again: it moves back
    pg.click('.pl-row:has-text("Read the report") .pl-star'); pg.wait_for_timeout(200)
    assert task(pg, 'c')['important'] is True and 'Read the report' in titles(pg, 0)
    pg.click('.pl-row:has-text("Read the report") .pl-star'); pg.wait_for_timeout(200)
    assert task(pg, 'c')['important'] is False and 'Read the report' in titles(pg, 1)

    # how soon: plain choices set the deadline and the order follows
    assert pg.locator('#due-d').evaluate('e => e.options[e.selectedIndex].text') == 'Dec 9'
    pg.select_option('#due-c', 'tomorrow'); pg.wait_for_timeout(200)
    assert task(pg, 'c')['deadline'] == '2026-11-17' and titles(pg, 1)[:2] == ['Pay rent', 'Read the report'], titles(pg, 1)
    pg.select_option('#due-c', 'week'); pg.wait_for_timeout(200); assert task(pg, 'c')['deadline'] == '2026-11-20'
    pg.select_option('#due-b', 'none'); pg.wait_for_timeout(200); assert task(pg, 'b')['deadline'] == '' and titles(pg, 1)[-1] == 'Pay rent', titles(pg, 1)
    pg.select_option('#due-d', 'pick'); pg.wait_for_selector('form[data-form="task"]'); pg.keyboard.press('Escape'); pg.wait_for_timeout(200)

    # adding from Plan shows the new thing at once; a meeting on the calendar can be starred here
    pg.fill('#cap-text', 'Buy stamps tomorrow'); pg.press('#cap-text', 'Enter'); pg.wait_for_timeout(200)
    assert 'Buy stamps' in titles(pg, 1)
    pg.evaluate("document.activeElement.blur()")
    assert 'on your calendar today' in pg.inner_text('#view').lower()
    pg.click('.pl-row:has-text("Class") .pl-star'); pg.wait_for_timeout(300)
    assert any(t.get('eventRef') and t['title'] == 'Class' and t['important'] for t in data(pg)['tasks']), 'the starred class is kept'
    assert 'Class' not in titles(pg, 0) + titles(pg, 1), 'a meeting stays on the calendar part of the list'

    # every control on Plan is big enough for a thumb
    small = pg.evaluate("[...document.querySelectorAll('#view button, #view a, #view select, #view input')].filter(e => e.offsetParent && (e.getBoundingClientRect().height < 40 || e.getBoundingClientRect().width < 40)).map(e => e.className + ' ' + (e.textContent || '').trim().slice(0, 20))")
    assert not small, small

    # the day builder and the old full list are still there, behind Plan
    pg.click('.pl-foot a'); pg.wait_for_selector('.col-day')
    assert pg.locator('.bottom-nav a[aria-current="page"]').inner_text().strip() == 'Plan'
    pg.goto(BASE + '#backlog'); pg.wait_for_selector('.col-backlog, .group')
    assert pg.locator('.bottom-nav a[aria-current="page"]').inner_text().strip() == 'Plan'
    pg.context.close()

    # on a computer: the same list, centered; the tabs like the head of the invitation; small pill buttons
    w = page(b, 1366, 800, False)
    w.goto(BASE + '#plan'); w.wait_for_selector('.plan')
    box = w.locator('.plan').bounding_box(); assert 600 <= box['width'] <= 660 and abs((box['x'] + box['width'] / 2) - 683) < 12, box
    assert [t.strip().upper() for t in w.locator('.tabs a').all_inner_texts()] == ['TODAY', 'PLAN', 'CALENDAR', 'GOALS']
    assert w.evaluate("getComputedStyle(document.querySelector('.tabs a')).textTransform") == 'uppercase'
    w.goto(BASE + '#today'); w.wait_for_selector('.proposal')
    use = w.locator('[data-action="accept-proposal"]'); r = w.evaluate("e => getComputedStyle(e).borderRadius", use.element_handle())
    assert float(r.replace('px', '')) >= 22 and use.bounding_box()['width'] < 240, (r, use.bounding_box())
    assert w.evaluate("getComputedStyle(document.body).backgroundColor") == 'rgb(241, 238, 230)'
    font = w.evaluate("document.fonts.ready.then(() => [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family).join(','))"); assert 'Roboto' in font, font
    print('all v2.3 checks passed')
print('PAGE ERRORS', errors)
assert not errors, errors
