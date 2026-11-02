import os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
os.makedirs(OUT, exist_ok=True)
import json, datetime
from playwright.sync_api import sync_playwright
st={"version":1,"settings":{},"goals":[{"id":"life","title":"Keep life running","why":"x"}],"tasks":[],"events":[],"days":{},"log":[],"journal":[],"returns":[],"lastOpenDate":"2026-10-31","lastDailyCheck":"2026-10-31"}
errs=[]
with sync_playwright() as p:
    for touch in (True, False):
        ctx=p.chromium.launch().new_context(viewport={'width':390,'height':844} if touch else {'width':1400,'height':1000}, has_touch=touch, is_mobile=touch)
        ctx.add_init_script(f"localStorage.setItem('personal-io:v1', {json.dumps(json.dumps(st))})")
        pg=ctx.new_page(); pg.clock.set_fixed_time(datetime.datetime(2026,10,31,7,30)); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto('http://localhost:8765/#start'); pg.click('.col-backlog [data-action="new-task"]'); pg.wait_for_selector('#side-cal .grid')
        pg.fill('#f-title','Gym'); pg.fill('#f-minutes','45')
        g=pg.locator('#side-cal .grid'); g.scroll_into_view_if_needed(); bb=g.bounding_box()
        x=bb['x']+bb['width']-15; y=bb['y']+(14*60-7*60)/60*28+2
        if touch: pg.touchscreen.tap(x,y)
        else: pg.mouse.click(x,y)
        pg.wait_for_timeout(150)
        print('touch' if touch else 'mouse', '| hint:', pg.inner_text('.side-hint'), '| time:', pg.input_value('[name=fixedTime_h]') or '-', pg.input_value('[name=fixedTime_ap]'), '| min', pg.input_value('#f-minutes'))
print('errors', errs)
