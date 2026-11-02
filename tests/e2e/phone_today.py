import os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
os.makedirs(OUT, exist_ok=True)
import json, datetime
from playwright.sync_api import sync_playwright
D='2026-11-04'
st={"version":1,"settings":{},"goals":[{"id":"vc","title":"Get a VC job","why":"y"},{"id":"life","title":"Keep life running","why":"x"}],
 "tasks":[{"id":"s1","title":"Study for the ETA class","goalId":"vc","priority":"important","deadline":"2026-11-06","minutes":90,"place":"everywhere","status":"open","createdAt":"2026-11-01T10:00:00Z"},
          {"id":"s2","title":"Email Julia","goalId":"vc","priority":"urgent","deadline":"2026-11-05","minutes":30,"place":"everywhere","status":"open","createdAt":"2026-11-01T10:00:00Z"}],
 "events":[],"days":{D:{"intention":"","taskIds":["s1","s2"],"slots":3,"set":True,"reviewed":{"0":True},"googleIds":[],
   "plan":{"blocks":[{"start":"09:00","minutes":120,"taskIds":["s1","s2"],"color":"blue"}],"events":[],"needsTime":[],"didNotFit":[]}}},
 "log":[],"journal":[],"returns":[],"lastOpenDate":D,"lastDailyCheck":D}
with sync_playwright() as p:
    ctx=p.chromium.launch().new_context(viewport={'width':390,'height':844}, has_touch=True, is_mobile=True)
    ctx.add_init_script(f"localStorage.setItem('personal-io:v1', {json.dumps(json.dumps(st))})")
    pg=ctx.new_page(); pg.clock.set_fixed_time(datetime.datetime(2026,11,4,15,0)); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8765/#today'); pg.wait_for_timeout(400)
    r=pg.locator('.cols .card.list .item').first; r.scroll_into_view_if_needed()
    print('title width', round(r.locator('.item-main').bounding_box()['width']), '| actions right', round(r.locator('.item-actions').bounding_box()['x']+r.locator('.item-actions').bounding_box()['width']))
    s=json.loads(pg.evaluate("localStorage.getItem('personal-io:v1')"))
    print('migrated times', s['days'][D].get('times'), '| reviewed kept', s['days'][D].get('reviewed'))
    print('how-did-it-go buttons (should be 0, already reviewed):', pg.locator('[data-action="review"]').count())
    print('now pill:', pg.inner_text('#now-pill') or '(none)')
    r.screenshot(path=OUT+'/phone_row.png')
    print('errors', errs)
