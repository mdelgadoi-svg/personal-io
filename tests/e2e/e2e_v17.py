import os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
os.makedirs(OUT, exist_ok=True)
import json, datetime
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright
BASE='http://localhost:8765/'
D='2026-11-04'
state={"version":1,"settings":{},"goals":[{"id":"life","title":"Keep life running","why":"x"},{"id":"vc","title":"Get a VC job","why":"y"}],
 "tasks":[
  {"id":"s1","title":"Study for the ETA class","goalId":"vc","priority":"important","deadline":"2026-11-06","minutes":90,"place":"everywhere","status":"open","createdAt":"2026-11-01T10:00:00Z"},
  {"id":"s2","title":"Email Julia","goalId":"vc","priority":"urgent","deadline":"2026-11-05","minutes":30,"place":"everywhere","status":"open","createdAt":"2026-11-01T10:00:00Z"}],
 "events":[],"days":{},"log":[],"journal":[],"returns":[],"lastOpenDate":D,"lastDailyCheck":D}
GIS="""window.google={accounts:{oauth2:{initTokenClient:(o)=>({requestAccessToken:()=>setTimeout(()=>o.callback({access_token:'tok',expires_in:3600}),10)})}}};"""
def ev(id,t,a,b,color=None,day=D):
    e={"id":id,"summary":t,"start":{"dateTime":f"{day}T{a}:00-08:00"},"end":{"dateTime":f"{day}T{b}:00-08:00"}}
    if color: e["colorId"]=color
    return e
def gcal(route):
    r=route.request
    if r.method!='GET': route.fulfill(status=200, content_type='application/json', body=json.dumps({"id":"new"}), headers={'access-control-allow-origin':'*'}); return
    q=parse_qs(urlparse(r.url).query); tmin=q.get('timeMin',[''])[0]
    items=[]
    if tmin.startswith('2026-11-04'):
        items=[ev('a','Café + arranque','07:15','08:00','10'), ev('b','Immigration Info Session','12:00','13:30'), ev('c','Independent Study','12:30','14:30'),
               ev('d','Financiamiento 3/3','14:00','15:00','10'), ev('e','Llamada con Irina','20:00','21:00','10'),
               {"id":"m","summary":"Spring 2027 Bidding Round 1 Opens (2Y)","start":{"dateTime":"2026-11-03T09:00:00-08:00"},"end":{"dateTime":"2026-11-05T17:30:00-08:00"}},
               {"id":"z","summary":"10b - Best Stuff On Earth Feedback","start":{"date":"2026-11-04"},"end":{"date":"2026-11-05"}}]
    route.fulfill(status=200, content_type='application/json', body=json.dumps({"summary":"mdelgadoe@berkeley.edu","items":items}), headers={'access-control-allow-origin':'*'})
errors=[]
with sync_playwright() as p:
    ctx=p.chromium.launch().new_context(viewport={'width':1400,'height':1100})
    ctx.add_init_script(f"if(!sessionStorage.getItem('seeded')){{localStorage.setItem('personal-io:v1', {json.dumps(json.dumps(state))});localStorage.setItem('personal-io:google-client-id','123-abc.apps.googleusercontent.com');sessionStorage.setItem('seeded','1')}}")
    pg=ctx.new_page(); pg.clock.set_fixed_time(datetime.datetime(2026,11,4,15,0))
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.route('https://accounts.google.com/gsi/client', lambda r: r.fulfill(status=200, content_type='text/javascript', body=GIS))
    pg.route('https://www.googleapis.com/**', gcal)
    pg.goto(BASE+'#start'); pg.wait_for_selector('.col-day')
    print('default day today at 3 PM:', pg.get_attribute('[data-day="today"][data-action="plan-day"]','aria-pressed'))
    pg.click('#cal-plan [data-action="connect-google"]'); pg.wait_for_timeout(800)
    print('all-day line:', pg.inner_text('#cal-plan .all-day') if pg.locator('#cal-plan .all-day').count() else None)
    tall=[ (pg.inner_text(f'#cal-plan .ev >> nth={i}')[:25].replace('\n',' '), pg.get_attribute(f'#cal-plan .ev >> nth={i}','style')) for i in range(pg.locator('#cal-plan .ev').count())]
    for t,st in tall: print('  ev:', t, '|', 'left:calc' in st and st.split('left:')[1].split(';')[0] or 'full width')
    pg.click('.group-toggle[data-group-name="important"]')
    pg.click('[data-action="add-to-day"][data-id="s1"]'); pg.wait_for_timeout(150)
    pg.click('[data-action="add-to-day"][data-id="s2"]'); pg.wait_for_timeout(150)
    rows=lambda: [pg.inner_text(f'.col-day .plan-row >> nth={i}').split('\n')[:3] for i in range(pg.locator('.col-day .plan-row').count())]
    print('after adding:', rows())
    print('calendar section:', pg.inner_text('.cal-suggest').replace('\n',' | ')[:200])
    pg.click('.cal-suggest .busy-row:has-text("Irina") [data-action="busy-prio"]'); pg.wait_for_timeout(150)
    print('after Irina:', rows())
    pg.screenshot(path=OUT+'/v17_plan.png')
    # drag Study 1 hour later on the calendar
    blk=pg.locator('#cal-plan .ev[data-move="s1"]'); bb=blk.bounding_box()
    pg.mouse.move(bb['x']+20, bb['y']+8); pg.mouse.down(); pg.mouse.move(bb['x']+20, bb['y']+8+28, steps=6); pg.mouse.up(); pg.wait_for_timeout(200)
    print('after drag:', rows(), '| overlap note:', pg.locator('.plan-row[data-id="s1"] .due-soon').count())
    # change Email to 6 PM, 45 min
    pg.click('[data-action="edit-time"][data-id="s2"]')
    pg.select_option('[name="start-s2_h"]','6'); pg.wait_for_timeout(100); pg.select_option('[name="start-s2_m"]','00'); pg.wait_for_timeout(100); pg.select_option('[name="start-s2_ap"]','PM'); pg.wait_for_timeout(100)
    pg.click('[data-action="edit-time"][data-id="s2"]'); pg.wait_for_timeout(150)
    pg.click('[data-action="edit-time"][data-id="s2"]'); pg.select_option('#len-s2','45'); pg.wait_for_timeout(150)
    print('after picker:', rows())
    pg.click('[data-action="set-plan"]'); pg.wait_for_timeout(500)
    pg.click('[data-action="set-plan"]', no_wait_after=True) if pg.locator('[data-action="set-plan"]').count() else None
    print('hash after set:', pg.evaluate('location.hash'))
    items=[pg.inner_text(f'.cols .card.list .item >> nth={i}').split('\n')[:3] for i in range(pg.locator('.cols .card.list .item').count())]
    print('Today:', items)
    print('now card:', pg.inner_text('.note, .now-card')[:100] if pg.locator('.now-card, .note').count() else None)
    pg.screenshot(path=OUT+'/v17_today.png')
    # moving after set -> update button
    pg.goto(BASE+'#start'); pg.wait_for_timeout(300)
    if not pg.locator('[name="start-s2_h"]').count(): pg.click('[data-action="edit-time"][data-id="s2"]')
    pg.select_option('[name="start-s2_h"]','7'); pg.click('[data-action="edit-time"][data-id="s2"]'); pg.wait_for_timeout(150)
    print('after change once set:', pg.inner_text('.col-day .note')[:80])
    # tap a task on the calendar -> small time window
    pg.click('#cal-plan .ev[data-move="s1"]'); pg.wait_for_timeout(150)
    print('tap window:', pg.locator('form[data-form="time"]').count(), pg.inner_text('#modal-title'))
    pg.select_option('#tf-start','5'); pg.select_option('#tf-start-ap','PM'); pg.click('form[data-form="time"] button[type=submit]'); pg.wait_for_timeout(150)
    print('after tap window:', rows())
    # phone Today
    pg.set_viewport_size({'width':390,'height':844}); pg.goto(BASE+'#today'); pg.wait_for_timeout(300)
    r=pg.locator('.col-day .plan-row').first  # v2.1: today's tasks are in the Plan part of the main screen
    print('phone Today title width:', round(r.locator('.plan-body').bounding_box()['width']), '| buttons right edge:', round(r.bounding_box()['x']+r.bounding_box()['width']))
    pg.screenshot(path=OUT+'/v17_phone_today.png', full_page=False)
    pg.click('[data-action="pane"][data-pane="cal"]'); pg.wait_for_timeout(300); print('phone plan calendar visible:', pg.locator('#cal-plan').is_visible())
print('PAGE ERRORS', errors)
