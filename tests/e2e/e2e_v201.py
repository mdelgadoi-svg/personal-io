# v2.0.1: fixes from the review of v2.0.
import json, datetime
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:8765/'
D = '2026-11-04'
def t(id, title, important=False, deadline='', **extra):
    return {"id": id, "title": title, "goalId": "life", "important": important, "priority": "nice", "deadline": deadline, "minutes": 30,
            "place": "everywhere", "status": "open", "createdAt": "2026-10-30T10:00:00Z", **extra}
st = {"version": 1, "settings": {}, "lastOpenDate": D, "lastDailyCheck": D, "events": [], "days": {}, "log": [], "journal": [], "returns": [],
      "goals": [{"id": "life", "title": "Keep life running", "why": "x"}, {"id": "job", "title": "Get a job", "why": "x"}],
      "tasks": [t('a', 'Send CV', True, '2026-11-05'), t('b', 'Prepare deck', True, '2026-11-05'), t('c', 'Call Pancho', False, D),
                t('p', 'Organize photos', progress='Sorted 2019'), t('x', 'Book flight')]}
errors = []
data = lambda pg: json.loads(pg.evaluate("localStorage.getItem('personal-io:v1')"))
def show(pg, group):
    if pg.get_attribute(f'.group-toggle[data-group-name="{group}"]', 'aria-expanded') != 'true':
        pg.click(f'.group-toggle[data-group-name="{group}"]'); pg.wait_for_timeout(100)
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 1400, 'height': 1000})
    ctx.add_init_script(f"if(!localStorage.getItem('seeded')){{localStorage.setItem('personal-io:v1', {json.dumps(json.dumps(st))});localStorage.setItem('seeded','1')}}")
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.clock.set_fixed_time(datetime.datetime(2026, 11, 4, 8, 0))
    pg.goto(BASE + '#today'); pg.wait_for_timeout(400)
    pg.click('[data-action="accept-proposal"]'); pg.wait_for_timeout(500)
    # he adds a 🤔 task himself
    pg.goto(BASE + '#start'); pg.wait_for_timeout(300); pg.click('[data-action="plan-day"][data-day="today"]'); pg.wait_for_timeout(200)
    pg.click('.col-day [data-action="open-slot"]'); pg.wait_for_timeout(150)
    show(pg, 'nice'); pg.click('[data-action="add-to-day"][data-id="p"]'); pg.wait_for_timeout(300)
    print('added his own task:', 'p' in data(pg)['days'][D]['taskIds'])
    # star then unstar something unrelated: nothing changed, so no note
    pg.click('.item:has-text("Book flight") [data-action="toggle-important"]'); pg.wait_for_timeout(150)
    show(pg, 'important'); pg.click('.item:has-text("Book flight") [data-action="toggle-important"]'); pg.wait_for_timeout(150)
    pg.goto(BASE + '#today'); pg.wait_for_timeout(300)
    print('no note after star and unstar:', pg.locator('.prop-note').count() == 0)
    # a real change: Call Pancho becomes important (due today) and enters Focus
    pg.goto(BASE + '#start'); pg.wait_for_timeout(300); show(pg, 'urgent')
    pg.click('.item:has-text("Call Pancho") [data-action="toggle-important"]'); pg.wait_for_timeout(150)
    pg.goto(BASE + '#today'); pg.wait_for_timeout(300)
    print('note after a real change:', pg.locator('.prop-note').count() == 1)
    pg.click('[data-action="repropose"]'); pg.wait_for_timeout(500)
    day = data(pg)['days'][D]
    print('his own task stays after Update:', 'p' in day['taskIds'], '| focus:', day['focus'])
    # a copy (part 2) of an important task stays important
    pg.click('.list .item:has-text("Send CV") [data-action="start-task"]') if False else None
    pg.goto(BASE + '#start'); pg.wait_for_timeout(300); show(pg, 'both')
    pg.click('.col-todo .item:has-text("Send CV") [data-action="edit-task"]'); pg.wait_for_timeout(200)
    print('form shows important:', pg.get_attribute('[data-group="important"] [data-value="yes"]', 'aria-pressed'))
    pg.click('[data-action="close-modal"]') if pg.locator('form[data-form="task"] [data-action="close-modal"]').count() else None
    # goals: "Keep life running" shows last, without a number or ↑
    pg.goto(BASE + '#goals'); pg.wait_for_timeout(200)
    heads = [pg.inner_text(f'h2 >> nth={i}') for i in range(pg.locator('#view h2').count())]
    print('goals shown:', heads, '| ↑ on life:', pg.locator('[data-action="goal-up"][data-id="life"]').count())
    # talk it out: a star, not four levels, and a day becomes the deadline
    pg.goto(BASE + '#today'); pg.wait_for_timeout(200)
    pg.click('[data-action="open-dump"]'); pg.wait_for_timeout(200)
    box = pg.locator('#dump-text, textarea').first; box.fill('task: call the landlord tomorrow'); pg.wait_for_timeout(100)
    pg.click('[data-action="talk-save"]')
    pg.wait_for_timeout(500)
    print('review has a star and no level select:', pg.locator('[data-talk="important"]').count() > 0, pg.locator('[data-talk="priority"]').count() == 0)
    if pg.locator('[data-talk="important"]').count():
        pg.check('[data-talk="important"]')
        pg.click('[data-action="talk-add"]') if pg.locator('[data-action="talk-add"]').count() else pg.click('.modal-foot .btn-dark')
        pg.wait_for_timeout(300)
        nt = next((x for x in data(pg)['tasks'] if 'landlord' in x['title'].lower()), None)
        print('from talk:', nt and (nt['title'], nt['deadline'], nt['priority']))
    # evening: Today points to tomorrow
    pg2 = ctx.new_page(); pg2.on('pageerror', lambda e: errors.append(str(e)))
    pg2.clock.set_fixed_time(datetime.datetime(2026, 11, 5, 21, 30))
    pg2.goto(BASE + '#today'); pg2.wait_for_timeout(400)
    if pg2.locator('#modal[open]').count(): pg2.keyboard.press('Escape')
    print('evening Today:', pg2.locator('[data-action="go-plan-tomorrow"]').count() == 1, '| no proposal for today:', pg2.locator('.proposal').count() == 0)
    pg2.goto(BASE + '#start'); pg2.wait_for_timeout(300)
    print('tomorrow proposal wording:', pg2.inner_text('.proposal').replace('\n', ' | ')[:160] if pg2.locator('.proposal').count() else None)
print('errors', errors)
