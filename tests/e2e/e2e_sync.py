# v1.9: one copy in Google Drive. A computer and a phone share a fake Drive.
# Checks: first sync sends the data, the phone link sets up Google, the phone gets the data,
# changes go both ways, a set plan survives closing the browser, both-changed asks, and
# Google events stay visible after the sign-in hour.
import os, json, datetime, re
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:8765/'
D = '2026-11-01'
TOM = '2026-11-02'
st = {"version": 1, "settings": {}, "goals": [{"id": "life", "title": "Keep life running", "why": "x"}],
      "tasks": [{"id": "a", "title": "Send application", "goalId": "life", "priority": "both", "deadline": TOM, "minutes": 60, "place": "everywhere", "status": "open", "createdAt": "2026-10-30T10:00:00Z"},
                {"id": "b", "title": "Pay rent", "goalId": "life", "priority": "urgent", "deadline": TOM, "minutes": 15, "place": "everywhere", "status": "open", "createdAt": "2026-10-30T10:00:00Z"}],
      "events": [], "days": {}, "log": [], "journal": [], "returns": [], "lastOpenDate": D, "lastDailyCheck": D}
GIS = """window.google={accounts:{oauth2:{hasGrantedAllScopes:()=>true,initTokenClient:(o)=>({requestAccessToken:()=>setTimeout(()=>o.callback({access_token:'t',expires_in:3600}),10)})}}};"""
drive = {}  # id -> {savedAt, text}
uploads = []

def google(route):
    r = route.request
    u = r.url
    h = {'access-control-allow-origin': '*'}
    if '/upload/drive/v3/files' in u:
        body = r.post_data
        parts = [p for p in re.split(r'--pio\w+(?:--)?', body) if p.strip()]
        meta = json.loads(parts[0].split('\r\n\r\n', 1)[1].strip())
        text = parts[1].split('\r\n\r\n', 1)[1].rstrip('\r\n')
        m = re.search(r'/files/([^?]+)\?', u)
        fid = m.group(1) if m else f'f{len(drive) + 1}'
        drive[fid] = {'savedAt': meta['appProperties']['savedAt'], 'text': text}
        uploads.append(fid)
        return route.fulfill(status=200, content_type='application/json', body=json.dumps({'id': fid}), headers=h)
    if '/drive/v3/files/' in u and 'alt=media' in u:
        fid = u.split('/files/')[1].split('?')[0]
        return route.fulfill(status=200, content_type='application/json', body=drive[fid]['text'], headers=h)
    if '/drive/v3/files' in u:
        files = [{'id': k, 'appProperties': {'savedAt': v['savedAt']}} for k, v in drive.items()]
        return route.fulfill(status=200, content_type='application/json', body=json.dumps({'files': files}), headers=h)
    # calendar: one event tomorrow at 10 AM
    items = []
    if 'timeMin=2026-11-02' in u or 'timeMin=2026-11-02'.replace(':', '%3A') in u:
        items = [{'id': 'g1', 'summary': 'Class with Irina', 'status': 'confirmed', 'start': {'dateTime': '2026-11-02T10:00:00-08:00'}, 'end': {'dateTime': '2026-11-02T11:00:00-08:00'}}]
    if r.method == 'POST':
        return route.fulfill(status=200, content_type='application/json', body=json.dumps({'id': f'ev{len(uploads)}'}), headers=h)
    return route.fulfill(status=200, content_type='application/json', body=json.dumps({'items': items, 'summary': 'marcelo@berkeley.edu'}), headers=h)

errors = []
def page(ctx, hour=19):
    pg = ctx.new_page()
    pg.clock.set_fixed_time(datetime.datetime(2026, 11, 1, hour, 0))
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.route('https://accounts.google.com/gsi/client', lambda r: r.fulfill(status=200, content_type='text/javascript', body=GIS))
    pg.route('https://www.googleapis.com/**', google)
    return pg

def data(pg):
    return json.loads(pg.evaluate("localStorage.getItem('personal-io:v1')"))

with sync_playwright() as p:
    b = p.chromium.launch()
    comp = b.new_context(viewport={'width': 1400, 'height': 1000})
    comp.add_init_script(f"if(!localStorage.getItem('seeded')){{localStorage.setItem('personal-io:v1', {json.dumps(json.dumps(st))});localStorage.setItem('personal-io:google-client-id','123-abc.apps.googleusercontent.com');localStorage.setItem('seeded','1')}}")
    pc = page(comp)
    pc.goto(BASE + '#start'); pc.wait_for_selector('.col-day')
    print('computer pill before:', pc.inner_text('#sync-pill'))
    pc.click('[data-action="sync-now"]'); pc.wait_for_timeout(800)
    print('computer pill after connect:', pc.inner_text('#sync-pill'), '| drive files:', len(drive))
    # plan tomorrow and set it
    pc.click('[data-action="plan-day"][data-day="tomorrow"]')
    pc.click('[data-action="add-to-day"][data-id="a"]'); pc.wait_for_timeout(300)
    pc.click('.col-day [data-action="set-plan"]'); pc.wait_for_timeout(2500)
    saved = json.loads(drive['f1']['text'])
    print('drive has tomorrow plan:', saved['days'].get(TOM, {}).get('taskIds'), 'set:', saved['days'].get(TOM, {}).get('set'))
    print('calendar shows Google event:', pc.locator('#cal-plan .ev-google').count())
    phone_link = None
    pc.click('[data-action="open-settings"]'); pc.wait_for_timeout(200)
    phone_link = pc.input_value('[aria-label="Link for your phone"]')
    print('settings drive chip:', pc.locator('.chip-done:has-text("Google Drive")').count(), '| phone link ok:', '#connect=123-abc.apps.googleusercontent.com' in phone_link)
    pc.screenshot(path='tests/e2e/out/sync_settings.png')
    pc.click('[data-action="close-modal"]')

    # "close the browser": a new page in the same profile, after the hour (no Google sign-in)
    pc.close()
    pc = page(comp)
    pc.add_init_script("localStorage.removeItem('personal-io:google-session')")
    pc.goto(BASE); pc.wait_for_selector('.col-day')
    print('reopened at 7 PM, plan page shows:', pc.inner_text('.col-day h2'), '| rows:', pc.locator('.col-day .plan-row').count(), '|', pc.inner_text('.col-day .note-ok') if pc.locator('.col-day .note-ok').count() else 'no set note')
    print('Google event still shown after the hour:', pc.locator('#cal-plan .ev-google').count(), '| pill:', pc.inner_text('#sync-pill'))
    pc.screenshot(path='tests/e2e/out/sync_reopen.png')

    # phone: fresh, opens the link, taps Sync
    phone = b.new_context(viewport={'width': 390, 'height': 844})
    pp = page(phone, hour=20)
    pp.goto(phone_link.replace('https://', 'http://').replace(phone_link.split('#')[0], BASE)); pp.wait_for_selector('.col-day')
    print('phone after link: url', pp.url.split('/')[-1], '| client id saved:', pp.evaluate("localStorage.getItem('personal-io:google-client-id')"))
    pp.click('[data-action="sync-now"]'); pp.wait_for_timeout(800)
    print('phone tasks:', [t['title'] for t in data(pp)['tasks']], '| plan rows:', pp.locator('.col-day .plan-row').count())
    pp.screenshot(path='tests/e2e/out/sync_phone.png')
    # phone adds a task, it goes to Drive
    pp.fill('#cap-text', 'Buy milk'); pp.click('[data-action="quick-add"]'); pp.wait_for_timeout(2500)
    print('drive has Buy milk:', 'Buy milk' in drive['f1']['text'])

    # computer reconnects: gets the phone's change
    pc.click('[data-action="sync-now"]'); pc.wait_for_timeout(800)
    print('computer got Buy milk:', any(t['title'] == 'Buy milk' for t in data(pc)['tasks']))

    # both change while the computer is offline -> asks
    pc.evaluate("localStorage.removeItem('personal-io:google-session')"); pc.reload(); pc.wait_for_selector('.col-day')
    pc.fill('#cap-text', 'Computer only'); pc.click('[data-action="quick-add"]'); pc.wait_for_timeout(300)
    pp.fill('#cap-text', 'Phone only'); pp.click('[data-action="quick-add"]'); pp.wait_for_timeout(2500)
    pc.click('[data-action="sync-now"]'); pc.wait_for_timeout(800)
    print('computer asks which copy:', pc.locator('[data-form="conflict"]').count())
    pc.screenshot(path='tests/e2e/out/sync_conflict.png')
    pc.click('[data-action="sync-pick"][data-pick="here"]'); pc.wait_for_timeout(1500)
    final = json.loads(drive['f1']['text'])
    print('drive after keeping computer:', sorted(t['title'] for t in final['tasks'] if t['status'] == 'open'))
    print('other copy kept:', 'Phone only' in (pc.evaluate("localStorage.getItem('personal-io:other-copy')") or ''))
    print('asks again after pick:', pc.locator('[data-form="conflict"]').count(), '| pill:', pc.inner_text('#sync-pill'))
    # phone then gets the computer's copy
    pp.click('[data-action="sync-now"]'); pp.wait_for_timeout(800)
    print('phone now has Computer only:', any(t['title'] == 'Computer only' for t in data(pp)['tasks']))
print('errors', errors)
