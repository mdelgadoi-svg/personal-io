# v2.0: the app decides levels from "important" plus the deadline, and proposes the day.
# A fake bridge stands in for Google (calendar with "Meeting with Justin", data file).
import json, datetime
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:8765/'
URL = 'https://script.google.com/macros/s/AKfyV20/exec'
D = '2026-11-04'  # a Wednesday
# Data from v1.9: levels were picked by hand.
old = {"version": 1, "settings": {}, "lastOpenDate": D, "lastDailyCheck": '2026-11-03', "events": [], "days": {}, "log": [], "journal": [], "returns": [],
       "goals": [{"id": "life", "title": "Keep life running", "why": "x"}, {"id": "school", "title": "Do good in school", "why": "x"}, {"id": "job", "title": "Get a job in the US", "why": "x"}],
       "tasks": [
           {"id": "o1", "title": "Study for the ETA class", "goalId": "school", "priority": "important", "deadline": "2026-11-20", "minutes": 90, "place": "everywhere", "status": "open", "createdAt": "2026-10-30T10:00:00Z"},
           {"id": "o2", "title": "Sent messages in linkedin", "goalId": "job", "priority": "important", "deadline": "2026-11-20", "minutes": 30, "place": "everywhere", "status": "open", "createdAt": "2026-10-30T10:00:00Z"},
           {"id": "o3", "title": "Watch movie with Irina", "goalId": "life", "priority": "urgent", "deadline": "2026-11-12", "minutes": 60, "place": "everywhere", "status": "open", "createdAt": "2026-10-30T10:00:00Z"},
       ]}
fake = {'text': None, 'bodies': []}
def saved_at():
    try: return json.loads(fake['text']).get('savedAt') if fake['text'] else None
    except Exception: return None
def bridge(route):
    b = json.loads(route.request.post_data or '{}'); a = b.get('action'); h = {'access-control-allow-origin': '*'}
    if a == 'ping': out = {'ok': True, 'account': 'mdelgadoi@berkeley.edu'}
    elif a == 'info': out = {'savedAt': saved_at()}
    elif a == 'read': out = {'savedAt': saved_at(), 'text': fake['text'] if saved_at() else None}
    elif a == 'write':
        out = {'conflict': True} if b.get('expect') != saved_at() else (fake.update(text=b['text']) or {'ok': True})
    elif a == 'events':
        items = [] if b['timeMax'] < '2026-11-04T08' or b['timeMin'] > '2026-11-05T08' else [
            {'id': 'justin', 'summary': 'Meeting with Justin', 'status': 'confirmed', 'start': {'dateTime': '2026-11-04T15:00:00-08:00'}, 'end': {'dateTime': '2026-11-04T15:30:00-08:00'}}]
        out = {'items': items}
    elif a == 'writeDay':
        fake['bodies'] = b.get('bodies', []); out = {'ids': [f'e{i}' for i in range(len(fake['bodies']))]}
    else: out = {'error': 'unknown'}
    route.fulfill(status=200, content_type='application/json', body=json.dumps(out), headers=h)

errors = []
data = lambda pg: json.loads(pg.evaluate("localStorage.getItem('personal-io:v1')"))
def show(pg, group):
    if pg.get_attribute(f'.group-toggle[data-group-name="{group}"]', 'aria-expanded') != 'true':
        pg.click(f'.group-toggle[data-group-name="{group}"]'); pg.wait_for_timeout(100)
level = lambda pg, title: next(t['priority'] for t in data(pg)['tasks'] if t['title'] == title)
with sync_playwright() as p:
    b = p.chromium.launch()
    for name, vp in [('desk', {'width': 1400, 'height': 1000}), ('phone', {'width': 390, 'height': 844})]:
        fake.update(text=None, bodies=[])
        ctx = b.new_context(viewport=vp)
        ctx.add_init_script(f"""if(!localStorage.getItem('seeded')){{localStorage.setItem('personal-io:v1', {json.dumps(json.dumps(old))});
          localStorage.setItem('personal-io:bridge', JSON.stringify({{url:'{URL}', key:'k'}}));localStorage.setItem('seeded','1')}}""")
        pg = ctx.new_page(); pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.clock.set_fixed_time(datetime.datetime(2026, 11, 4, 7, 30))
        pg.route('https://script.google.com/**', bridge)
        pg.goto(BASE + '#start'); pg.wait_for_timeout(1500)
        if pg.locator('#modal[open]').count(): pg.keyboard.press('Escape')
        if name == 'desk':
            print('old data kept:', len(data(pg)['tasks']) == 3, '| old ★ stays important:', [t['important'] for t in data(pg)['tasks']])
            print('old ! with a far deadline is later now:', level(pg, 'Watch movie with Irina'))
            # 10 tasks, titles only; star 3 while typing
            titles = ['Send CV to Ana tomorrow', 'Pay rent by Nov 10', 'Buy milk', 'Call Pancho today', 'Read chapter 3 on Friday',
                      'Book flight', 'Email the professor', 'Fix the bike', 'Prepare pitch deck tomorrow', 'Clean the room']
            starred = {'Send CV to Ana tomorrow', 'Prepare pitch deck tomorrow', 'Email the professor'}
            for t in titles:
                if t in starred: pg.click('[data-action="cap-important"]')
                pg.click('[data-action="pane"][data-pane="todo"]') if pg.locator('[data-action="pane"][data-pane="todo"]').is_visible() else None; pg.fill('#cap-text', t); pg.press('#cap-text', 'Enter'); pg.wait_for_timeout(120)
            print('asked anything:', pg.locator('#modal[open]').count(), '| 13 tasks:', len(data(pg)['tasks']))
            print('"Send CV to Ana tomorrow":', level(pg, 'Send CV to Ana'), next(t['deadline'] for t in data(pg)['tasks'] if t['title'] == 'Send CV to Ana'))
            print('levels:', {t: level(pg, t) for t in ['Prepare pitch deck', 'Email the professor', 'Call Pancho', 'Pay rent', 'Buy milk']})
            # the star on a row
            show(pg, 'nice')
            pg.click('.item:has-text("Book flight") [data-action="toggle-important"]'); pg.wait_for_timeout(150)
            print('Book flight starred:', level(pg, 'Book flight'))
            show(pg, 'important')
            pg.click('.item:has-text("Book flight") [data-action="toggle-important"]'); pg.wait_for_timeout(150)
            print('Book flight unstarred:', level(pg, 'Book flight'))
            # the meeting: just time until starred
            pg.click('[data-action="plan-day"][data-day="today"]'); pg.wait_for_timeout(1500)
            print('Justin offered, not a task yet:', pg.locator('.busy-row:has-text("Justin")').count(), not any('Justin' in t['title'] for t in data(pg)['tasks']))
            pg.goto(BASE + '#today'); pg.wait_for_timeout(500)
            prop = pg.inner_text('.proposal')
            print('proposal:', prop.replace('\n', ' | ')[:260])
            pg.screenshot(path='tests/e2e/out/v20_proposal.png', full_page=True)
            pg.goto(BASE + '#start'); pg.wait_for_timeout(500)
            pg.click('.busy-row:has-text("Justin") [data-action="busy-prio"]'); pg.wait_for_timeout(300)
            print('starred Justin is ★!:', level(pg, 'Meeting with Justin'))
            pg.goto(BASE + '#today'); pg.wait_for_timeout(400)
            print('Justin in proposal at 3:00 PM:', 'Meeting with Justin' in pg.inner_text('.proposal') and '3:00 PM' in pg.inner_text('.proposal'))
            pg.click('#cal-plan .ev:has-text("Justin")'); pg.wait_for_timeout(200)
            pg.click('[data-action="cal-untrack"]'); pg.wait_for_timeout(300)
            print('unstarred Justin left the list:', not any('Justin' in t['title'] for t in data(pg)['tasks'] if t['status'] == 'open'))
            # goal order: move "Get a job" above "Do good in school"
            pg.goto(BASE + '#goals'); pg.wait_for_timeout(200)
            pg.click('[data-action="goal-up"][data-id="job"]'); pg.wait_for_timeout(200)
            print('goal order:', [g['id'] for g in data(pg)['goals']])
            # use the plan: writes the calendar with 10 and 0 minute reminders
            pg.goto(BASE + '#today'); pg.wait_for_timeout(400)
            pg.click('[data-action="accept-proposal"]'); pg.wait_for_timeout(2500)
            day = data(pg)['days'][D]
            print('plan set:', day['set'], '| focus:', [next(t['title'] for t in data(pg)['tasks'] if t['id'] == i) for i in day['focus']])
            print('calendar events:', [x['summary'] for x in fake['bodies']])
            print('reminders:', fake['bodies'][0]['reminders']['overrides'] if fake['bodies'] else None)
            pg.screenshot(path='tests/e2e/out/v20_today.png', full_page=True)
            # change priorities after accepting: offers to update, Google only when asked
            pg.goto(BASE + '#start'); pg.wait_for_timeout(300)
            show(pg, 'urgent')
            pg.click('.item:has-text("Call Pancho") [data-action="toggle-important"]'); pg.wait_for_timeout(200)
            pg.goto(BASE + '#today'); pg.wait_for_timeout(300)
            print('priorities changed note:', pg.locator('.prop-note').count())
            before = len(fake['bodies']); bodies_before = list(fake['bodies'])
            pg.click('[data-action="repropose"]'); pg.wait_for_timeout(800)
            print('Pancho is Focus now:', 'Call Pancho' in [next(t['title'] for t in data(pg)['tasks'] if t['id'] == i) for i in data(pg)['days'][D]['focus']])
            print('calendar untouched until asked:', fake['bodies'] == bodies_before, '| update button:', pg.locator('[data-action="set-plan"]:has-text("Update Google Calendar")').count() > 0 or pg.locator('.col-day').count() == 0)
        else:
            pg.goto(BASE + '#today'); pg.wait_for_timeout(500)
            if pg.locator('#modal[open]').count(): pg.keyboard.press('Escape')
            pg.screenshot(path='tests/e2e/out/v20_phone_today.png', full_page=True)
            pg.goto(BASE + '#start'); pg.wait_for_timeout(500)
            pg.screenshot(path='tests/e2e/out/v20_phone_plan.png', full_page=True)
            print('phone: proposal shown:', pg.locator('.proposal').count(), '| stars:', pg.locator('.star-btn').count())
print('errors', errors)
