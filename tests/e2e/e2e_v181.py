import os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
os.makedirs(OUT, exist_ok=True)
import json, datetime, time
from playwright.sync_api import sync_playwright
D='2026-10-31'
st={"version":1,"settings":{},"goals":[{"id":"life","title":"Keep life running","why":"x"}],
 "tasks":[{"id":"u","title":"Pay rent","goalId":"life","priority":"urgent","deadline":"2026-11-10","minutes":15,"place":"everywhere","status":"open","createdAt":"2026-10-30T10:00:00Z"}],
 "events":[],"days":{},"log":[],"journal":[],"returns":[],"lastOpenDate":D,"lastDailyCheck":D}
GIS="""window.google={accounts:{oauth2:{initTokenClient:(o)=>({requestAccessToken:()=>setTimeout(()=>o.callback({access_token:'t',expires_in:3600}),10)})}}};"""
posts=[]
def gcal(route):
    r=route.request
    if r.method=='POST': posts.append(1); time.sleep(1.5)
    route.fulfill(status=200, content_type='application/json', body=json.dumps({"id":f"ev{len(posts)}","items":[],"summary":"me"}), headers={'access-control-allow-origin':'*'})
errs=[]
with sync_playwright() as p:
    ctx=p.chromium.launch().new_context(viewport={'width':390,'height':844})
    ctx.add_init_script(f"if(!sessionStorage.getItem('s')){{localStorage.setItem('personal-io:v1', {json.dumps(json.dumps(st))});localStorage.setItem('personal-io:google-client-id','1-a.apps.googleusercontent.com');sessionStorage.setItem('s','1')}}")
    pg=ctx.new_page(); pg.clock.set_fixed_time(datetime.datetime(2026,10,31,9,0)); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route('https://accounts.google.com/gsi/client', lambda r: r.fulfill(status=200, content_type='text/javascript', body=GIS))
    pg.route('https://www.googleapis.com/**', gcal)
    pg.goto('http://localhost:8765/#start'); pg.wait_for_selector('.main-cols')
    pg.click('[data-action="pane"][data-pane="todo"]'); pg.wait_for_timeout(100)  # v2.1: on the phone, To-do is one of three parts
    # v2.0: an old ! task with a far deadline is now "later" (not important, not due soon), never blocked
    pg.click('.group-toggle[data-group-name="nice"]'); pg.wait_for_timeout(100)
    print('old ! task is later now:', pg.locator('.group-nice .item:has-text("Pay rent")').count())
    pg.click('.item:has-text("Pay rent") [data-action="edit-task"]'); pg.fill('#f-title','Pay rent Nov'); pg.click('form[data-form="task"] button[type=submit]'); pg.wait_for_timeout(150)
    s=json.loads(pg.evaluate("localStorage.getItem('personal-io:v1')")); print('rename ok:', s['tasks'][0]['title'])
    pg.screenshot(path=OUT+'/v181_phone_chip.png')
    pg.click('[data-action="add-to-day"][data-id="u"]'); pg.wait_for_timeout(200)
    pg.click('[data-action="pane"][data-pane="day"]'); pg.wait_for_timeout(100)
    pg.click('.col-day [data-action="set-plan"]'); pg.wait_for_timeout(500)
    pg.goto('http://localhost:8765/#start') if False else None
    print('during write (Today page has no footer); waiting...'); pg.wait_for_timeout(2500)
    s=json.loads(pg.evaluate("localStorage.getItem('personal-io:v1')")); d=s['days'][D]; print('after write: set', d['set'], 'pending', d.get('googlePending'), 'ids', d['googleIds'], 'posts', len(posts))
    pg.click('[data-action="open-settings"]'); pg.fill('#s-commute','45'); pg.set_input_files('#s-pic',OUT+'/pic.jpg'); pg.wait_for_timeout(500)
    print('commute kept after picture:', pg.input_value('#s-commute'), '| preview:', pg.locator('.pic-preview').count())
print('errors', errs)
