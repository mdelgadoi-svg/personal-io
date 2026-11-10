# v2.1: calm return, the Pause button, and breaks that end on time.
# A fake bridge stands in for Google (data file and calendar writes).
import json, datetime
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:8765/'
URL = 'https://script.google.com/macros/s/AKfyV21/exec'
D = '2026-11-10'
def t(id, title, important=False, deadline='', minutes=30, **extra):
    return {"id": id, "title": title, "goalId": "life", "important": important, "priority": "nice", "deadline": deadline, "minutes": minutes,
            "place": "everywhere", "status": "open", "createdAt": "2026-10-30T10:00:00Z", **extra}
base = {"version": 1, "settings": {}, "lastDailyCheck": D, "events": [], "log": [], "journal": [], "returns": [],
        "goals": [{"id": "life", "title": "Keep life running", "why": "x"}],
        "tasks": [t('a', 'Write the long essay', True, '2026-11-05', 120), t('b', 'Email the professor', True, '2026-11-07', 10, firstSteps=['Open Gmail']),
                  t('c', 'Pay rent', False, '2026-11-08', 15), t('d', 'Fix the bike', False, '2026-11-04'), t('e', 'Read a book')]}
away = {**base, "lastOpenDate": "2026-11-06", "days": {"2026-11-06": {"taskIds": ["a", "b"]}}}
fake = {'text': None, 'calls': []}
def saved_at():
    try: return json.loads(fake['text']).get('savedAt') if fake['text'] else None
    except Exception: return None
def bridge(route):
    b = json.loads(route.request.post_data or '{}'); a = b.get('action'); h = {'access-control-allow-origin': '*'}
    if a == 'ping': out = {'ok': True, 'account': 'test@example.com'}
    elif a == 'info': out = {'savedAt': saved_at()}
    elif a == 'read': out = {'savedAt': saved_at(), 'text': fake['text'] if saved_at() else None}
    elif a == 'write': out = {'conflict': True} if b.get('expect') != saved_at() else (fake.update(text=b['text']) or {'ok': True})
    elif a == 'events': out = {'items': []}
    elif a == 'writeDay':
        fake['calls'].append(b); out = {'ids': [f'g{len(fake["calls"])}-{i}' for i in range(len(b.get('bodies', [])))]}
    else: out = {'error': 'unknown'}
    route.fulfill(status=200, content_type='application/json', body=json.dumps(out), headers=h)
errors = []
data = lambda pg: json.loads(pg.evaluate("localStorage.getItem('personal-io:v1')"))
def at(pg, h, m):
    pg.clock.set_fixed_time(datetime.datetime(2026, 11, 10, h, m))
    pg.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); pg.wait_for_timeout(400)
def page(b, st, vp, bridge_on=True):
    ctx = b.new_context(viewport=vp)
    extra = f"localStorage.setItem('personal-io:bridge', JSON.stringify({{url:'{URL}', key:'k'}}));" if bridge_on else ''
    ctx.add_init_script(f"if(!localStorage.getItem('seeded')){{localStorage.setItem('personal-io:v1', {json.dumps(json.dumps(st))});{extra}localStorage.setItem('seeded','1')}}")
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.clock.set_fixed_time(datetime.datetime(2026, 11, 10, 9, 0))
    if bridge_on: pg.route('https://script.google.com/**', bridge)
    return pg
with sync_playwright() as p:
    b = p.chromium.launch()
    # 1. Back after 4 days: one small thing, no counts, the list folded away
    pg = page(b, away, {'width': 1400, 'height': 1000})
    pg.goto(BASE + '#today'); pg.wait_for_selector('[data-form="welcome"]')
    w = pg.inner_text('[data-form="welcome"]'); print('WELCOME:', w.replace('\n', ' | ')[:300])
    assert 'Welcome back' in w and 'No catching up needed' in w, w
    assert 'Where things stand' not in w and 'Last time' not in w, w
    assert 'Email the professor' in w and 'Open Gmail' in w, 'the shortest of the top 3 is offered'
    assert pg.get_attribute('details.welcome-more', 'open') is None, 'list starts folded'
    pg.click('[data-action="welcome-start-task"]'); pg.wait_for_selector('[data-form="starter"]')
    st = pg.inner_text('[data-form="starter"]'); assert 'Open Gmail' in st, st
    assert pg.locator('[data-form="starter"] svg[aria-label="A calm cat, here with you"]').count() == 1, 'calm cat'
    s = data(pg); assert s['returns'][-1]['gapDays'] == 4, s['returns']
    assert any(m['kind'] == 'start' and m['taskId'] == 'b' for m in s['moments']), s.get('moments')
    pg.click('[data-action="starter-close"]'); pg.wait_for_timeout(300)
    # 2. The day proposal is small: one thing
    prop = pg.inner_text('.proposal'); print('PROPOSAL:', prop.replace('\n', ' | '))
    assert 'One small thing for today' in prop and pg.locator('.proposal li').count() == 1, prop
    # 3. Pause > anxious: the worry is saved as a note, never a task
    pg.click('[data-action="open-pause"]'); pg.wait_for_selector('[data-form="pause"]')
    pg.click('[data-action="pause-feel"][data-feel="anxious"]'); pg.wait_for_timeout(150)
    txt = pg.inner_text('[data-form="pause"]'); assert 'three slow breaths' in txt and 'doctor or therapist' in txt, txt
    n = len(data(pg)['tasks'])
    pg.fill('#pause-worry', 'Task: I am worried the professor is upset'); pg.click('[data-action="pause-worry-save"]'); pg.wait_for_timeout(200)
    s = data(pg); assert s['journal'][-1]['source'] == 'pause' and len(s['tasks']) == n, 'worry is a note only'
    assert 'Written down' in pg.inner_text('[data-form="pause"]')
    assert [m for m in s['moments'] if m['kind'] == 'pause'][-1]['chose'] == 'worry'
    # 4. Pause > a break: 10 minutes of chess, the phone reminder goes to Google Calendar
    pg.click('[data-action="pause-home"]'); pg.click('[data-action="pause-feel"][data-feel="break"]'); pg.wait_for_timeout(150)
    pg.click('[data-group="break-what"] button[data-value="Chess"]'); pg.click('[data-group="break-min"] button[data-value="10"]')
    pg.click('[data-action="break-start"]'); pg.wait_for_timeout(600)
    call = fake['calls'][-1]; body = call['bodies'][0]; print('REMINDER:', body['summary'], body['start'], body['reminders'])
    assert body['summary'] == 'Break over. Back to: Email the professor' and body['reminders']['overrides'] == [{'method': 'popup', 'minutes': 0}], body
    assert call['deleteIds'] == []
    pill = pg.inner_text('#now-pill'); assert 'Break' in pill and '10 min' in pill, pill
    brk = [m for m in data(pg)['moments'] if m['kind'] == 'break'][-1]; assert brk['what'] == 'Chess' and brk['googleId'] == 'g1-0', brk
    # 5. Time is up: a kind window with the next step; 5 more minutes moves the reminder
    at(pg, 9, 11); pg.wait_for_selector('[data-form="back"]')
    back = pg.inner_text('[data-form="back"]'); print('BACK:', back.replace('\n', ' | ')); assert "Break's over" in back and 'Email the professor' in back, back
    pg.click('[data-action="back-more"]'); pg.wait_for_timeout(500)
    call = fake['calls'][-1]; assert call['deleteIds'] == ['g1-0'] and len(call['bodies']) == 1, call
    assert pg.locator('[data-form="back"]').count() == 0
    at(pg, 9, 17); pg.wait_for_selector('[data-form="back"]')
    pg.click('[data-action="back-start"]'); pg.wait_for_selector('[data-form="starter"]')
    brk = [m for m in data(pg)['moments'] if m['kind'] == 'break'][-1]
    assert brk['back'] == 'start' and brk['extended'] == 5 and brk['backAt'], brk
    assert 'Break' not in pg.inner_text('#now-pill')
    pg.click('[data-action="starter-close"]')
    # 6. Back early from the pill: the reminder is removed
    pg.click('[data-action="open-pause"]'); pg.click('[data-action="pause-feel"][data-feel="break"]'); pg.click('[data-action="break-start"]'); pg.wait_for_timeout(500)
    rid = [m for m in data(pg)['moments'] if m['kind'] == 'break'][-1]['googleId']
    at(pg, 9, 25); pg.click('[data-action="break-back"]'); pg.wait_for_selector('[data-form="back"]')
    assert 'Welcome back' in pg.inner_text('[data-form="back"]') and pg.locator('[data-action="back-more"]').count() == 0
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    assert [m for m in data(pg)['moments'] if m['kind'] == 'break'][-1].get('backAt') is None, 'Esc before the end keeps the break'
    pg.click('[data-action="break-back"]'); pg.click('[data-action="back-not-now"]'); pg.wait_for_timeout(400)
    assert fake['calls'][-1]['deleteIds'] == [rid] and fake['calls'][-1]['bodies'] == [], fake['calls'][-1]
    pg.screenshot(path='tests/e2e/out/v21_desk.png')
    # 7. Phone, no Google: yesterday's open, calm words, an old break closes quietly
    old_break = {"id": "ob", "kind": "break", "at": "2026-11-09T20:00:00Z", "what": "Instagram", "minutes": 20, "endAt": "2026-11-09T20:20:00Z"}
    near = {**base, "lastOpenDate": "2026-11-09", "moments": [old_break],
            "days": {D: {"taskIds": ["c"], "times": {"c": "08:00"}, "set": True, "slots": 3}},
            "log": [{"at": "2026-11-10T16:30:00Z", "date": D, "taskId": "c", "title": "Pay rent", "result": "not_started", "reason": "Low energy"}]}
    ph = page(b, near, {'width': 390, 'height': 844}, bridge_on=False)
    ph.goto(BASE + '#today'); ph.wait_for_selector('[data-form="welcome"]')
    w = ph.inner_text('[data-form="welcome"]'); assert 'Good morning' in w and 'Where things stand' not in w, w
    ph.keyboard.press('Escape'); ph.wait_for_timeout(300)
    assert ph.locator('[data-form="back"]').count() == 0, 'no greeting for a break from last night'
    ob = next(m for m in data(ph)['moments'] if m['id'] == 'ob'); assert ob['back'] == 'closed', ob
    today = ph.inner_text('#view'); assert 'Not yet' in today and 'Not done' not in today and 'Did I do it' not in today, today[:400]
    assert ph.locator('[data-action="open-pause"]').is_visible(), 'Pause button on the phone'
    ph.click('[data-action="open-pause"]'); ph.click('[data-action="pause-feel"][data-feel="break"]')
    assert 'Keep the app open' in ph.inner_text('[data-form="pause"]')
    ph.screenshot(path='tests/e2e/out/v21_phone.png')
    print('all v2.1 checks passed')
print('PAGE ERRORS', errors)
assert not errors, errors
