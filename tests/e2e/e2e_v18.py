import os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
os.makedirs(OUT, exist_ok=True)
import json, datetime
from playwright.sync_api import sync_playwright
D='2026-10-31'
st={"version":1,"settings":{},"goals":[{"id":"vc","title":"Get a VC job","why":"y"},{"id":"life","title":"Keep life running","why":"x"}],
 "tasks":[
  {"id":"a","title":"Pitch deck","goalId":"vc","priority":"important","deadline":"2026-11-08","minutes":60,"place":"everywhere","status":"open","createdAt":"2026-10-30T10:00:00Z"},
  {"id":"b","title":"Read a book","goalId":"life","priority":"nice","deadline":"","minutes":30,"place":"everywhere","status":"open","createdAt":"2026-10-30T10:00:00Z"},
  {"id":"c","title":"Pay rent","goalId":"life","priority":"important","deadline":"2026-11-01","minutes":15,"place":"everywhere","status":"open","createdAt":"2026-10-30T10:00:00Z"},
  {"id":"x1","title":"Both one","goalId":"vc","priority":"both","deadline":D,"minutes":30,"place":"everywhere","status":"open","createdAt":"2026-10-30T10:00:00Z"},
  {"id":"x2","title":"Both two","goalId":"vc","priority":"both","deadline":D,"minutes":30,"place":"everywhere","status":"open","createdAt":"2026-10-30T10:00:00Z"}],
 "events":[],"days":{},"log":[],"journal":[],"returns":[],"lastOpenDate":D}
HANG="""window.google={accounts:{oauth2:{initTokenClient:(o)=>({requestAccessToken:()=>{}})}}};"""
errs=[]
with sync_playwright() as p:
    ctx=p.chromium.launch().new_context(viewport={'width':1400,'height':1000})
    ctx.add_init_script(f"if(!sessionStorage.getItem('s')){{localStorage.setItem('personal-io:v1', {json.dumps(json.dumps(st))});localStorage.setItem('personal-io:google-client-id','1-a.apps.googleusercontent.com');sessionStorage.setItem('s','1')}}")
    pg=ctx.new_page(); pg.clock.install(time=datetime.datetime(2026,10,31,9,0)); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route('https://accounts.google.com/gsi/client', lambda r: r.fulfill(status=200, content_type='text/javascript', body=HANG))
    pg.goto('http://localhost:8765/#start'); pg.wait_for_selector('.col-backlog')
    print('promotion blocked buttons:', pg.inner_text('.item:has-text("Pay rent") .chip-warn') if pg.locator('.item:has-text("Pay rent") .chip-warn').count() else 'none', '|', pg.locator('.item:has-text("Pay rent") [data-action="demote-task"]').count())
    pg.click('.group-toggle[data-group-name="important"]'); pg.click('.group-toggle[data-group-name="nice"]')
    print('promotion blocked buttons:', pg.locator('.item:has-text("Pay rent") [data-action="demote-task"]').count(), pg.locator('.item:has-text("Pay rent") [data-action="edit-task"]').count())
    # drag Read a book (later) -> important: needs a deadline -> error toast
    pg.drag_and_drop('[data-task-drag="b"]', '[data-drop-priority="important"]'); pg.wait_for_timeout(150)
    print('later->important:', pg.inner_text('#toasts').replace('\n',' | ')[:120])
    # drag Pitch deck (due Nov 8) -> urgent: blocked by date rule
    pg.drag_and_drop('[data-task-drag="a"]', '[data-drop-priority="urgent"]'); pg.wait_for_timeout(150)
    print('important->urgent far deadline:', pg.inner_text('#toasts').split('\n')[-2][:100])
    # drag Pitch deck -> later: ok
    pg.drag_and_drop('[data-task-drag="a"]', '[data-drop-priority="nice"]'); pg.wait_for_timeout(150)
    s=json.loads(pg.evaluate("localStorage.getItem('personal-io:v1')")); print('important->later:', [t['priority'] for t in s['tasks'] if t['id']=='a'])
    # still drag into the day
    pg.drag_and_drop('[data-task-drag="x1"]', '.col-day'); pg.wait_for_timeout(200)
    s=json.loads(pg.evaluate("localStorage.getItem('personal-io:v1')")); print('into day:', s['days'][D]['taskIds'])
    # Set plan while the Google window never answers
    pg.click('[data-action="set-plan"]'); pg.wait_for_timeout(300)
    s=json.loads(pg.evaluate("localStorage.getItem('personal-io:v1')")); print('set immediately:', s['days'][D]['set'], '| hash', pg.evaluate('location.hash'))
    pg.clock.run_for(125000); pg.wait_for_timeout(200)
    print('after timeout toast:', pg.inner_text('#toasts').replace('\n',' | ')[-120:])
    pg.goto('http://localhost:8765/#start'); pg.wait_for_timeout(200)
    if pg.locator('[data-form="starter"]').count(): print('start screen opened by itself at the task time'); pg.click('[data-action="starter-close"]')
    print('plan footer:', pg.inner_text('.col-day .note')[:80].replace('\n',' '))
    # new task form: deadline label
    pg.click('[data-action="new-task"]:visible >> nth=0'); pg.click('[data-group="priority"] [data-value="nice"]'); print('label:', pg.inner_text('#f-deadline-label')); pg.click('form [data-action="close-modal"]')
    # picture
    pg.click('[data-action="open-settings"]'); pg.set_input_files('#s-pic',OUT+'/pic.jpg'); pg.wait_for_timeout(500)
    print('pic saved:', len(pg.evaluate("localStorage.getItem('personal-io:start-pic')") or ''), 'chars')
    pg.click('form[data-form="settings"] [data-action="close-modal"]')
    pg.goto('http://localhost:8765/#today'); pg.wait_for_timeout(200); pg.click('[data-action="start-task"]'); pg.wait_for_timeout(200)
    print('starter uses picture:', pg.locator('[data-form="starter"] img.cat-photo').count())
    pg.screenshot(path=OUT+'/v18_starter.png')
print('errors', errs)
