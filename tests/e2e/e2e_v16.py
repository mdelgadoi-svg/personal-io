import os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
os.makedirs(OUT, exist_ok=True)
import json, datetime
from playwright.sync_api import sync_playwright
BASE='http://localhost:8765/'
TODAY='2026-10-31'
state={"version":1,"settings":{},"goals":[{"id":"life","title":"Keep life running","why":"x"},{"id":"vc","title":"Get a VC job","why":"y"}],
 "tasks":[
  {"id":"t1","title":"Send the deck","goalId":"vc","priority":"both","deadline":TODAY,"minutes":30,"place":"everywhere","status":"open","createdAt":"2026-10-30T10:00:00Z","firstSteps":["Close all windows","Open the deck","Fix slide 1"]},
  {"id":"t2","title":"Pay rent","goalId":"life","priority":"urgent","deadline":"2026-11-01","minutes":15,"place":"everywhere","status":"open","createdAt":"2026-10-30T10:00:00Z"},
  {"id":"t3","title":"Email Julia","goalId":"vc","priority":"both","deadline":TODAY,"minutes":30,"place":"everywhere","status":"open","createdAt":"2026-10-30T10:00:00Z"}],
 "events":[
  {"id":"e1","title":"Class A","date":TODAY,"start":"08:00","minutes":240,"repeat":"none"},
  {"id":"e2","title":"Workshop","date":TODAY,"start":"12:00","minutes":240,"repeat":"none"},
  {"id":"e3","title":"Dinner event","date":TODAY,"start":"17:00","minutes":180,"repeat":"none"}],
 "days":{},"log":[],"journal":[],"returns":[],"lastOpenDate":TODAY,"lastDailyCheck":TODAY}
GIS="""window.google={accounts:{oauth2:{initTokenClient:(o)=>({requestAccessToken:()=>setTimeout(()=>o.callback({access_token:'tok',expires_in:3600}),10)})}}};"""
errors=[]
def anth(route):
    body=json.loads(route.request.post_data)
    txt=body['messages'][0]['content']
    if 'Reply with OK' in txt: out='OK'
    elif 'last two weeks of email' in txt: out=json.dumps({"tasks":[{"title":"Send Julia the climate memo","goalId":"vc","minutes":30,"email":0}]})
    else: out=json.dumps({"firstSteps":["Close all windows and tabs","Open the memo","Write one line"],"toGetItDone":["Memo draft"]})
    route.fulfill(status=200, content_type='application/json', body=json.dumps({"content":[{"type":"text","text":out}]}), headers={'access-control-allow-origin':'*'})
def gmail(route):
    u=route.request.url
    if '/messages?' in u: b={"messages":[{"id":"m1"}]}
    else: b={"snippet":"Hi Marcelo, can you send me the climate memo by Monday?","labelIds":["INBOX"],"payload":{"headers":[{"name":"Subject","value":"Climate memo"},{"name":"From","value":"Julia <j@x.com>"},{"name":"Date","value":"Thu, 29 Oct 2026"}]}}
    route.fulfill(status=200, content_type='application/json', body=json.dumps(b), headers={'access-control-allow-origin':'*'})
with sync_playwright() as p:
    ctx=p.chromium.launch().new_context(viewport={'width':1400,'height':1000})
    ctx.add_init_script(f"if(!sessionStorage.getItem('seeded')){{localStorage.setItem('personal-io:v1', {json.dumps(json.dumps(state))});localStorage.setItem('personal-io:google-client-id','123-abc.apps.googleusercontent.com');sessionStorage.setItem('seeded','1')}}")
    pg=ctx.new_page(); pg.clock.set_fixed_time(datetime.datetime.fromisoformat(TODAY+'T07:30:00'))
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.route('https://accounts.google.com/gsi/client', lambda r: r.fulfill(status=200, content_type='text/javascript', body=GIS))
    pg.route('https://api.anthropic.com/**', anth)
    pg.route('https://gmail.googleapis.com/**', gmail)
    pg.goto(BASE+'#start'); pg.wait_for_selector('.col-todo')
    print('1 heading:', pg.inner_text('.col-todo h2'))
    print('1 mic in capture:', pg.locator('.capture [data-action="mic"]').count(), '| email link:', pg.locator('[data-action="open-email"]').count())
    print('4 busy card:', pg.inner_text('.cal-suggest')[:160].replace('\n',' | '))
    pg.screenshot(path=OUT+'/v16_plan.png')
    # busy: mark Class A as important
    pg.click('.busy-row:has-text("Class A") [data-action="busy-prio"]'); pg.wait_for_timeout(200)
    s=json.loads(pg.evaluate("localStorage.getItem('personal-io:v1')"))
    print('4 busy->task:', [(t['title'],t['priority']) for t in s['tasks'] if t.get('source')=='calendar'])
    # trash + undo
    pg.click('[data-action="trash-task"][data-id="t2"]'); pg.wait_for_timeout(100)
    s=json.loads(pg.evaluate("localStorage.getItem('personal-io:v1')")); print('1 trashed:', [t['status'] for t in s['tasks'] if t['id']=='t2'], '| toast:', pg.inner_text('#toasts'))
    pg.click('#toasts [data-action="untrash-task"]'); pg.wait_for_timeout(100)
    s=json.loads(pg.evaluate("localStorage.getItem('personal-io:v1')")); print('1 undo:', [t['status'] for t in s['tasks'] if t['id']=='t2'])
    # drag Pay rent into today
    pg.drag_and_drop('[data-task-drag="t2"]', '.col-day'); pg.wait_for_timeout(200)
    s=json.loads(pg.evaluate("localStorage.getItem('personal-io:v1')")); print('8 dragged into today:', s['days'].get(TODAY,{}).get('taskIds'))
    # caps: 3rd both
    pg.click('[data-action="new-task"]:visible >> nth=0'); pg.wait_for_selector('form[data-form="task"]')
    pg.fill('#f-title','Write memo'); pg.wait_for_timeout(100)
    print('5 auto steps:', [pg.input_value(f'#f-step{i}') for i in range(3)])
    pg.click('[data-group="computer"] [data-value="no"]'); print('5 away steps:', pg.input_value('#f-step0'))
    pg.click('[data-group="computer"] [data-value="yes"]')
    pg.click('[data-group="important"] [data-value="yes"]')  # v2.0: no levels to pick and no "full" errors
    # drag on side calendar 10:00 to 11:30
    grid=pg.locator('#side-cal .grid'); bb=grid.bounding_box(); px=28
    y=lambda mins: bb['y']+(mins-7*60)/60*px
    pg.mouse.move(bb['x']+bb['width']-20, y(10*60)+2); pg.mouse.down(); pg.mouse.move(bb['x']+bb['width']-20, y(11*60+30), steps=5); pg.mouse.up(); pg.wait_for_timeout(150)
    print('7 picked:', pg.input_value('#f-date'), pg.input_value('[name=fixedTime_h]'), pg.input_value('[name=fixedTime_m]'), pg.input_value('[name=fixedTime_ap]'), 'min', pg.input_value('#f-minutes'), '| draft on cal:', pg.locator('#side-cal .ev-draft').count())
    pg.screenshot(path=OUT+'/v16_form.png')
    pg.click('[data-action="side-cal-move"][data-step="1"]'); print('6 side day ->', pg.inner_text('#side-cal-title'), pg.get_attribute('#side-cal','data-day'))
    # save and copy
    pg.click('[data-action="copy-task"]'); pg.wait_for_timeout(200)
    print('9 copy title:', pg.input_value('#f-title'), '| fixed time cleared:', repr(pg.input_value('[name=fixedTime_h]')), '| minutes', pg.input_value('#f-minutes'))
    pg.click('form[data-form="task"] [data-action="close-modal"]')
    # calendar popup has 4 choices
    pg.click('#cal-plan .ev:has-text("Workshop")'); print('4 popup buttons:', pg.locator('[data-action="cal-prioritize"]').count()); pg.click('[data-form="calitem"] [data-action="close-modal"]')
    # settings key
    pg.click('[data-action="open-settings"]'); pg.fill('#s-key','hello'); pg.click('form[data-form="settings"] button[type=submit]')
    print('11 bad key:', pg.inner_text('form .errors')[:120].replace('\n',' '))
    pg.fill('#s-key','sk-ant-api03-abcdefghijklmnopqrstuvwxyz'); pg.click('[data-action="test-key"]'); pg.wait_for_timeout(300)
    print('11 test key:', pg.inner_text('.key-status')); pg.click('form[data-form="settings"] button[type=submit]'); pg.wait_for_timeout(100)
    # email scan
    pg.click('[data-action="open-email"]'); pg.click('[data-action="email-scan"]'); pg.wait_for_selector('[data-form="talk-review"]', timeout=5000)
    print('13 email review:', pg.inner_text('[data-form="talk-review"]').replace('\n',' | ')[:220])
    pg.click('.talk-row [data-talk="pick"]'); pg.click('[data-action="talk-add"]'); pg.wait_for_timeout(100)
    s=json.loads(pg.evaluate("localStorage.getItem('personal-io:v1')")); print('13 email task added:', [t['title'] for t in s['tasks'] if t.get('source')=='email'])
    # paste
    pg.click('[data-action="open-email"]'); pg.fill('#paste-text','- Reply to Andre\n2. Book flights\nPay rent'); pg.click('[data-action="email-paste"]')
    print('13 paste review:', pg.inner_text('[data-form="talk-review"]').replace('\n',' | ')[:200]); pg.click('[data-action="talk-skip"]')
    # starter from Today
    pg.goto(BASE+'#today'); pg.wait_for_timeout(300)
    print('5 start buttons on Today:', pg.locator('[data-action="start-task"]').count())
    pg.click('[data-action="start-task"][data-id="t2"]'); pg.wait_for_selector('[data-form="starter"]')
    print('5 starter 1:', pg.inner_text('[data-form="starter"]').replace('\n',' | ')[:160])
    pg.screenshot(path=OUT+'/v16_starter.png')
    for i in range(3): pg.click('[data-action="starter-next"]')
    print('5 starter end:', pg.inner_text('[data-form="starter"]').replace('\n',' | ')[:200])
    pg.click('[data-action="starter-close"]')
print('PAGE ERRORS', errors)
