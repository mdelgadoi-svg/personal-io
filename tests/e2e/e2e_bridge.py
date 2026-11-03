# v1.10: the Google bridge (an Apps Script in his own account). A fake bridge stands in for Google.
# Checks: setup from Settings, no sign-in needed, Set plan writes to the calendar through the bridge,
# a fully wiped browser gets everything back from the link, the phone gets the same data,
# and two devices saving at once never overwrite each other.
import json, datetime, re
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:8765/'
URL = 'https://script.google.com/macros/s/AKfyTEST123/exec'
D = '2026-11-03'
TOM = '2026-11-04'
st = {"version": 1, "settings": {}, "goals": [{"id": "life", "title": "Keep life running", "why": "x"}],
      "tasks": [{"id": "a", "title": "Send application", "goalId": "life", "priority": "both", "deadline": TOM, "minutes": 60, "place": "everywhere", "status": "open", "createdAt": "2026-10-30T10:00:00Z"}],
      "events": [], "days": {}, "log": [], "journal": [], "returns": [], "lastOpenDate": D, "lastDailyCheck": D}
fake = {'key': None, 'savedAt': None, 'text': None, 'inserted': [], 'deleted': [], 'conflicts': 0}

def bridge(route):
    body = json.loads(route.request.post_data or '{}')
    h = {'access-control-allow-origin': '*'}
    a = body.get('action')
    if fake['key'] is None or body.get('key') != fake['key']:
        out = {'error': 'key'}
    elif a == 'ping': out = {'ok': True, 'account': 'mdelgadoi@berkeley.edu'}
    elif a == 'info': out = {'savedAt': fake['savedAt'], 'hasFile': fake['text'] is not None}
    elif a == 'read': out = {'savedAt': fake['savedAt'], 'text': fake['text']}
    elif a == 'write':
        if body.get('expect') != fake['savedAt']:
            fake['conflicts'] += 1; out = {'conflict': True, 'savedAt': fake['savedAt']}
        else:
            fake['text'] = body['text']; fake['savedAt'] = body['savedAt']; out = {'ok': True, 'savedAt': body['savedAt']}
    elif a == 'events':
        items = []
        if body.get('timeMin', '') <= '2026-11-04T18:00' and body.get('timeMax', '') >= '2026-11-04T19:00':
            items = [{'id': 'g1', 'summary': 'Class with Irina', 'status': 'confirmed', 'start': {'dateTime': '2026-11-04T10:00:00-08:00'}, 'end': {'dateTime': '2026-11-04T11:00:00-08:00'}}]
        out = {'items': items, 'summary': 'mdelgadoi@berkeley.edu'}
    elif a == 'writeDay':
        fake['deleted'] += body.get('deleteIds', [])
        ids = [f'ev{len(fake["inserted"]) + i}' for i in range(len(body.get('bodies', [])))]
        fake['inserted'] += body.get('bodies', [])
        out = {'ids': ids}
    else: out = {'error': 'unknown action'}
    route.fulfill(status=200, content_type='application/json', body=json.dumps(out), headers=h)

errors = []
def page(ctx, hour=19, day=3):
    pg = ctx.new_page()
    pg.clock.set_fixed_time(datetime.datetime(2026, 11, day, hour, 0))
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.route('https://script.google.com/**', bridge)
    pg.route('https://accounts.google.com/**', lambda r: (errors.append('asked Google to sign in'), r.abort()))
    return pg
data = lambda pg: json.loads(pg.evaluate("localStorage.getItem('personal-io:v1')"))

with sync_playwright() as p:
    b = p.chromium.launch()
    comp = b.new_context(viewport={'width': 1400, 'height': 1000})
    comp.grant_permissions(['clipboard-read', 'clipboard-write'], origin=BASE.rstrip('/'))
    comp.add_init_script(f"if(!localStorage.getItem('seeded')){{localStorage.setItem('personal-io:v1', {json.dumps(json.dumps(st))});localStorage.setItem('seeded','1')}}")
    pc = page(comp)
    pc.goto(BASE + '#start'); pc.wait_for_selector('.col-day')
    print('pill before setup:', repr(pc.inner_text('#sync-pill')))
    pc.click('[data-action="open-settings"]'); pc.wait_for_timeout(200)
    pc.click('[data-action="copy-bridge-code"]'); pc.wait_for_timeout(400)
    code = pc.evaluate('navigator.clipboard.readText()')
    fake['key'] = re.search(r"const KEY = '([0-9a-f]+)'", code).group(1)
    print('code copied with a key:', len(fake['key']) == 48, '| placeholder gone:', '__KEY__' not in code)
    pc.screenshot(path='tests/e2e/out/bridge_setup.png')
    pc.fill('#s-bridge', 'https://example.com/nope'); pc.click('[data-action="connect-bridge"]'); pc.wait_for_timeout(200)
    print('wrong URL refused:', 'not a Web app URL' in pc.inner_text('#toasts'))
    pc.fill('#s-bridge', URL); pc.click('[data-action="connect-bridge"]'); pc.wait_for_timeout(1500)
    print('connected chip:', pc.locator('.chip-done:has-text("bridge")').count(), '| data in bridge:', 'Send application' in (fake['text'] or ''))
    link = pc.input_value('[aria-label="Your link"]')
    pc.screenshot(path='tests/e2e/out/bridge_on.png')
    pc.click('[data-action="close-modal"]')
    print('pill after setup:', pc.inner_text('#sync-pill'))
    # plan tomorrow and set it: goes to the calendar through the bridge, no sign-in
    pc.click('[data-action="plan-day"][data-day="tomorrow"]'); pc.wait_for_timeout(800)
    print('Google event shown:', pc.locator('#cal-plan .ev-google').count())
    pc.click('[data-action="add-to-day"][data-id="a"]'); pc.wait_for_timeout(800)
    print('placed after the class:', pc.inner_text('.col-day .plan-row').split('\n')[0])
    pc.click('.col-day [data-action="set-plan"]'); pc.wait_for_timeout(2500)
    print('calendar events written:', [x['summary'] for x in fake['inserted']], '| plan note:', pc.inner_text('.col-day .note').split('\n')[0] if pc.locator('.col-day .note').count() else None)
    print('bridge has the set plan:', json.loads(fake['text'])['days'].get(TOM, {}).get('set'))

    # restart with a wiped browser: everything gone, then open the link
    pc.close()
    pc = page(comp, hour=8, day=4)
    pc.goto(BASE); pc.wait_for_selector('#view')
    pc.evaluate("localStorage.clear(); localStorage.setItem('seeded','1')"); pc.reload(); pc.wait_for_selector('#view'); pc.wait_for_timeout(500)
    print('wiped browser tasks:', len(data(pc)['tasks']))
    pc.goto(link.replace('https://mdelgadoi-svg.github.io/personal-io/', BASE).split('#')[0] + '#' + link.split('#')[1]); pc.wait_for_timeout(300); pc.reload(); pc.wait_for_timeout(1500)
    print('after opening the link:', [t['title'] for t in data(pc)['tasks']], '| today plan:', data(pc)['days'].get(TOM, {}).get('taskIds'))
    pc.screenshot(path='tests/e2e/out/bridge_restored.png')
    if pc.locator('#modal[open]').count(): pc.keyboard.press('Escape'); pc.wait_for_timeout(200)

    # phone from the link
    phone = b.new_context(viewport={'width': 390, 'height': 844})
    pp = page(phone, hour=9, day=4)
    pp.goto(BASE + '#' + link.split('#')[1]); pp.wait_for_timeout(300); pp.reload(); pp.wait_for_timeout(1500)
    print('phone has the plan:', data(pp)['days'].get(TOM, {}).get('taskIds'), '| pill:', pp.locator('#sync-pill .sync-ok').count())
    pp.screenshot(path='tests/e2e/out/bridge_phone.png')
    if pp.locator('#modal[open]').count(): pp.keyboard.press('Escape'); pp.wait_for_timeout(200)

    # both save at the same moment: the second write is refused, then joined
    pp.fill('#cap-text', 'From phone'); pc.fill('#cap-text', 'From computer')
    pp.click('[data-action="quick-add"]'); pc.click('[data-action="quick-add"]'); pc.wait_for_timeout(4000); pp.wait_for_timeout(500)
    pp.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); pp.click('[data-action="sync-now"]'); pp.wait_for_timeout(2000)
    pc.click('[data-action="sync-now"]'); pc.wait_for_timeout(2000)
    final = sorted(t['title'] for t in json.loads(fake['text'])['tasks'])
    print('bridge after both:', final, '| phone:', sorted(t['title'] for t in data(pp)['tasks']) == final, '| computer:', sorted(t['title'] for t in data(pc)['tasks']) == final)
print('errors', errors)
