# v2.4: three sections, the games, and the Follower.
# Checks: the sections and what each tab lights up; the Follower picks the level from the day
# (easy and a full grid when free, strong and a quick grid when something is close or after wins);
# a chess move and the computer's answer; a game survives a reload; leaving closes the play record;
# after a game the next task is there; the kind line only after a lot of play; Sudoku can be solved;
# the over-planning line; the numbers.
import json, datetime
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:8765/'
D = '2026-11-17'
def T(i, title, imp=False, deadline=''):
    return {"id": i, "title": title, "goalId": "life", "important": imp, "deadline": deadline, "minutes": 30, "place": "everywhere",
            "status": "open", "firstSteps": ["Open the draft"] if i == 'a' else [], "createdAt": "2026-11-10T10:00:00Z"}
def state(events=(), moments=(), days=None, tasks=None):
    return {"version": 1, "settings": {}, "goals": [{"id": "life", "title": "Keep life running", "why": "x"}],
            "tasks": tasks if tasks is not None else [T('a', 'Send application', True), T('b', 'Read the report')],
            "events": list(events), "days": days or {}, "log": [], "journal": [], "returns": [], "moments": list(moments), "lastOpenDate": D, "lastDailyCheck": D}
errors = []
data = lambda pg: json.loads(pg.evaluate("localStorage.getItem('personal-io:v1')"))
game = lambda pg: json.loads(pg.evaluate("localStorage.getItem('personal-io:game')") or 'null')
plays = lambda pg: [m for m in data(pg).get('moments', []) if m['kind'] == 'play']
def page(b, st, w=390, h=844, phone=True, hour=10, minute=0, install=False):
    ctx = b.new_context(viewport={'width': w, 'height': h}, has_touch=phone, is_mobile=phone)
    ctx.add_init_script("if(!sessionStorage.getItem('seeded')){localStorage.setItem('personal-io:v1', %s);sessionStorage.setItem('seeded','1')}" % json.dumps(json.dumps(st)))
    pg = ctx.new_page(); when = datetime.datetime(2026, 11, 17, hour, minute)
    pg.clock.install(time=when) if install else pg.clock.set_fixed_time(when)
    pg.on('pageerror', lambda e: errors.append(str(e))); pg.on('console', lambda m: errors.append('console: ' + m.text) if m.type == 'error' else None)
    return pg
iso = lambda h, m: datetime.datetime(2026, 11, 17, h, m).astimezone().isoformat()
with sync_playwright() as p:
    b = p.chromium.launch()

    # 1. the sections
    pg = page(b, state())
    pg.goto(BASE + '#play'); pg.wait_for_selector('.play')
    cur = lambda: pg.locator('.bottom-nav a[aria-current="page"]').inner_text().strip()
    assert [a.strip() for a in pg.locator('.bottom-nav a').all_inner_texts()] == ['Procrastination', "Today's Planning", 'Life Planning', 'Calendar']
    assert cur() == 'Procrastination' and pg.inner_text('.play h1') == 'Procrastination'
    assert 'Send application' in pg.inner_text('.play-next'), 'the next task is above the games'
    assert pg.evaluate('document.documentElement.scrollWidth') <= 390
    pg.goto(BASE + '#goals'); pg.wait_for_selector('h1'); assert cur() == 'Life Planning' and pg.inner_text('#view h1') == 'Life Planning'
    pg.goto(BASE + '#today'); pg.wait_for_selector('.subnav'); assert cur() == "Today's Planning"
    pg.click('.subnav a[href="#plan"]'); pg.wait_for_selector('.plan'); assert cur() == "Today's Planning" and pg.locator('.subnav a[aria-current="page"]').inner_text() == 'What matters'

    # 2. free: nothing close, so an easy opponent and a full grid
    pg.goto(BASE + '#play'); pg.click('[data-action="play-chess"]'); pg.wait_for_selector('.board')
    assert pg.inner_text('.play-level') == 'An easy opponent', pg.inner_text('.play-level')
    assert pg.locator('.sq').count() == 64 and pg.locator('.sq[data-piece]').count() == 32
    sq = pg.locator('.sq').first.bounding_box(); assert sq['width'] >= 44 and abs(sq['width'] - sq['height']) < 1, sq

    # 3. a move, and the computer answers
    pg.click('[data-sq="e2"]'); assert sorted(x.get_attribute('data-sq') for x in pg.locator('.sq.is-target').all()) == ['e3', 'e4']
    pg.click('[data-sq="e4"]'); pg.wait_for_function("JSON.parse(localStorage.getItem('personal-io:game')).moves.length === 2", timeout=8000)
    assert game(pg)['moves'][0] == 'e4' and pg.inner_text('.play-status') in ('Your move', 'Check. Your move')
    m = plays(pg); assert len(m) == 1 and m[0]['game'] == 'chess' and m[0]['level'] == 'easy' and m[0]['mode'] == 'free' and 'endAt' not in m[0], m
    pg.click('[data-sq="e8"]'); assert pg.locator('.sq.is-sel').count() == 0, 'he cannot move the computer\'s pieces'

    # 4. the game survives a reload; leaving the section closes the play record and coming back opens a new one
    pg.reload(); pg.wait_for_selector('[data-action="play-resume"]'); assert plays(pg)[0].get('result') == 'left'
    pg.click('[data-action="play-resume"]'); pg.wait_for_selector('.board'); assert len(game(pg)['moves']) == 2 and pg.locator('.sq[data-sq="e4"][data-piece="wp"]').count() == 1
    assert len(plays(pg)) == 2 and 'endAt' not in plays(pg)[1]
    pg.goto(BASE + '#today'); pg.wait_for_selector('.today'); assert plays(pg)[1].get('result') == 'left'

    # 5. after a game the next task is there; Start 1 minute opens the start screen
    pg.goto(BASE + '#play'); pg.click('[data-action="play-resume"]'); pg.click('[data-action="play-end"]'); pg.wait_for_selector('.play-after')
    after = pg.inner_text('.play-after'); assert 'Game ended.' in after and 'Send application' in after and 'Open the draft' in after and 'Good game' not in after, after
    pg.click('.play-after [data-action="play-start"]'); pg.wait_for_selector('[data-form="starter"]')
    st = [x for x in data(pg)['moments'] if x['kind'] == 'start'][-1]; assert st['from'] == 'play' and st['taskId'] == 'a', st
    assert pg.evaluate('location.hash') == '#today' and game(pg) is None
    pg.click('[data-action="starter-close"]')

    # 6. Sudoku: a full grid when free; it can be solved; a repeated number is marked
    pg.goto(BASE + '#play'); pg.click('[data-action="play-sudoku"]'); pg.wait_for_selector('.sudoku')
    assert pg.inner_text('.play-level') == 'A full grid' and pg.locator('.cell').count() == 81
    g = game(pg); empty = [i for i, d in enumerate(g['puzzle']) if d == 0]; assert len(empty) == 40
    first = empty[0]; row = first // 9; other = next(d for d in g['puzzle'][row * 9: row * 9 + 9] if d)
    pg.click(f'.cell[data-i="{first}"]'); pg.click(f'.digit[data-d="{other}"]'); assert pg.locator('.cell.is-bad').count() == 1, 'a repeated number is marked'
    assert pg.locator('.cell.is-given').first.is_disabled()
    for i in empty:
        pg.click(f'.cell[data-i="{i}"]'); pg.click(f'.digit[data-d="{g["solution"][i]}"]')
    pg.wait_for_selector('.play-after'); assert 'Solved.' in pg.inner_text('.play-after')
    assert plays(pg)[-1]['game'] == 'sudoku' and plays(pg)[-1]['result'] == 'solved'
    pg.click('[data-action="settings"], [data-action="open-settings"]'); nums = pg.inner_text('.modal'); assert 'of play on 1 day' in nums and "Copy the Follower's summary" in nums, nums[-400:]
    pg.context.close()

    # 7. tight: a meeting in 30 minutes means a strong opponent and a quick grid
    soon = page(b, state(events=[{"id": "e1", "title": "Class", "date": D, "start": "10:30", "minutes": 60, "repeat": "none"}]))
    soon.goto(BASE + '#play'); soon.click('[data-action="play-chess"]'); soon.wait_for_selector('.board')
    assert soon.inner_text('.play-level') == 'A strong opponent' and plays(soon)[0]['mode'] == 'tight'
    soon.click('[data-action="play-home"]'); soon.click('[data-action="play-sudoku"]'); soon.wait_for_selector('.sudoku')
    assert soon.inner_text('.play-level') == 'A quick one' and soon.locator('.cell').count() == 36
    soon.context.close()

    # 8. two wins in a row when free: the opponent gets stronger, so a streak does not pull him in
    wins = [{"id": f"w{i}", "kind": "play", "game": "chess", "level": "easy", "mode": "free", "at": iso(9, i * 5), "endAt": iso(9, i * 5 + 3), "result": "win"} for i in range(2)]
    won = page(b, state(moments=wins))
    won.goto(BASE + '#play'); won.click('[data-action="play-chess"]'); won.wait_for_selector('.board'); assert won.inner_text('.play-level') == 'An even opponent'
    won.context.close()

    # 9. the one kind line, only after a lot of play (25 minutes), with the task's name; each answer is kept
    much = [{"id": "m1", "kind": "play", "game": "chess", "level": "easy", "mode": "free", "at": iso(9, 0), "endAt": iso(9, 26), "result": "loss"}]
    lot = page(b, state(moments=much))
    lot.goto(BASE + '#play'); lot.click('[data-action="play-chess"]'); lot.wait_for_selector('.board'); lot.click('[data-action="play-end"]'); lot.wait_for_selector('.play-after')
    line = lot.inner_text('.play-after'); assert 'Good game, happy you are having a good time.' in line and 'Send application' in line and 'Want to plan when to play?' in line, line
    n = [x for x in data(lot)['moments'] if x['kind'] == 'nudge']; assert len(n) == 1 and n[0]['which'] == 'play25' and n[0]['did'] is None, n
    lot.click('[data-action="play-plan"]'); lot.wait_for_selector('[data-form="pause"]'); assert 'call you back' in lot.inner_text('[data-form="pause"]').lower() or 'how long' in lot.inner_text('[data-form="pause"]').lower(), lot.inner_text('[data-form="pause"]')
    assert [x for x in data(lot)['moments'] if x['kind'] == 'nudge'][0]['did'] == 'plan'
    lot.keyboard.press('Escape'); lot.click('[data-action="play-again"]'); lot.wait_for_selector('.board'); lot.click('[data-action="play-end"]'); lot.wait_for_selector('.play-after')
    assert 'Good game' not in lot.inner_text('.play-after'), 'the line is said once'
    lot.context.close()

    # 10. over-planning: ten minutes in Today's Planning without a start, one kind line with a start button
    pl = page(b, state(), install=True)
    pl.goto(BASE + '#plan'); pl.wait_for_selector('.plan')
    pl.clock.run_for('09:50'); assert pl.locator('#toasts .toast').count() == 0
    pl.clock.run_for('00:15'); pl.wait_for_selector('#toasts .toast')   # the line stays for a few seconds
    assert 'You have planned enough. Start the first thing?' in pl.inner_text('#toasts')
    assert [x['which'] for x in data(pl)['moments'] if x['kind'] == 'nudge'] == ['plan']
    pl.click('#toasts [data-action="follow-start"]'); pl.wait_for_selector('[data-form="starter"]')
    assert [x for x in data(pl)['moments'] if x['kind'] == 'nudge'][0]['did'] == 'start' and [x for x in data(pl)['moments'] if x['kind'] == 'start'][-1]['from'] == 'follower'
    pl.click('[data-action="starter-close"]'); pl.goto(BASE + '#play'); pl.wait_for_selector('.play')
    v = [x for x in data(pl)['moments'] if x['kind'] == 'visit']; assert len(v) == 1 and v[0]['section'] == 'today' and v[0]['minutes'] >= 10, v
    pl.context.close()

    # 11. a computer: the board fits the window, the tabs read like the rest
    w = page(b, state(), 1366, 800, False)
    w.goto(BASE + '#play'); w.click('[data-action="play-chess"]'); w.wait_for_selector('.board')
    assert w.evaluate('document.documentElement.scrollHeight') <= 800 and w.locator('.tabs a[aria-current="page"]').inner_text().strip().upper() == 'PROCRASTINATION'
    for width in [761, 900, 1100, 1366]:
        w.set_viewport_size({'width': width, 'height': 800}); w.wait_for_timeout(100)
        right = w.evaluate("Math.max(...[...document.querySelectorAll('.topbar a, .topbar button')].filter(e => e.offsetParent).map(e => e.getBoundingClientRect().right))")
        assert right <= width and w.evaluate("document.querySelector('.topbar').getBoundingClientRect().height") < 80, (width, right)
    print('all v2.4 checks passed')
print('PAGE ERRORS', errors)
assert not errors, errors
