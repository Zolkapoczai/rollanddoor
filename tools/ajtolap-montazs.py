# A vasalattípus-ablakok képei: ugyanaz a jelenet, csak az ajtólap anyaga más.
# Az alapkép (public/img/tipus-*.webp) ajtólapja tömörfa; erre perspektívahelyesen ráillesztjük
# a valódi fém, nyomatos és antik ajtófotók kiegyenesített lapját. A háttér, a sín és a fogantyú
# pixelre az alapképé marad (maszk), a lap a jelenet fényét kapja.
#
# Futtatás:  python tools/ajtolap-montazs.py
# Kimenet:   public/img/vasalat/<vasalat>-<ajtolap>.webp  (768×884, 2× felbontás)
import os
import cv2
import numpy as np

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
IMG = os.path.join(ROOT, "public", "img")
OUT = os.path.join(IMG, "vasalat")
UP = 2  # nagyítás az alapképhez képest
TW, TH = 600, 1300  # kiegyenesített ajtólap-textúra

# Forrásfotók ajtólapjának sarkai: bal-felső, jobb-felső, jobb-alsó, bal-alsó (forráspixel).
FORRAS = {
    "fem": ("ajtolap-fem.webp", [(241, 200), (870, 200), (848, 1522), (283, 1545)]),
    "nyomatos": ("referencia/ref-23-templomos-minta.webp", [(172, 187), (770, 180), (703, 1515), (180, 1345)]),
    # az antik lap teteje a forrásképen a görgők alatt kezdődik (a díszes oromzat alja marad)
    "antik": ("galeria-06-antik-diszes-ajto.webp", [(152, 262), (624, 262), (598, 1275), (177, 1235)]),
}
# A textúrán eltakarandó (vasalattal fedett) részek, a kiegyenesített lap arányában: x0, y0, x1, y1.
TAKARAS = {
    "fem": [],
    "nyomatos": [(0.0, 0.0, 1.0, 0.035), (0.0, 0.0, 0.08, 0.24), (0.9, 0.0, 1.0, 0.24)],
    "antik": [],
}
# A forrásfotó saját fogantyúja: a jelenet adja a fogantyút, ezt lefoltozzuk.
FOLT = {"fem": [(0.038, 0.47, 0.16, 0.64)]}
# A lap átlagos fényessége a jelenetben (0–255), anyagonként.
FENY = {"fem": 150, "nyomatos": None, "antik": 112}
TELITETTSEG = {"fem": 1.0, "nyomatos": 1.0, "antik": 0.8}
# Saját (fotózási) fényfoltok kisimítása: 0 = marad, 1 = teljesen sík.
SIMITAS = {"fem": 0.55, "nyomatos": 0.0, "antik": 0.35}

# Alapképek: az ajtólap négy sarka (alapkép-pixel). Az alsó sarkok a képen kívül vannak.
ALAP = {
    "pajta": [(47.5, 145.2), (258.5, 131.0), (258.5, 131.0 + 457), (47.5, 145.2 + 457)],
    "rejtett": [(58.5, 136.2), (252.8, 121.8), (252.8, 121.8 + 421), (58.5, 136.2 + 421)],
    "lebego": [(58.5, 134.2), (253.5, 119.8), (253.5, 119.8 + 423), (58.5, 134.2 + 423)],
    # Falban futó: csak a lap falból kilógó széle látszik; ez a lap jobb szélének felel meg.
    "falban": [(155.0, 145.5), (178.0, 143.6), (178.0, 143.6 + 421), (155.0, 145.5 + 421)],
}
FALBAN_SAV = 0.12  # a lap jobb szélének ekkora része látszik a falban futónál


def textura(nev):
    fajl, pts = FORRAS[nev]
    im = cv2.imread(os.path.join(IMG, fajl)).astype(np.float32)
    H = cv2.getPerspectiveTransform(np.float32(pts), np.float32([(0, 0), (TW, 0), (TW, TH), (0, TH)]))
    t = cv2.warpPerspective(im, H, (TW, TH), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    for x0, y0, x1, y1 in FOLT.get(nev, []):  # foltozás a mellette lévő, tiszta lemezből
        X0, Y0, X1, Y1 = int(x0 * TW), int(y0 * TH), int(x1 * TW), int(y1 * TH)
        d = X1 - X0 + 20
        src = np.roll(t, -d, axis=1)
        m = np.zeros((TH, TW), np.float32)
        m[Y0:Y1, X0:X1] = 1
        m = cv2.GaussianBlur(m, (0, 0), 5)[..., None]
        m[Y0 + 8:Y1 - 8, X0 + 3:X1 - 8] = 1  # a fogantyú helye biztosan fedve
        t = t * (1 - m) + src * m
    if TAKARAS[nev]:
        m = np.zeros((TH, TW), np.uint8)
        for x0, y0, x1, y1 in TAKARAS[nev]:
            m[int(y0 * TH):int(y1 * TH), int(x0 * TW):int(x1 * TW)] = 255
        t = cv2.inpaint(np.clip(t, 0, 255).astype(np.uint8), m, 9, cv2.INPAINT_TELEA).astype(np.float32)
    if SIMITAS[nev]:
        lum = t.mean(axis=2, keepdims=True)
        nagy = cv2.GaussianBlur(lum, (0, 0), 70)[..., None] if lum.ndim == 3 else cv2.GaussianBlur(lum, (0, 0), 70)
        nagy = nagy.reshape(TH, TW, 1)
        t = t / np.power(np.maximum(nagy, 1) / nagy.mean(), SIMITAS[nev])
    if TELITETTSEG[nev] != 1.0:
        g = t.mean(axis=2, keepdims=True)
        t = g + (t - g) * TELITETTSEG[nev]
    return t


def maszk(alap, nev):
    """Az alapkép ajtólapjának pixelei (fa színű, összefüggő terület) – a vasalat és a fogantyú kimarad."""
    hsv = cv2.cvtColor(alap, cv2.COLOR_BGR2HSV).astype(int)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    fa = ((h >= 6) & (h <= 26) & (s > 60) & (v > 55)).astype(np.uint8)
    q = np.float32(ALAP[nev]) * UP
    poly = np.zeros(fa.shape, np.uint8)
    cv2.fillConvexPoly(poly, np.int32(np.round(q)), 1)
    poly = cv2.dilate(poly, np.ones((5, 5), np.uint8))
    fa &= poly
    n, lab, st, _ = cv2.connectedComponentsWithStats(fa)
    fo = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
    m = (lab == fo).astype(np.uint8)
    # apró lyukak (sötétebb erezet) befoltozása, de a fekete vasalat kimarad
    zart = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    m = np.where((zart > 0) & (v > 45), 1, m).astype(np.uint8)
    if nev == "falban":  # soronként kitöltjük a keskeny sávot
        for y in range(m.shape[0]):
            xs = np.nonzero(m[y])[0]
            if len(xs) > 2:
                m[y, xs.min():xs.max() + 1] = 1
    a = cv2.GaussianBlur(m.astype(np.float32), (0, 0), 0.9)
    return np.clip(a * 1.15, 0, 1)


def arnyek(alap, a):
    """A jelenet fénye az eredeti lapon: nagy léptékű világosság, normalizálva (1 = átlag)."""
    L = alap.astype(np.float32).mean(axis=2)
    w = (a > 0.5).astype(np.float32)
    s = 9 * UP
    sim = cv2.GaussianBlur(L * w, (0, 0), s) / np.maximum(cv2.GaussianBlur(w, (0, 0), s), 1e-3)
    return sim / sim[w > 0].mean(), L[w > 0].mean()


def main():
    os.makedirs(OUT, exist_ok=True)
    tex = {k: textura(k) for k in FORRAS}
    for nev, quad in ALAP.items():
        kicsi = cv2.imread(os.path.join(IMG, f"tipus-{nev}.webp"))
        alap = cv2.resize(kicsi, None, fx=UP, fy=UP, interpolation=cv2.INTER_LANCZOS4)
        a = maszk(alap, nev)
        S, falum = arnyek(alap, a)
        q = np.float32(quad) * UP
        Hh, Ww = alap.shape[:2]
        cv2.imwrite(os.path.join(OUT, f"{nev}-tomorfa.webp"), alap, [cv2.IMWRITE_WEBP_QUALITY, 86])
        for k, t in tex.items():
            if nev == "falban":
                x0 = int(TW * (1 - FALBAN_SAV))
                t = cv2.resize(t[:, x0:], (TW, TH), interpolation=cv2.INTER_CUBIC)
            H = cv2.getPerspectiveTransform(np.float32([(0, 0), (TW, 0), (TW, TH), (0, TH)]), q)
            w = cv2.warpPerspective(t, H, (Ww, Hh), flags=cv2.INTER_AREA, borderMode=cv2.BORDER_REPLICATE)
            w = cv2.GaussianBlur(w, (0, 0), 0.6)  # a jelenet lágyságához
            lum = w.mean(axis=2)[a > 0.5].mean()
            cel = FENY[k] if FENY[k] is not None else lum
            if nev == "falban" and FENY[k] is not None:
                cel *= falum / 140.0  # árnyékosabb sáv
            w = w * (cel / max(lum, 1)) * S[..., None]
            w = w * np.float32([0.95, 1.0, 1.04])  # meleg szobafény (BGR)
            out = alap.astype(np.float32) * (1 - a[..., None]) + w * a[..., None]
            cv2.imwrite(os.path.join(OUT, f"{nev}-{k}.webp"), np.clip(out, 0, 255).astype(np.uint8),
                        [cv2.IMWRITE_WEBP_QUALITY, 86])
        print(nev, "kész")


if __name__ == "__main__":
    main()
