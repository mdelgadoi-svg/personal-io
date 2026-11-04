# v2.1: one main screen (To-do | Calendar | Plan), first run, Gmail through the bridge read by Claude.
import json, datetime, re
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:8765/'
URL = 'https://script.google.com/a/macros/berkeley.edu/s/AKfyV21/exec'
D = '2026-11-04'
fake = {'key': None, 'text': None, 'emails': True}
def saved_at():
    try: return json.loads(fake['text']).get('savedAt') if fake['text'] else None
    except Exception: return None
def bridge(route):
    b = json.loads(route.request.post_data or '{}'); a = b.get('action'); h = {'access-control-allow-origin': '*'}
    if fake['key'] and b.get('key') != fake['key']: out = {'error': 'key'}
    elif a == 'ping': out = {'ok': True, 'account': 'irina@example.com'}
    elif a == 'info': out = {'savedAt': saved_at()}
    elif a == 'read': out = {'savedAt': saved_at(), 'text': fake['text'] if saved_at() else None}
    elif a == 'write': out = {'conflict': True} if b.get('expect') != saved_at() else (fake.update(text=b['text']) or {'ok': True})
    elif a == 'events':
        out = {'items': [] if b['timeMin'] > '2026-11-06' else [
            {'id': 'g1', 'summary': 'Class: Strategy', 'status': 'confirmed', 'start': {'dateTime': '2026-11-04T10:00:00-08:00'}, 'end': {'dateTime': '2026-11-04T11:30:00-08:00'}},
            {'id': 'g2', 'summary': 'Thesis review with advisor', 'status': 'confirmed', 'start': {'dateTime': '2026-11-05T14:00:00-08:00'}, 'end': {'dateTime': '2026-11-05T15:00:00-08:00'}}]}
    elif a == 'emails':
        out = {'emails': [{'subject': 'Deck for Friday', 'from': 'Julia', 'date': 'Tue, Nov 3', 'snippet': 'Can you send me the deck by Friday?', 'sent': False}]} if fake['emails'] else {'error': 'unknown action'}
    elif a == 'writeDay': out = {'ids': []}
    else: out = {'error': 'unknown action'}
    route.fulfill(status=200, content_type='application/json', body=json.dumps(out), headers=h)
def claude(route):
    body = {'content': [{'type': 'text', 'text': json.dumps({'tasks': [{'title': 'Send Julia the deck', 'goalId': 'life', 'minutes': 30, 'from': 'Julia: Deck for Friday'}]})}]}
    route.fulfill(status=200, content_type='application/json', body=json.dumps(body), headers={'access-control-allow-origin': '*'})

errors = []
def page(ctx, vp_hour=9):
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.clock.set_fixed_time(datetime.datetime(2026, 11, 4, vp_hour, 0))
    pg.route('https://script.google.com/**', bridge); pg.route('https://api.anthropic.com/**', claude)
    return pg
data = lambda pg: json.loads(pg.evaluate("localStorage.getItem('personal-io:v1')") or '{}')
with sync_playwright() as p:
    b = p.chromium.launch()
    # first run: a new person with nothing set up
    ctx = b.new_context(viewport={'width': 1400, 'height': 900})
    ctx.grant_permissions(['clipboard-read', 'clipboard-write'], origin=BASE.rstrip('/'))
    pg = page(ctx)
    pg.goto(BASE); pg.wait_for_timeout(500)
    print('first run shown:', pg.locator('.first-run').count() == 1, '| asks for calendar and Gmail:', 'Calendar and Gmail' in pg.inner_text('.first-run'))
    print('first run is general (no Berkeley, no Claude):', 'Berkeley' not in pg.inner_text('.first-run') and 'Claude' not in pg.inner_text('.first-run'))
    pg.screenshot(path='tests/e2e/out/v21_first_run.png', full_page=True)
    pg.click('.first-run [data-action="copy-bridge-code"]'); pg.wait_for_timeout(400)
    fake['key'] = re.search(r"const KEY = '([0-9a-f]+)'", pg.evaluate('navigator.clipboard.readText()')).group(1)
    pg.fill('#s-bridge', URL); pg.click('.first-run [data-action="connect-bridge"]'); pg.wait_for_timeout(2000)
    print('after connect: main screen:', pg.locator('.main-cols').count() == 1, '| coming up card:', pg.locator('.onboard').count() == 1)
    print('coming up lists the week:', [pg.inner_text(f'.onboard .busy-row >> nth={i}') for i in range(pg.locator('.onboard .busy-row').count())])
    pg.click('.onboard .busy-row:has-text("Thesis review") [data-action="busy-prio"]'); pg.wait_for_timeout(300)
    print('starred event became important:', [(t['title'], t['priority']) for t in data(pg)['tasks']])
    # email: Claude key, bridge emails
    pg.evaluate("localStorage.setItem('personal-io:claude-key', 'sk-ant-api03-test-key-1234567890abcdef')")
    pg.click('.onboard [data-action="open-email"]'); pg.wait_for_timeout(200)
    print('email ready (no Client ID needed):', pg.locator('[data-action="email-scan"]:not([disabled])').count() == 1)
    pg.click('[data-action="email-scan"]'); pg.wait_for_timeout(1500)
    print('email review:', pg.inner_text('[data-form="talk-review"]').replace('\n', ' | ')[:200] if pg.locator('[data-form="talk-review"]').count() else None)
    pg.check('.talk-row [data-talk="pick"]'); pg.click('[data-action="talk-add"]'); pg.wait_for_timeout(300)
    print('email task added:', any(t['title'] == 'Send Julia the deck' for t in data(pg)['tasks']))
    pg.click('.onboard [data-action="onboard-done"]'); pg.wait_for_timeout(200)
    print('coming up card gone after Done:', pg.locator('.onboard').count() == 0)
    # the main screen at 1400 x 900: three columns, the whole day of calendar on screen
    box = lambda sel: pg.locator(sel).bounding_box()
    todo, cal, day = box('.col-todo'), box('.col-cal'), box('.col-day')
    print('three columns left to right:', todo['x'] < cal['x'] < day['x'])
    grid = box('#cal-plan .grid') or box('#cal-plan')
    print('calendar 7 AM to 10 PM fits without scrolling:', grid['y'] + grid['height'] <= 900, round(grid['y'] + grid['height']))
    print('no Today or Calendar tab:', pg.locator('.tabs [data-tab="today"], .tabs [data-tab="calendar"]').count() == 0)
    pg.screenshot(path='tests/e2e/out/v21_main.png')
    # old links land on the main screen
    for old in ['#today', '#calendar']:
        pg.goto(BASE + old); pg.wait_for_timeout(300)
        print(f'{old} opens the main screen:', pg.locator('.main-cols').count() == 1)
    # an older script does not know "emails" yet: clear steps
    fake['emails'] = False
    pg.click('[data-action="open-email"]'); pg.click('[data-action="email-scan"]'); pg.wait_for_timeout(800)
    print('old script message:', 'New version' in pg.inner_text('.email-status'))
    pg.click('[data-form="email"] [data-action="close-modal"]')
    # phone: one part at a time
    phone = b.new_context(viewport={'width': 390, 'height': 844})
    pp = page(phone)
    fake['emails'] = True
    link = BASE + '#' + __import__('urllib.parse', fromlist=['urlencode']).urlencode({'bridge': URL, 'k': fake['key']})
    pp.goto(link); pp.wait_for_timeout(300); pp.reload(); pp.wait_for_timeout(1500)
    if pp.locator('#modal[open]').count(): pp.keyboard.press('Escape')
    vis = lambda: [n for n in ['todo', 'cal', 'day'] if pp.locator(f'.col-{n}').is_visible()]
    print('phone opens on Plan:', vis())
    pp.click('[data-action="pane"][data-pane="todo"]'); pp.wait_for_timeout(200); print('phone To-do:', vis())
    pp.screenshot(path='tests/e2e/out/v21_phone_todo.png')
    pp.click('[data-action="pane"][data-pane="cal"]'); pp.wait_for_timeout(300); print('phone Calendar:', vis())
    pp.click('[data-action="pane"][data-pane="day"]'); pp.wait_for_timeout(200)
    pp.screenshot(path='tests/e2e/out/v21_phone_plan.png')
print('errors', errors)
