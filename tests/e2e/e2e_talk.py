import os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
os.makedirs(OUT, exist_ok=True)
import json, datetime
from playwright.sync_api import sync_playwright
BASE='http://localhost:8765/'
now='2026-10-30T09:00:00'
state={"version":1,"settings":{},"goals":[{"id":"life","title":"Keep life running","why":"x"},{"id":"vc","title":"Get a VC job","why":"y"}],
 "tasks":[
  {"id":"t1","title":"Send the deck","goalId":"vc","priority":"both","deadline":"2026-10-30","minutes":30,"place":"everywhere","status":"open","createdAt":"2026-10-20T10:00:00Z","firstSteps":["Open the deck"]},
  {"id":"t2","title":"Pay rent","goalId":"life","priority":"urgent","deadline":"2026-10-31","minutes":15,"place":"everywhere","status":"open","createdAt":"2026-10-20T10:00:00Z"},
  {"id":"t3","title":"Read a book","goalId":"life","priority":"nice","deadline":"","minutes":30,"place":"everywhere","status":"open","createdAt":"2026-10-20T10:00:00Z"}],
 "events":[],"days":{"2026-10-24":{"taskIds":["t1","t3"]}},"log":[],"journal":[],"returns":[],"lastOpenDate":"2026-10-24"}
errors=[]
def setup(p, key=None, w=1280, h=900):
    ctx=p.chromium.launch().new_context(viewport={'width':w,'height':h})
    ctx.add_init_script(f"if(!sessionStorage.getItem('seeded')){{localStorage.setItem('personal-io:v1', {json.dumps(json.dumps(state))});{'localStorage.setItem(\"personal-io:claude-key\",\"sk-ant-test-123456789\");' if key else ''}sessionStorage.setItem('seeded','1')}}")
    pg=ctx.new_page(); pg.clock.set_fixed_time(datetime.datetime.fromisoformat(now))
    pg.on('pageerror', lambda e: errors.append(str(e)))
    return pg
with sync_playwright() as p:
    # 1. no key: venting + one named task, tick one done
    pg=setup(p)
    pg.goto(BASE); pg.wait_for_selector('[data-form="welcome"]')
    txt=pg.inner_text('[data-form="welcome"]'); print('WELCOME:\n', txt[:900])
    pg.screenshot(path=OUT+'/welcome.png', full_page=True)
    pg.check('input[name="wb-done"][value="t1"]')
    pg.fill('#wb-text','So tired today. Task: email the professor about the paper. I hate mondays.')
    pg.click('[data-action="welcome-start"]')
    pg.wait_for_selector('[data-form="talk-review"]'); print('REVIEW:\n', pg.inner_text('[data-form="talk-review"]'))
    pg.screenshot(path=OUT+'/review.png', full_page=True)
    pg.select_option('.talk-row [data-talk="priority"]','important'); pg.select_option('.talk-row [data-talk="goal"]','vc')
    pg.click('[data-action="talk-add"]'); pg.wait_for_timeout(300)
    s=json.loads(pg.evaluate("localStorage.getItem('personal-io:v1')"))
    print('hash', pg.evaluate('location.hash'), '| tasks', [(t['title'],t['priority'],t['deadline'],t['goalId'],t['status']) for t in s['tasks']])
    print('journal', [j['text'][:30] for j in s['journal']], '| returns', s['returns'])
    # 2. Talk it out: pure venting -> no tasks
    pg.click('[data-action="open-dump"]'); pg.fill('#talk-text','Everything is a lot, my task list is long and I have many tasks.'); pg.click('[data-action="talk-save"]'); pg.wait_for_timeout(300)
    s=json.loads(pg.evaluate("localStorage.getItem('personal-io:v1')"))
    print('after venting: tasks', len(s['tasks']), 'journal', len(s['journal']), 'modal open', pg.evaluate("document.querySelector('#modal').open"))
    # 3. duplicate named + cap problem
    pg.click('[data-action="open-dump"]'); pg.fill('#talk-text','task pay rent and task call mom'); pg.click('[data-action="talk-save"]')
    pg.wait_for_selector('[data-form="talk-review"]'); print('REVIEW2:\n', pg.inner_text('[data-form="talk-review"]'))
    pg.click('[data-action="talk-skip"]')
    # 4. with key: stubbed suggestions
    pg2=setup(p, key=True, w=390, h=844)
    def handle(route):
        body={"content":[{"type":"text","text":json.dumps({"suggestions":[{"title":"Book the dentist","goalId":"life","minutes":15}],"namedGoals":[]})}]}
        route.fulfill(status=200, content_type='application/json', body=json.dumps(body), headers={'access-control-allow-origin':'*'})
    pg2.route('https://api.anthropic.com/**', handle)
    pg2.goto(BASE); pg2.wait_for_selector('[data-form="welcome"]')
    pg2.screenshot(path=OUT+'/welcome_phone.png', full_page=True)
    pg2.fill('#wb-text','My tooth hurts, I should probably see the dentist this week.')
    pg2.click('[data-action="welcome-start"]'); pg2.wait_for_selector('[data-form="talk-review"]')
    print('REVIEW3:\n', pg2.inner_text('[data-form="talk-review"]'), '| checked:', pg2.is_checked('[data-talk="pick"]'))
    pg2.screenshot(path=OUT+'/review_phone.png', full_page=True)
    pg2.click('[data-action="talk-add"]'); print('err shown:', pg2.inner_text('.form-errors'))
    pg2.click('[data-action="talk-skip"]'); pg2.wait_for_timeout(200)
    print('hash', pg2.evaluate('location.hash'))
print('PAGE ERRORS', errors)
