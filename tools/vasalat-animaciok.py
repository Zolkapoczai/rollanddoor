# A vasalattípus-ablakok 5. diája: technológiai animáció (SVG + CSS), a /technologia dupla sínes rajzának stílusában.
# Menete: közeli metszet épül fel → kizoomol a teljes elölnézetre (a metszet kis ablakba húzódik) → az ajtó kinyílik és visszacsúszik.
# Futtatás:  python tools/vasalat-animaciok.py   →   public/img/vasalat/<vasalat>-animacio.svg
# Szemléltető rajzok, nem méretarányosak; konkrét méretet, terhelést nem állítanak.
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "img", "vasalat")
HOSSZ = 15  # mp; a landing.js ennyi ideig mutatja az animációs diát

CSS = """
.va-lbl{font:500 22px var(--font-primary,'Inter',sans-serif);fill:#d0d0d0;paint-order:stroke;stroke:#161616;stroke-width:5px;stroke-linejoin:round}
.va-lbl2{font:500 17px var(--font-primary,'Inter',sans-serif);fill:#d0d0d0;paint-order:stroke;stroke:#161616;stroke-width:4px;stroke-linejoin:round}
.va-cap{font:600 25px var(--font-display,'Outfit',sans-serif);fill:#f5f5f5;text-anchor:middle}
.va-tb{font:600 13px var(--font-display,'Outfit',sans-serif);fill:#e5e5e5;letter-spacing:.06em}
.va-tb2{font:400 12px var(--font-primary,'Inter',sans-serif);fill:#a0a0a0}
.va-in{animation:va-in .6s both}
.va-dr{stroke-dasharray:1;stroke-dashoffset:1;animation:va-draw 1s both ease-in-out}
.va-drop{animation:va-drop .7s both cubic-bezier(.3,1.4,.6,1)}
.va-det{animation:va-zoom 1.4s 6.2s both cubic-bezier(.6,0,.3,1)}
.va-detlbl{animation:va-in .5s both,va-out .4s 5.8s forwards}
.va-elev{animation:va-in .8s 6.9s both}
.va-elevlbl{animation:va-in .6s 8s both}
.va-slide{animation:va-slide 5.4s 8.6s both ease-in-out}
.va-spin{transform-box:fill-box;transform-origin:center;animation:va-spin 5.4s 8.6s both ease-in-out}
.va-c1{animation:va-cap 5.6s .2s both}.va-c2{animation:va-cap 4.4s 6.2s both}.va-c3{animation:va-cap-last .6s 10.8s both}
@keyframes va-in{from{opacity:0}to{opacity:1}}
@keyframes va-out{to{opacity:0}}
@keyframes va-draw{to{stroke-dashoffset:0}}
@keyframes va-drop{from{opacity:0;transform:translateY(-40px)}to{opacity:1;transform:none}}
@keyframes va-zoom{to{transform:translate(14px,14px) scale(.24)}}
@keyframes va-slide{0%{transform:none}38%{transform:translateX(-SLIDEpx)}62%{transform:translateX(-SLIDEpx)}100%{transform:none}}
@keyframes va-spin{0%{transform:none}38%{transform:rotate(-SPINdeg)}62%{transform:rotate(-SPINdeg)}100%{transform:none}}
@keyframes va-cap{0%{opacity:0;transform:translateY(6px)}10%{opacity:1;transform:none}88%{opacity:1}100%{opacity:0}}
@keyframes va-cap-last{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){*{animation-delay:0s!important;animation-duration:1ms!important}}
"""

DEFS = """
<pattern id="va-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="rgba(255,255,255,0.045)"/></pattern>
<pattern id="va-hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="10" fill="#2a2826"/><path d="M0 0V10" stroke="#5a5650" stroke-width="2"/></pattern>
<linearGradient id="va-stV" x1="0" x2="1"><stop offset="0" stop-color="#5a5a5a"/><stop offset=".45" stop-color="#cfcfcf"/><stop offset="1" stop-color="#4a4a4a"/></linearGradient>
<linearGradient id="va-stH" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#5a5a5a"/><stop offset=".45" stop-color="#cfcfcf"/><stop offset="1" stop-color="#4a4a4a"/></linearGradient>
<linearGradient id="va-blk" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#3a3a3a"/><stop offset=".5" stop-color="#1c1c1c"/><stop offset="1" stop-color="#0e0e0e"/></linearGradient>
<pattern id="va-wood" width="44" height="80" patternUnits="userSpaceOnUse"><rect width="44" height="80" fill="#8a5d36"/><path d="M7 0Q10 40 7 80M18 0Q15 26 19 52T18 80M30 0Q33 34 29 80M39 0Q37 40 40 80" fill="none" stroke="#6e4728" stroke-width="1.3"/></pattern>
<radialGradient id="va-disc"><stop offset="0" stop-color="#6a6a6a"/><stop offset="1" stop-color="#262626"/></radialGradient>
<marker id="va-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#d4a373"/></marker>
<linearGradient id="va-shadow" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="rgba(0,0,0,.55)"/><stop offset="1" stop-color="rgba(0,0,0,0)"/></linearGradient>
"""


def lbl(x1, y1, x2, y2, tx, ty, text, anchor="start", d=0.0):
    return (f'<g class="va-detlbl" style="animation-delay:{d}s,5.8s"><path d="M{x1} {y1}L{x2} {y2}" stroke="#8a8a8a" stroke-width="1.4"/>'
            f'<text x="{tx}" y="{ty}" class="va-lbl" text-anchor="{anchor}">{text}</text></g>')


def inn(body, d, cls="va-in"):
    delay = f"{d}s,5.8s" if cls == "va-detlbl" else f"{d}s"
    return f'<g class="{cls}" style="animation-delay:{delay}">{body}</g>'


def draw(dpath, d, stroke="#b0b0b0", w=2.2, extra=""):
    return f'<path class="va-dr" pathLength="1" style="animation-delay:{d}s" d="{dpath}" fill="none" stroke="{stroke}" stroke-width="{w}" {extra}/>'


# ---------- Elölnézet (közös) ----------
FLOOR = 592
OPEN_X0, OPEN_X1, OPEN_TOP = 362, 538, 214
DOOR = (350, 196, 200, 392)  # x, y, w, h (zárt állapot, a nyílás előtt)
SLIDE = 212


def elev_base(ceiling=104):
    return (f'<rect x="20" y="{ceiling}" width="560" height="{FLOOR - ceiling}" fill="rgba(255,255,255,0.03)"/>'
            f'<path d="M20 {ceiling}H580" stroke="#6a6a6a" stroke-width="1.5"/>'
            f'<rect x="20" y="{FLOOR}" width="560" height="10" fill="url(#va-hatch)"/><path d="M20 {FLOOR}H580" stroke="#b0b0b0" stroke-width="1.8"/>'
            # nyílás: mögötte a szomszéd szoba
            f'<rect x="{OPEN_X0}" y="{OPEN_TOP}" width="{OPEN_X1 - OPEN_X0}" height="{FLOOR - OPEN_TOP}" fill="#0b0b0b"/>'
            f'<path d="M{OPEN_X0} {FLOOR}V{OPEN_TOP}H{OPEN_X1}V{FLOOR}" fill="none" stroke="#7a7a7a" stroke-width="1.5"/>'
            f'<rect x="{OPEN_X0 + 40}" y="{OPEN_TOP + 70}" width="70" height="110" fill="#1d2a22" stroke="#33463a"/>')


def door_slab(x, y, w, h, handle_side="left", panels=True):
    hx = x + 16 if handle_side == "left" else x + w - 30
    s = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="2" fill="url(#va-wood)" stroke="#d9c3a5" stroke-width="1.8"/>'
    if panels:
        s += (f'<rect x="{x + 28}" y="{y + 40}" width="{w - 56}" height="{h * .4:.0f}" rx="2" fill="none" stroke="#4a2e18" stroke-width="2.2"/>'
              f'<rect x="{x + 28}" y="{y + 60 + h * .4:.0f}" width="{w - 56}" height="{h * .4:.0f}" rx="2" fill="none" stroke="#4a2e18" stroke-width="2.2"/>')
    s += f'<rect x="{hx}" y="{y + h * .48:.0f}" width="14" height="66" rx="4" fill="url(#va-stV)" stroke="#9a9a9a"/>'
    return s


def wheel_front(cx, cy, r=15):
    return (f'<g class="va-spin"><circle cx="{cx}" cy="{cy}" r="{r}" fill="url(#va-disc)" stroke="#9a9a9a" stroke-width="1.4"/>'
            f'<circle cx="{cx}" cy="{cy}" r="{r * .3:.1f}" fill="#3a3a3a" stroke="#9a9a9a"/>'
            f'<path d="M{cx} {cy - r + 3}V{cy - r * .35:.1f}M{cx - r * .8:.1f} {cy + r * .45:.1f}L{cx - r * .3:.1f} {cy + r * .17:.1f}M{cx + r * .8:.1f} {cy + r * .45:.1f}L{cx + r * .3:.1f} {cy + r * .17:.1f}" stroke="#121212" stroke-width="3"/></g>')


# ---------- Típusonkénti rajzok ----------
def pajta():
    det = [
        inn('<rect x="60" y="30" width="90" height="560" fill="url(#va-hatch)"/><rect x="150" y="30" width="8" height="560" fill="#4d4a45"/>', 1.0),
        draw("M158 30V590M60 30V590", 0.3),
        inn('<rect x="158" y="230" width="14" height="120" rx="2" fill="url(#va-stV)"/>', 2.0),
        draw("M158 230H172V350H158Z", 1.8, "#d4a373"),
        inn('<rect x="172" y="278" width="36" height="24" rx="3" fill="url(#va-stH)"/><rect x="208" y="230" width="14" height="120" rx="2" fill="url(#va-stV)"/>'
            '<rect x="222" y="274" width="16" height="32" rx="4" fill="url(#va-stV)" stroke="#9a9a9a"/>', 2.6),
        draw("M208 230H222V350H208Z", 2.6, "#d4a373"),
        f'<g class="va-drop" style="animation-delay:3.4s"><rect x="205" y="138" width="20" height="92" rx="7" fill="url(#va-stV)" stroke="#b0b0b0" stroke-width="1.4"/>'
        f'<rect x="225" y="176" width="78" height="14" rx="3" fill="url(#va-stH)" stroke="#9a9a9a"/></g>',
        inn('<rect x="303" y="150" width="14" height="430" fill="url(#va-stV)" stroke="#b0b0b0"/>', 4.0),
        inn('<rect x="250" y="390" width="53" height="200" fill="url(#va-wood)" stroke="#d9c3a5" stroke-width="1.8"/>'
            '<rect x="176" y="362" width="127" height="14" rx="3" fill="url(#va-stH)" stroke="#9a9a9a"/>', 4.4),
        lbl(105, 40, 105, 40, 105, 24, "fal", "middle", .9),
        lbl(165, 345, 120, 420, 40, 445, "belső sín", "start", 2.3),
        lbl(190, 290, 330, 255, 336, 262, "távtartó", "start", 2.9),
        lbl(220, 150, 330, 110, 336, 112, "kerék a külső sínen", "start", 3.9),
        lbl(317, 300, 360, 320, 366, 328, "függesztő", "start", 4.3),
        lbl(250, 370, 360, 400, 366, 408, "kiugrásgátló", "start", 4.6),
        lbl(300, 520, 360, 520, 366, 528, "ajtólap", "start", 4.8),
    ]
    x, y, w, h = DOOR
    rail_y = y - 28
    elev = (elev_base() +
            f'<rect x="172" y="{rail_y - 9}" width="390" height="20" rx="3" fill="url(#va-blk)" stroke="#6a6a6a"/>'
            f'<g fill="#555"><circle cx="190" cy="{rail_y + 1}" r="3"/><circle cx="330" cy="{rail_y + 1}" r="3"/><circle cx="520" cy="{rail_y + 1}" r="3"/></g>'
            f'<g class="va-slide">{door_slab(x, y, w, h)}'
            f'<g fill="url(#va-blk)" stroke="#6a6a6a"><rect x="{x + 22}" y="{rail_y - 18}" width="16" height="96" rx="3"/><rect x="{x + w - 38}" y="{rail_y - 18}" width="16" height="96" rx="3"/></g>'
            f'{wheel_front(x + 30, rail_y - 18)}{wheel_front(x + w - 30, rail_y - 18)}</g>')
    elevlbl = '<path d="M470 160L490 132" stroke="#8a8a8a" stroke-width="1.2"/><text x="572" y="126" text-anchor="end" class="va-lbl2">látszó sín és görgők</text>'
    caps = ["Két sín, a kerék a külsőn fut.", "A vasalat látványelem lesz.", "Végiggördül, nem leng ki."]
    return det, elev, elevlbl, caps, 360 * SLIDE / (2 * 3.1416 * 15)


def rejtett():
    det = [
        inn('<rect x="20" y="40" width="560" height="120" fill="url(#va-hatch)"/>', 1.0),
        draw("M20 160H230M370 160H580", 0.3),
        # süllyesztett sínprofil (C-profil) a mennyezetben
        inn('<path d="M230 160V96H370V160H346V120H254V160Z" fill="url(#va-stH)" stroke="#d4a373" stroke-width="1.6"/>', 1.9),
        draw("M230 160V96H370V160", 1.6, "#d4a373"),
        # kocsi két csapágyazott görgővel
        f'<g class="va-drop" style="animation-delay:2.8s"><rect x="262" y="126" width="76" height="20" rx="4" fill="url(#va-stH)" stroke="#9a9a9a"/>'
        f'<circle cx="276" cy="134" r="10" fill="url(#va-disc)" stroke="#d0d0d0"/><circle cx="276" cy="134" r="4" fill="#d4a373"/>'
        f'<circle cx="324" cy="134" r="10" fill="url(#va-disc)" stroke="#d0d0d0"/><circle cx="324" cy="134" r="4" fill="#d4a373"/></g>',
        inn('<rect x="294" y="146" width="12" height="58" fill="url(#va-stV)" stroke="#9a9a9a"/>', 3.6),
        inn('<rect x="250" y="204" width="100" height="10" fill="url(#va-stH)" stroke="#9a9a9a"/>'
            '<rect x="262" y="214" width="76" height="376" fill="url(#va-wood)" stroke="#d9c3a5" stroke-width="1.8"/>', 4.2),
        lbl(300, 60, 300, 60, 300, 30, "mennyezet", "middle", .9),
        lbl(368, 110, 420, 86, 426, 92, "rejtett sínprofil", "start", 2.1),
        lbl(330, 136, 420, 150, 426, 158, "csapágyazott görgők", "start", 3.1),
        lbl(306, 180, 420, 214, 426, 222, "függesztőcsavar", "start", 3.8),
        lbl(338, 400, 420, 400, 426, 408, "ajtólap", "start", 4.5),
        lbl(232, 128, 150, 240, 40, 262, "a sín lehet a", "start", 2.4),
        inn('<text x="40" y="288" class="va-lbl">falba süllyesztve is</text>', 2.4, "va-detlbl"),
    ]
    x, y, w, h = DOOR
    elev = (elev_base(ceiling=180) +
            f'<rect x="100" y="172" width="460" height="8" fill="none" stroke="#d4a373" stroke-width="1.2" stroke-dasharray="6 4"/>'
            f'<g class="va-slide">{door_slab(x, y - 12, w, h + 12)}</g>')
    elevlbl = '<path d="M300 172L300 150" stroke="#8a8a8a" stroke-width="1.2"/><text x="190" y="144" class="va-lbl2">sín a mennyezetben</text>'
    caps = ["A sín elbújik, a görgők halkan futnak.", "Kívülről nem látszik vasalat.", "Csak az ajtólap marad szem előtt."]
    return det, elev, elevlbl, caps, 0


def lebego():
    det = [
        inn('<rect x="60" y="30" width="90" height="560" fill="url(#va-hatch)"/><rect x="150" y="30" width="8" height="560" fill="#4d4a45"/>', 1.0),
        draw("M158 30V590M60 30V590", 0.3),
        # falra rögzített tartóprofil, ami a lap felső élébe nyúlik
        inn('<path d="M158 150H252V176H184V200H158Z" fill="url(#va-stH)" stroke="#d4a373" stroke-width="1.4"/>'
            '<rect x="228" y="176" width="24" height="62" fill="url(#va-stV)" stroke="#d4a373" stroke-width="1.4"/>', 1.9),
        draw("M158 150H252V238H228V176H184V200H158", 1.6, "#d4a373"),
        # ajtólap felső élébe mart horony, benne a görgős kocsi
        inn('<path d="M196 200H214V230H266V200H284V590H196Z" fill="url(#va-wood)" stroke="#d9c3a5" stroke-width="1.8"/>', 3.0),
        f'<g class="va-drop" style="animation-delay:3.6s"><rect x="218" y="236" width="44" height="18" rx="4" fill="url(#va-stH)" stroke="#9a9a9a"/>'
        f'<circle cx="240" cy="248" r="9" fill="url(#va-disc)" stroke="#d0d0d0"/><circle cx="240" cy="248" r="3.5" fill="#d4a373"/></g>',
        inn('<path d="M196 600H300" stroke="#b0b0b0" stroke-width="2"/>', 4.2),
        lbl(105, 40, 105, 40, 105, 24, "fal", "middle", .9),
        lbl(250, 160, 330, 120, 336, 124, "falra rögzített profil", "start", 2.2),
        lbl(262, 246, 330, 250, 336, 258, "görgők a lap élében", "start", 3.9),
        lbl(284, 420, 330, 420, 336, 428, "ajtólap", "start", 4.4),
    ]
    x, y, w, h = DOOR
    elev = (elev_base() +
            f'<g class="va-slide"><rect x="{x + 10}" y="{y + h + 2}" width="{w - 20}" height="12" fill="url(#va-shadow)" opacity=".8"/>'
            f'<rect x="{x + 6}" y="{y + 6}" width="{w}" height="{h - 10}" fill="rgba(0,0,0,.35)"/>'
            f'{door_slab(x, y, w, h - 10)}</g>')
    elevlbl = '<path d="M450 186L480 150" stroke="#8a8a8a" stroke-width="1.2"/><text x="400" y="144" class="va-lbl2">nincs látható sín</text>'
    caps = ["A vasalat a lap felső élébe rejtve.", "Nincs látható sín, se görgő.", "Az ajtólap mintha lebegne."]
    return det, elev, elevlbl, caps, 0


def falban():
    det = [
        # függőleges metszet a falon át: két falburkolat, köztük a zseb
        inn('<rect x="120" y="30" width="34" height="560" fill="url(#va-hatch)"/><rect x="326" y="30" width="34" height="560" fill="url(#va-hatch)"/>'
            '<rect x="120" y="30" width="240" height="70" fill="url(#va-hatch)"/>', 1.0),
        draw("M120 590V30H360V590M154 590V100H326V590", 0.3),
        inn('<path d="M190 100V140H206V116H274V140H290V100Z" fill="url(#va-stH)" stroke="#d4a373" stroke-width="1.6"/>', 1.9),
        draw("M190 100V140H206V116H274V140H290V100", 1.6, "#d4a373"),
        f'<g class="va-drop" style="animation-delay:2.8s"><rect x="212" y="120" width="56" height="16" rx="4" fill="url(#va-stH)" stroke="#9a9a9a"/>'
        f'<circle cx="226" cy="128" r="8" fill="url(#va-disc)" stroke="#d0d0d0"/><circle cx="254" cy="128" r="8" fill="url(#va-disc)" stroke="#d0d0d0"/></g>',
        inn('<rect x="234" y="136" width="12" height="40" fill="url(#va-stV)" stroke="#9a9a9a"/>'
            '<rect x="214" y="176" width="52" height="414" fill="url(#va-wood)" stroke="#d9c3a5" stroke-width="1.8"/>', 3.6),
        lbl(340, 60, 400, 60, 406, 68, "falszerkezet", "start", .9),
        lbl(290, 112, 400, 120, 406, 128, "sín a falban", "start", 2.1),
        lbl(262, 130, 400, 176, 406, 184, "görgős kocsi", "start", 3.1),
        lbl(266, 380, 400, 380, 406, 388, "ajtólap a zsebben", "start", 4.0),
    ]
    x, y, w, h = DOOR
    # zseb: a nyílástól balra a falban; az ajtó a fal mögé csúszik (a falat az ajtó fölé rajzoljuk, kivágással)
    pocket_x0 = OPEN_X0 - SLIDE - 4
    wall_hole = (f'<path fill-rule="evenodd" fill="#1a1a1a" d="M20 104H580V{FLOOR}H20Z'
                 f'M{OPEN_X0} {OPEN_TOP}H{OPEN_X1}V{FLOOR}H{OPEN_X0}Z"/>')
    elev = (f'<rect x="20" y="{FLOOR}" width="560" height="10" fill="url(#va-hatch)"/>'
            f'<rect x="{OPEN_X0}" y="{OPEN_TOP}" width="{OPEN_X1 - OPEN_X0}" height="{FLOOR - OPEN_TOP}" fill="#0b0b0b"/>'
            f'<rect x="{OPEN_X0 + 40}" y="{OPEN_TOP + 70}" width="70" height="110" fill="#1d2a22" stroke="#33463a"/>'
            f'<g class="va-slide">{door_slab(OPEN_X0, OPEN_TOP, OPEN_X1 - OPEN_X0, FLOOR - OPEN_TOP - 4, "right")}</g>'
            + wall_hole +
            f'<rect x="20" y="104" width="560" height="{FLOOR - 104}" fill="rgba(255,255,255,0.03)"/>'
            f'<path d="M20 104H580M20 {FLOOR}H580" stroke="#b0b0b0" stroke-width="1.6"/>'
            f'<path d="M{OPEN_X0} {FLOOR}V{OPEN_TOP}H{OPEN_X1}V{FLOOR}" fill="none" stroke="#7a7a7a" stroke-width="1.5"/>'
            f'<rect x="{pocket_x0}" y="{OPEN_TOP - 4}" width="{OPEN_X0 - pocket_x0}" height="{FLOOR - OPEN_TOP + 4}" fill="none" stroke="#d4a373" stroke-width="1.4" stroke-dasharray="7 5"/>')
    elevlbl = f'<text x="{(pocket_x0 + OPEN_X0) // 2}" y="{OPEN_TOP + 40}" text-anchor="middle" class="va-lbl2">zseb a falban</text>'
    caps = ["Tok és sín a fal belsejében.", "Nyitva a lap a falba csúszik.", "Nem foglal helyet, nincs útban."]
    return det, elev, elevlbl, caps, 0


TIPUSOK = {"pajta": ("PAJTAAJTÓ-VASALAT", pajta), "rejtett": ("REJTETT VASALAT", rejtett),
           "lebego": ("LEBEGŐ VASALAT", lebego), "falban": ("FALBAN FUTÓ AJTÓ", falban)}


def svg(nev):
    cim, fn = TIPUSOK[nev]
    det, elev, elevlbl, caps, spin = fn()
    css = CSS.replace("SLIDE", str(SLIDE)).replace("SPIN", f"{spin:.0f}")
    capsvg = "".join(f'<text x="300" y="664" class="va-cap va-c{i + 1}">{c}</text>' for i, c in enumerate(caps))
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 700" role="img" aria-label="{cim.capitalize()}: szemléltető animáció">
<style>{css}</style>
<defs>{DEFS}</defs>
<rect width="600" height="700" fill="#141414"/>
<rect class="va-in" width="600" height="700" fill="url(#va-grid)"/>
<g class="va-elev">{elev}</g>
<g class="va-elevlbl" style="animation-delay:8s">{elevlbl}</g>
<g class="va-det">
<rect x="0" y="0" width="600" height="610" fill="#161616"/>
<rect class="va-in" width="600" height="610" fill="url(#va-grid)"/>
{''.join(det)}
<rect x="0" y="0" width="600" height="610" fill="none" stroke="#d4a373" stroke-width="7" class="va-in" style="animation-delay:6.2s"/>
</g>
<path d="M0 620H600" stroke="rgba(255,255,255,.12)"/>
{capsvg}
<g class="va-in" style="animation-delay:.2s"><text x="20" y="694" class="va-tb">ROLL’N’DOOR · {cim}</text><text x="580" y="694" text-anchor="end" class="va-tb2">szemléltető, nem méretarányos</text></g>
</svg>
"""


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for n in TIPUSOK:
        with open(os.path.join(OUT, f"{n}-animacio.svg"), "w", encoding="utf-8") as f:
            f.write(svg(n))
        print(n)
