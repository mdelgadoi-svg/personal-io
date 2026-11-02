import os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
os.makedirs(OUT, exist_ok=True)
import json, datetime
from playwright.sync_api import sync_playwright
D='2026-11-04'
st={"version":1,"settings":{},"goals":[{"id":"vc","title":"Get a VC job","why":"y"},{"id":"life","title":"Keep life running","why":"x"}],
 "tasks":[{"id":"s1","title":"Study for the ETA class","goalId":"vc","priority":"important","deadline":"2026-11-06","minutes":90,"place":"everywhere","status":"open","createdAt":"2026-11-01T10:00:00Z"}],
 "events":[],"days":{},"log":[],"journal":[],"returns":[],"lastOpenDate":D,"lastDailyCheck":D}
with sync_playwright() as p:
    ctx=p.chromium.launch().new_context(viewport={'width':1400,'height':1000})
    ctx.add_init_script(f"if(!sessionStorage.getItem('s')){{localStorage.setItem('personal-io:v1', {json.dumps(json.dumps(st))});sessionStorage.setItem('s','1')}}")
    pg=ctx.new_page(); pg.clock.set_fixed_time(datetime.datetime(2026,11,4,9,0)); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8765/#start'); pg.click('.group-toggle[data-group-name="important"]'); pg.click('[data-action="add-to-day"][data-id="s1"]'); pg.wait_for_timeout(200)
    pg.click('[data-action="edit-time"][data-id="s1"]'); pg.select_option('[name="start-s1_h"]','2'); pg.select_option('[name="start-s1_ap"]','PM'); pg.select_option('#len-s1','60'); pg.wait_for_timeout(150)
    pg.click('[data-action="edit-time"][data-id="s1"]'); pg.wait_for_timeout(150)
    print('row:', pg.inner_text('.plan-row').split('\n')[:3])
    pg.click('[data-action="set-plan"]'); pg.wait_for_timeout(300); pg.goto('http://localhost:8765/#start'); pg.wait_for_timeout(200)
    pg.click('[data-action="remove-from-day"]'); pg.wait_for_timeout(150)
    print('footer:', pg.inner_text('.col-day').split('\n')[-2:] )
    print('errors', errs)
