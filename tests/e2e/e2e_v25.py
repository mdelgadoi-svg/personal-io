# v2.5: his Nov 19 notes. A square check that crosses a task out; a "goal: #" oval (number, life, ?),
# picked by Claude with his key (stubbed here) or by him from the oval; "Plan my day" (Today / Tomorrow /
# Later, tap the time to move it); chess with a clock he picks, the time of day, captured pieces,
# and the Follower box that talks about time and what is next.
import json, datetime
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:8765/'
D = '2026-11-20'
def T(i, title, goal='life', by=None, imp=False, deadline='', minutes=30, **x):
    t = {"id": i, "title": title, "goalId": goal, "important": imp, "deadline": deadline, "minutes": minutes, "place": "everywhere",
         "status": "open", "firstSteps": [], "createdAt": "2026-11-10T10:00:00Z", **x}
    if by is not None: t["goalBy"] = by
    return t
GOALS = [{"id": "job", "title": "Get a VC job", "why": "career"}, {"id": "school", "title": "Do well at Haas", "why": "grades"},
         {"id": "life", "title": "Keep life running", "why": "x"}]
def state(tasks, days=None, moments=()):
    return {"version": 1, "settings": {}, "goals": GOALS, "tasks": tasks, "events": [], "days": days or {}, "log": [], "journal": [],
            "returns": [], "moments": list(moments), "lastOpenDate": D, "lastDailyCheck": D}
errors = []
data = lambda pg: json.loads(pg.evaluate("localStorage.getItem('personal-io:v1')"))
tk = lambda pg, i: next(t for t in data(pg)['tasks'] if t['id'] == i)
def page(b, st, w=390, h=844, hour=9, minute=0, install=False, key=False):
    phone = w < 700
    ctx = b.new_context(viewport={'width': w, 'height': h}, has_touch=phone, is_mobile=phone)
    ctx.add_init_script("if(!sessionStorage.getItem('seeded')){localStorage.setItem('personal-io:v1', %s);%ssessionStorage.setItem('seeded','1')}"
                        % (json.dumps(json.dumps(st)), "localStorage.setItem('personal-io:claude-key','sk-ant-test-1234567890abcdefghij');" if key else ''))
    pg = ctx.new_page(); when = datetime.datetime(2026, 11, 20, hour, minute)
    pg.clock.install(time=when) if install else pg.clock.set_fixed_time(when)
    pg.on('pageerror', lambda e: errors.append(str(e)))
    return pg
calls = []
def claude(route):
    body = json.loads(route.request.post_data or '{}'); calls.append(body)
    text = body['messages'][0]['content']
    picks = []
    if 'Send CV to Ana' in text: picks.append({"id": "c", "goal": "job"})
    if 'Buy milk' in text: picks.append({"id": "m", "goal": "none"})
    route.fulfill(status=200, content_type='application/json', headers={'access-control-allow-origin': '*'},
                  body=json.dumps({"stop_reason": "end_turn", "content": [{"type": "text", "text": json.dumps({"picks": picks})}]}))

with sync_playwright() as p:
    b = p.chromium.launch()
    for w in [390, 1280]:
        # 1. Today: square check crosses out and undoes; goal ovals: number, life, ?
        tasks = [T('a', 'Essay draft', 'school', 'me', True), T('l', 'Pay rent', 'life', 'me'), T('u', 'Call Pancho')]
        st = state(tasks, days={D: {"taskIds": ["a", "l", "u"], "times": {"a": "10:00", "l": "11:00", "u": "12:00"}, "slots": 3, "set": True}})
        pg = page(b, st, w=w)
        pg.goto(BASE + '#today'); pg.wait_for_selector('.dayline')
        ovals = pg.locator('.dayline .goal-oval').all_inner_texts()
        assert ovals == ['goal: life', 'goal: ?'], ovals  # the first task sits on the green band
        assert pg.locator('.next .goal-oval').inner_text() == 'goal: 2', 'the green band has it too'
        pg.click('.dayline .dl-row:has-text("Pay rent") .tick'); pg.wait_for_timeout(250)
        assert tk(pg, 'l')['status'] == 'done'
        row = pg.locator('.dl-row:has-text("Pay rent")')
        assert 'line-through' in row.locator('.dl-title').evaluate('e => getComputedStyle(e).textDecorationLine')
        assert 'line-through' in row.locator('.dl-time').evaluate('e => getComputedStyle(e).textDecorationLine')
        pg.wait_for_timeout(800); pg.click('.dl-row:has-text("Pay rent") .tick'); pg.wait_for_timeout(250)
        assert tk(pg, 'l')['status'] == 'open', 'unchecking opens it again'
        # pick a goal from the oval
        pg.click('.dl-row:has-text("Call Pancho") .goal-oval'); pg.wait_for_selector('[data-form="goal-pick"]')
        assert pg.locator('.gp-row').all_inner_texts()[0].startswith('1')
        pg.click('.gp-row[data-goal="job"]'); pg.wait_for_timeout(250)
        assert tk(pg, 'u')['goalId'] == 'job' and tk(pg, 'u')['goalBy'] == 'me'
        assert pg.locator('.dl-row:has-text("Call Pancho") .goal-oval').inner_text() == 'goal: 1'
        assert pg.evaluate('document.documentElement.scrollWidth') <= w
        pg.screenshot(path=f'tests/e2e/out/v25_today_{w}.png'); pg.context.close()

        # 2. the morning proposal has the check and the oval
        st = state([T('a', 'Essay draft', 'school', 'me', True, D), T('m', 'Buy milk', deadline=D)])
        pg = page(b, st, w=w); pg.goto(BASE + '#today'); pg.wait_for_selector('.proposal')
        assert pg.locator('.proposal .tick').count() == 2 and pg.locator('.proposal .goal-oval').count() == 2
        pg.click('.proposal .prop-row:has-text("Buy milk") .tick'); pg.wait_for_timeout(250)
        assert tk(pg, 'm')['status'] == 'done' and 'Buy milk' not in pg.inner_text('.proposal')
        pg.context.close()

        # 3. Plan my day: Today places with a time, the time can change, Tomorrow, Later, x takes it out
        st = state([T('a', 'Essay draft', 'school', 'me', True, minutes=60), T('b', 'Read the report', minutes=30), T('c', 'Book flight')])
        pg = page(b, st, w=w); pg.goto(BASE + '#plan'); pg.wait_for_selector('.plan')
        assert pg.inner_text('.plan-title') == 'Plan my day' and pg.locator('.subnav a[aria-current="page"]').inner_text() == 'Plan my day'
        assert 'Nothing placed today' in pg.inner_text('.plan')
        pg.click('.pl-toplace:has-text("Essay draft") [data-action="place-day"][data-day="today"]'); pg.wait_for_timeout(400)
        assert 'a' in data(pg)['days'][D]['taskIds']
        at = data(pg)['days'][D]['times']['a']; assert at >= '09:00', at
        assert pg.locator('.pl-placed:has-text("Essay draft") .pl-time').inner_text().endswith('AM')
        assert pg.locator('.pl-toplace:has-text("Essay draft")').count() == 0, 'it moved up to the day'
        assert pg.locator('.toast').last.inner_text().startswith('Placed at')
        pg.click('.pl-placed:has-text("Essay draft") .pl-time'); pg.wait_for_selector('[data-form="time"]'); pg.keyboard.press('Escape')
        pg.click('.pl-toplace:has-text("Read the report") [data-day="tomorrow"]'); pg.wait_for_timeout(400)
        tom = (datetime.date(2026, 11, 20) + datetime.timedelta(days=1)).isoformat()
        assert 'b' in data(pg)['days'][tom]['taskIds'] and tk(pg, 'b')['deadline'] == tom
        assert 'Tomorrow at' in pg.inner_text('.pl-toplace:has-text("Read the report")')
        assert pg.locator('.pl-toplace:has-text("Book flight") select.pl-later option').all_inner_texts() == ['Later', 'Next week', 'Pick a date', 'No date']
        pg.select_option('.pl-toplace:has-text("Book flight") select.pl-later', 'next')
        pg.wait_for_timeout(300); assert tk(pg, 'c')['deadline'] > D
        pg.click('.pl-placed:has-text("Essay draft") .pl-out'); pg.wait_for_timeout(300)
        assert 'a' not in data(pg)['days'][D]['taskIds']
        pg.click('[data-action="plan-switch"]'); pg.wait_for_timeout(200)
        assert 'TOMORROW' in pg.inner_text('.pl-dayhead').upper() and 'Read the report' in pg.inner_text('.pl-day')
        assert pg.evaluate('document.documentElement.scrollWidth') <= w
        pg.screenshot(path=f'tests/e2e/out/v25_plan_{w}.png', full_page=True); pg.context.close()

    # 4. Claude picks goals with his key (stubbed); "none" stays "?" and is not asked again
    st = state([T('c', 'Send CV to Ana'), T('m', 'Buy milk'), T('a', 'Essay draft', 'school')])
    pg = page(b, st, w=1280, key=True); pg.route('https://api.anthropic.com/**', claude)
    pg.goto(BASE + '#plan'); pg.wait_for_timeout(1500)
    assert len(calls) == 1, len(calls)
    sent = calls[0]['messages'][0]['content']
    assert 'Send CV to Ana' in sent and 'Buy milk' in sent and 'Essay draft' not in sent, 'only tasks nobody picked'
    assert calls[0]['output_config']['format']['type'] == 'json_schema'
    assert tk(pg, 'c')['goalId'] == 'job' and tk(pg, 'c')['goalBy'] == 'ai' and tk(pg, 'm').get('goalBy') is None
    assert pg.locator('.pl-toplace:has-text("Send CV to Ana") .goal-oval').inner_text() == 'goal: 1'
    assert pg.locator('.pl-toplace:has-text("Buy milk") .goal-oval').inner_text() == 'goal: ?'
    pg.goto(BASE + '#today'); pg.wait_for_timeout(500); assert len(calls) == 1, 'asked once per task name'
    pg.context.close()

    # 5. chess: pick the clock, the time of day, clocks run, a capture shows, the flag falls
    for w in [390, 1280]:
        st = state([T('a', 'Essay draft', 'school', 'me', True)], days={D: {"taskIds": ["a"], "times": {"a": "10:00"}, "slots": 3, "set": True}})
        pg = page(b, st, w=w, install=True)
        pg.goto(BASE + '#play'); pg.wait_for_selector('.play')
        fol = pg.inner_text('.follower')
        if w > 700:
            assert 'keeping an eye on the time' in fol and 'Next: Essay draft at 10:00 AM, in 1h' in fol, fol
            assert pg.locator('.follower').evaluate('e => getComputedStyle(e).position') == 'fixed'
        else:
            assert 'The Follower' in fol and pg.locator('.follower.is-closed').count() == 1, 'one line on a phone'
            pg.click('[data-action="follower-toggle"]'); pg.wait_for_timeout(100)
            assert 'Next: Essay draft' in pg.inner_text('.follower')
        pg.click('[data-action="play-chess"]'); pg.wait_for_selector('.play-clock-pick')
        assert pg.inner_text('.play-now') == '9:00 AM'
        pg.click('[data-action="chess-clock"][data-min="5"]'); pg.wait_for_selector('.board')
        assert pg.inner_text('.clock-w .clock-time') == '5:00' and pg.inner_text('.clock-b .clock-time') == '5:00'
        assert pg.locator('.clock-w.is-running').count() == 1
        pg.clock.run_for(3000)
        assert pg.inner_text('.clock-w .clock-time') in ('4:57', '4:58'), pg.inner_text('.clock-w .clock-time')
        # a capture: e4, then wait for the reply, then take whatever the move list allows
        def move(a, c):
            pg.click(f'.sq[data-sq="{a}"]'); pg.click(f'.sq[data-sq="{c}"]')
            for _ in range(40):
                pg.clock.run_for(200)
                if json.loads(pg.evaluate("localStorage.getItem('personal-io:game')"))['games']['chess']['moves'][-1:] and len(json.loads(pg.evaluate("localStorage.getItem('personal-io:game')"))['games']['chess']['moves']) % 2 == 0: break
        move('e2', 'e4')
        g = json.loads(pg.evaluate("localStorage.getItem('personal-io:game')"))['games']['chess']
        assert g['clock']['side'] == 'w' and g['clock']['b'] < 300000, g['clock']
        assert pg.locator('.clock-w .caps').count() == 1 and pg.locator('.clock-b .caps').count() == 1
        pg.clock.run_for(5 * 60000)
        pg.wait_for_selector('.play-after')
        assert "Time's up" in pg.inner_text('.play-after')
        pl = [m for m in data(pg)['moments'] if m['kind'] == 'play'][-1]; assert pl['result'] == 'loss', pl
        assert pg.evaluate('document.documentElement.scrollWidth') <= w
        pg.screenshot(path=f'tests/e2e/out/v25_chess_{w}.png', full_page=True)
        # play again asks for the time again
        pg.click('[data-action="play-again"]'); pg.wait_for_selector('.play-clock-pick')
        assert pg.locator('.play-clock-pick .is-on').inner_text() == '5 min'
        pg.context.close()

    # 6. captured pieces show from the moves (a game with a capture already played, kept on the device)
    st = state([])
    pg = page(b, st, w=1280)
    pg.add_init_script("""localStorage.setItem('personal-io:game', JSON.stringify({cur:'chess', games:{chess:{kind:'chess', mode:'free', level:'easy',
      moves:['e4','d5','exd5','Qxd5'], sel:null, targets:[], last:null, over:null, thinking:false, momentId:null, clock:{each:10,w:500000,b:590000,side:'w',since:null}}, sudoku:null}}))""")
    pg.goto(BASE + '#play'); pg.wait_for_selector('.play'); pg.click('[data-action="play-chess"]'); pg.wait_for_selector('.board')
    assert pg.locator('.clock-w .caps svg').count() == 1 and pg.locator('.clock-b .caps svg').count() == 1
    assert 'You took: pawn' in pg.get_attribute('.clock-w .caps', 'aria-label')
    assert pg.inner_text('.clock-w .clock-time') == '8:20'
    pg.screenshot(path='tests/e2e/out/v25_caps.png'); pg.context.close()
    print('all v2.5 checks passed')
print('PAGE ERRORS', errors)
assert not errors, errors
