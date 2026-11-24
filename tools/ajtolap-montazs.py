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
    "antik": ("galeria-06-antik-diszes-ajto.webp", [(152, 262), (614, 262), (589, 1275), (177, 1235)]),
}
# A textúrán eltakarandó (vasalattal fedett) részek, a kiegyenesített lap arányában: x0, y0, x1, y1.
TAKARAS = {
    "fem": [],
    "nyomatos": [(0.0, 0.0, 1.0, 0.035), (0.0, 0.0, 0.12, 0.28), (0.85, 0.0, 1.0, 0.27)],
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
}
DEBUG = os.environ.get('MONTAZS_DEBUG') == '1'


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
    """Az ajtólap pixelei: a kimért sarkokból rajzolt, élsimított sokszög, a sötét vasalat és fogantyú nélkül.
    (A színalapú maszk az árnyékos lapszélen cakkos volt.) A falban futót a falban_felig() készíti."""
    hsv = cv2.cvtColor(alap, cv2.COLOR_BGR2HSV).astype(int)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    q = np.float32(ALAP[nev]) * UP
    # élsimított sokszög 4× túlmintavételezéssel; kicsit kifelé tolva, hogy az eredeti fa lap széle ne villanjon ki
    k = q.mean(axis=0)
    q = q + np.sign(q - k) * np.float32([1.6, 1.4]) * UP / 2
    q[[1, 2], 0] += 2 * UP  # jobb oldalt a lap éle (vastagsága) is az új anyagot kapja
    H, W = alap.shape[:2]
    nagy = np.zeros((H * 4, W * 4), np.uint8)
    cv2.fillConvexPoly(nagy, np.int32(np.round(q * 4)), 255)
    poly = cv2.resize(nagy, (W, H), interpolation=cv2.INTER_AREA).astype(np.float32) / 255
    fa = (h >= 6) & (h <= 26) & (s > 60) & (v > 55)
    # vasalat (pánt, görgő, fogantyú) a lapon: nem fa színű, összefüggő, sötét foltok – ezeknél marad az eredeti
    nemfa = ((~fa) & (poly > 0.5)).astype(np.uint8)
    nemfa = cv2.morphologyEx(nemfa, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(nemfa)
    vas = np.zeros_like(nemfa)
    belso = cv2.erode((poly > 0.5).astype(np.uint8), np.ones((9, 9), np.uint8))
    for i in range(1, n):
        px = alap[lab == i].astype(int)  # BGR
        barna = (px[:, 2] - px[:, 0]).mean()  # a sötét, barnás lapél nem vasalat; a fekete pánt/fogantyú szürke
        szelen = bool((lab == i)[belso == 0].any())  # a lap peremén ér
        if st[i, cv2.CC_STAT_AREA] >= 60 * UP and v[lab == i].mean() < 58 and (barna < 22 or not szelen):
            vas[lab == i] = 1
        if DEBUG and st[i, cv2.CC_STAT_AREA] >= 60 * UP:
            print(nev, i, st[i, cv2.CC_STAT_AREA], round(v[lab == i].mean()), round(barna))
    vas = cv2.GaussianBlur(vas.astype(np.float32), (0, 0), 0.7)
    return np.clip(poly * (1 - vas), 0, 1)


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
            H = cv2.getPerspectiveTransform(np.float32([(0, 0), (TW, 0), (TW, TH), (0, TH)]), q)
            w = cv2.warpPerspective(t, H, (Ww, Hh), flags=cv2.INTER_AREA, borderMode=cv2.BORDER_REPLICATE)
            w = cv2.GaussianBlur(w, (0, 0), 0.6)  # a jelenet lágyságához
            lum = w.mean(axis=2)[a > 0.5].mean()
            cel = FENY[k] if FENY[k] is not None else lum
            w = w * (cel / max(lum, 1)) * S[..., None]
            w = w * np.float32([0.95, 1.0, 1.04])  # meleg szobafény (BGR)
            out = alap.astype(np.float32) * (1 - a[..., None]) + w * a[..., None]
            cv2.imwrite(os.path.join(OUT, f"{nev}-{k}.webp"), np.clip(out, 0, 255).astype(np.uint8),
                        [cv2.IMWRITE_WEBP_QUALITY, 86])
        print(nev, "kész")
    falban_felig(tex)
    texturak_mentese(tex)


def fa_textura():
    """Tömörfa textúra: a rejtett-kép fa lapja kiegyenesítve (ugyanaz a jelenet, ugyanaz a fa)."""
    rejt = cv2.resize(cv2.imread(os.path.join(IMG, "tipus-rejtett.webp")), None, fx=UP, fy=UP,
                      interpolation=cv2.INTER_LANCZOS4).astype(np.float32)
    Hr = cv2.getPerspectiveTransform(np.float32(ALAP["rejtett"]) * UP, np.float32([(0, 0), (TW, 0), (TW, TH), (0, TH)]))
    fa = cv2.warpPerspective(rejt, Hr, (TW, TH), flags=cv2.INTER_AREA, borderMode=cv2.BORDER_REPLICATE)
    # A rejtett-képen a lap alja kilóg a képből, és lent ott a fogantyú: csak a felső, tiszta részt használjuk,
    # lefelé tükrözve folytatjuk (függőleges deszkaerezet, a tükrözés nem feltűnő).
    jo = fa[:int(TH * 0.58)]
    return np.concatenate([jo, jo[::-1], jo])[:TH]


def texturak_mentese(tex):
    """A tervező fotóillesztéséhez: kiegyenesített, egyenletes fényű ajtólap-textúrák (public/img/illesztes/)."""
    cel = os.path.join(IMG, "illesztes")
    os.makedirs(cel, exist_ok=True)
    for k, t in {"tomorfa": fa_textura(), **tex}.items():
        if FENY.get(k):
            t = t * (FENY[k] / max(t.mean(), 1))
        kicsi = cv2.resize(np.clip(t, 0, 255).astype(np.uint8), (360, 780), interpolation=cv2.INTER_AREA)
        cv2.imwrite(os.path.join(cel, f"{k}.webp"), kicsi, [cv2.IMWRITE_WEBP_QUALITY, 82])
    print("illesztési textúrák kész")


def falban_felig(tex):
    """Falban futó, félig nyitva: az alapképen az ajtó szinte teljesen a falban van, ezért a lapot
    mi húzzuk ki a nyílás közepéig. A tömörfa anyagot és a fogantyút a rejtett-kép (ugyanaz a jelenet) adja."""
    kicsi = cv2.imread(os.path.join(IMG, "tipus-falban.webp"))
    alap = cv2.resize(kicsi, None, fx=UP, fy=UP, interpolation=cv2.INTER_LANCZOS4).astype(np.float32)
    Hh, Ww = alap.shape[:2]
    # a nyílás felső éle (alapkép-pixel): y = 143.6 - 0.066·(x - 176); bal oldalt a zseb szája x = 150
    fent = lambda x: 143.6 - 0.066 * (x - 176) + 1.0
    X_ZSEB, X_EL, SZEL, MAG = 150.0, 244.5, 150.0, 325.0  # a lap elülső éle a nyílás közepén
    xb = X_EL - SZEL
    q = np.float32([(xb, fent(xb)), (X_EL, fent(X_EL)), (X_EL, fent(X_EL) + MAG), (xb, fent(xb) + MAG)]) * UP
    # maszk: a lap sokszöge, de csak a zseb szájától jobbra látszik
    nagy = np.zeros((Hh * 4, Ww * 4), np.uint8)
    cv2.fillConvexPoly(nagy, np.int32(np.round(q * 4)), 255)
    a = cv2.resize(nagy, (Ww, Hh), interpolation=cv2.INTER_AREA).astype(np.float32) / 255
    a[:, :int(X_ZSEB * UP)] = 0
    # fény: a nyílásban kicsit árnyékosabb, fent a szemöldök, bal oldalt a zseb szája sötétít
    yy, xx = np.mgrid[0:Hh, 0:Ww].astype(np.float32)
    S = 0.9 * (1 - 0.35 * np.exp(-(yy - fent(xx / UP) * UP) / (4 * UP))).clip(0.5, 1)
    S *= 1 - 0.3 * np.exp(-(xx - X_ZSEB * UP) / (6 * UP)).clip(0, 1)
    rejt = cv2.resize(cv2.imread(os.path.join(IMG, "tipus-rejtett.webp")), None, fx=UP, fy=UP,
                      interpolation=cv2.INTER_LANCZOS4).astype(np.float32)
    fa = fa_textura()
    # a rejtett-kép fogantyúja (sötét pixelei) a lap elülső élétől ugyanakkora távolságra
    rv = cv2.cvtColor(np.clip(rejt, 0, 255).astype(np.uint8), cv2.COLOR_BGR2HSV)[..., 2]
    y0, y1, x0, x1 = 380 * UP, 442 * UP, 222 * UP, 242 * UP
    fog = rejt[y0:y1, x0:x1]
    fa_alpha = cv2.GaussianBlur((rv[y0:y1, x0:x1] < 58).astype(np.float32), (0, 0), 0.7)
    dx = int(round((X_EL - ALAP["rejtett"][1][0]) * UP))  # rejtett lap jobb éle → elülső él
    dy = int(round((fent(X_EL) - ALAP["rejtett"][1][1]) * UP))
    anyagok = {"tomorfa": fa, **tex}
    for k, t in anyagok.items():
        H = cv2.getPerspectiveTransform(np.float32([(0, 0), (TW, 0), (TW, TH), (0, TH)]), q)
        w = cv2.warpPerspective(t, H, (Ww, Hh), flags=cv2.INTER_AREA, borderMode=cv2.BORDER_REPLICATE)
        w = cv2.GaussianBlur(w, (0, 0), 0.6)
        lum = w.mean(axis=2)[a > 0.5].mean()
        cel = lum if k == "tomorfa" or FENY[k] is None else FENY[k]
        w = w * (cel / max(lum, 1)) * S[..., None]
        if k != "tomorfa":
            w = w * np.float32([0.95, 1.0, 1.04])
        out = alap * (1 - a[..., None]) + w * a[..., None]
        ty0, tx0 = y0 + dy, x0 + dx
        h_, w_ = min(fog.shape[0], Hh - ty0), fog.shape[1]
        al = fa_alpha[:h_, :, None] * a[ty0:ty0 + h_, tx0:tx0 + w_, None]
        out[ty0:ty0 + h_, tx0:tx0 + w_] = out[ty0:ty0 + h_, tx0:tx0 + w_] * (1 - al) + fog[:h_] * al
        cv2.imwrite(os.path.join(OUT, f"falban-{k}.webp"), np.clip(out, 0, 255).astype(np.uint8),
                    [cv2.IMWRITE_WEBP_QUALITY, 86])
    print("falban kész (félig nyitva)")


if __name__ == "__main__":
    main()
