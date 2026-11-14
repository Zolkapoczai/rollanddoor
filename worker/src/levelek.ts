// Automatikus levelek (ugyfélnek) és értesítők (Ricsinek). Minden küldés a mail.ts sendMail()-jén át megy.
// Szabályok: tegezés, rövid, egy fő teendő; csak DB-ben tárolt adat (összeg, dátum) kerül bele;
// a ricsi_token SOHA nem kerülhet ügyfélnek menő levélbe (kuldUgyfelnek() ellenőrzi is).
import type { Env } from "./env";
import { sendMail, type MailAttachment, type MailResult } from "./mail";
import type { Order } from "./megrendeles";
import { esc, formatDatum, formatFt, replyAddress } from "./util";

export type LevelTipus = "ajanlat" | "emlekezo3" | "emlekezo7" | "elom" | "latvanyterv" | "idopont" | "holnap" | "velemeny";

export interface Level {
  subject: string;
  text: string;
  html: string;
}

type Cimzett = Pick<Order, "id" | "email" | "valasz_kulcs" | "ricsi_token">;
type Tokenes = Pick<Order, "ugyfel_token">;

const TELEFON = "06 20 565 0661";
const ELOTAG = "Roll’n’Door – ";

function site(env: Env): string {
  return env.SITE_URL.replace(/\/+$/, "");
}
export const statuszLink = (env: Env, o: Tokenes) => `${site(env)}/r/${o.ugyfel_token}`;
export const leiratkozasLink = (env: Env, o: Tokenes) => `${site(env)}/le/${o.ugyfel_token}`;

/** Lábléc minden automatikus ügyfél-levélhez: státusz + leiratkozás. */
export function lablec(env: Env, o: Tokenes): { text: string; html: string } {
  const st = statuszLink(env, o);
  const le = leiratkozasLink(env, o);
  return {
    text: `--\nItt látod, hol tart az ajtód: ${st}\nNem kérek több levelet: ${le}`,
    html:
      `<hr style="border:none;border-top:1px solid #ddd;margin:24px 0 12px">` +
      `<p style="font-size:14px;color:#666;margin:0 0 6px"><a href="${esc(st)}" style="color:#666">Itt látod, hol tart az ajtód</a></p>` +
      `<p style="font-size:14px;color:#666;margin:0"><a href="${esc(le)}" style="color:#666">Nem kérek több levelet</a></p>`,
  };
}

function keret(env: Env, o: Tokenes, targy: string, bekezdesek: string[], cta?: { felirat: string; url: string }): Level {
  const l = lablec(env, o);
  const text =
    ["Szia!", ...bekezdesek, ...(cta ? [`${cta.felirat}: ${cta.url}`] : []), "Üdv,\nRoll’n’Door"].join("\n\n") + `\n\n${l.text}`;
  const p = (t: string) => `<p style="margin:0 0 16px">${esc(t).replace(/\n/g, "<br>")}</p>`;
  const gomb = cta
    ? `<p style="margin:24px 0"><a href="${esc(cta.url)}" style="display:inline-block;padding:14px 24px;background:#d4a373;color:#1c1c1c;text-decoration:none;border-radius:8px;font-weight:bold">${esc(cta.felirat)}</a></p>`
    : "";
  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:17px;line-height:1.5;color:#222;max-width:560px">` +
    p("Szia!") +
    bekezdesek.map(p).join("") +
    gomb +
    p("Üdv,\nRoll’n’Door") +
    l.html +
    `</div>`;
  return { subject: ELOTAG + targy, text, html };
}

/** A levél tartalma. A dátum/összeg kizárólag az order sorából jön; ha kell és nincs, hibát dobunk (nem találunk ki adatot). */
export function levelTartalom(env: Env, o: Order, tipus: LevelTipus): Level {
  const st = statuszLink(env, o);
  const osszeg = o.ajanlat_osszeg ? formatFt(o.ajanlat_osszeg) : null;
  switch (tipus) {
    case "ajanlat":
      return keret(
        env,
        o,
        "Elkészült az ajánlatod",
        [
          osszeg ? `Elkészült az ajánlatod. Az ajánlat összege: ${osszeg}.` : "Elkészült az ajánlatod.",
          `Itt nézheted meg, és itt tudod elfogadni. Ha kérdésed van, válaszolj erre a levélre, vagy hívj: ${TELEFON}.`,
        ],
        { felirat: "Ajánlat megnézése", url: st },
      );
    case "emlekezo3":
      return keret(
        env,
        o,
        "Emlékeztető az ajánlatodról",
        [
          osszeg ? `Pár napja elküldtük az ajánlatodat (${osszeg}). Láttad már?` : "Pár napja elküldtük az ajánlatodat. Láttad már?",
          "Ha tetszik, itt tudod elfogadni. Ha kérdésed van, válaszolj erre a levélre.",
        ],
        { felirat: "Ajánlat megnézése", url: st },
      );
    case "emlekezo7":
      return keret(
        env,
        o,
        "Még érdekel az ajánlat?",
        [
          "Egy hete küldtük el az ajánlatodat. Még érdekel? Ha igen, itt tudod elfogadni, vagy megírni, min változtatnál.",
          "Erről több emlékeztetőt nem küldünk.",
        ],
        { felirat: "Ajánlat megnézése", url: st },
      );
    case "elom":
      return keret(
        env,
        o,
        "Megérkezett az előleg",
        ["Megérkezett az előleg, köszönjük! Készül a látványterv.", "Amint kész, írunk. Az állapotot bármikor megnézheted itt:"],
        { felirat: "Állapot megnézése", url: st },
      );
    case "latvanyterv":
      return keret(
        env,
        o,
        "Kész a látványterv",
        ["Elkészült a látványterved. Nézd meg, és hagyd jóvá, vagy írd meg, min változtassunk."],
        { felirat: "Látványterv megnézése", url: st },
      );
    case "idopont": {
      if (!o.varhato_beszereles) throw new Error("nincs beszerelesi datum");
      return keret(
        env,
        o,
        "Elkészült az ajtód, egyeztessünk időpontot",
        [
          `Elkészült az ajtód. A beszerelés várható időpontja: ${formatDatum(o.varhato_beszereles)}`,
          `Ha ez neked nem jó, válaszolj erre a levélre, vagy hívj: ${TELEFON}, és egyeztetünk.`,
        ],
        { felirat: "Állapot megnézése", url: st },
      );
    }
    case "holnap": {
      if (!o.varhato_beszereles) throw new Error("nincs beszerelesi datum");
      return keret(
        env,
        o,
        "Holnap szerelünk",
        [
          `Holnap (${formatDatum(o.varhato_beszereles)}) szerelünk.`,
          `Ha közbejött valami, válaszolj erre a levélre, vagy hívj minél előbb: ${TELEFON}.`,
        ],
        { felirat: "Állapot megnézése", url: st },
      );
    }
    case "velemeny":
      return keret(
        env,
        o,
        "Szívesen látnánk a véleményed",
        ["Köszönjük, hogy minket választottál!", "Szívesen látnánk egy rövid véleményt és egy fotót a kész ajtóról:"],
        { felirat: "Vélemény és fotó küldése", url: st },
      );
  }
}

/**
 * Minden ügyfélnek menő levél ezen megy át. Védőháló: ha a szöveg a ricsi_tokent tartalmazza, a levél NEM megy ki.
 */
export async function kuldUgyfelnek(
  env: Env,
  o: Cimzett,
  m: { subject: string; text: string; html?: string; attachments?: MailAttachment[] },
): Promise<MailResult> {
  if (m.text.includes(o.ricsi_token) || (m.html ?? "").includes(o.ricsi_token) || m.subject.includes(o.ricsi_token)) {
    console.log("[levelek] a levél Ricsi-tokent tartalmazna: nem megy ki");
    return { ok: false, error: "tiltott tartalom" };
  }
  return sendMail(env, {
    to: o.email,
    subject: m.subject,
    text: m.text,
    html: m.html,
    replyTo: replyAddress(env, o.id, o.valasz_kulcs),
    fromName: "Roll’n’Door",
    attachments: m.attachments,
  });
}

export interface AutoEredmeny {
  kuldve: boolean;
  /** Miért maradt el (leiratkozott / nem aktív). */
  kihagyva?: "leiratkozott" | "statusz";
  hiba?: string;
}

/** Automatikus levél: kimarad, ha az ügyfél leiratkozott vagy a megrendelés nem aktív. */
export async function kuldAutomata(env: Env, o: Order, tipus: LevelTipus): Promise<AutoEredmeny> {
  if (o.leiratkozott === 1) return { kuldve: false, kihagyva: "leiratkozott" };
  if (o.statusz !== "aktiv") return { kuldve: false, kihagyva: "statusz" };
  let l: Level;
  try {
    l = levelTartalom(env, o, tipus);
  } catch {
    return { kuldve: false, hiba: "hiányzó adat" };
  }
  const r = await kuldUgyfelnek(env, o, l);
  return r.ok ? { kuldve: true } : { kuldve: false, hiba: r.error };
}

/** Az állomásra érkezéskor küldendő levél típusa (null: nincs). */
export function erkezesiLevel(allomas: number): LevelTipus | null {
  switch (allomas) {
    case 3:
      return "ajanlat";
    case 4:
      return "elom";
    case 5:
      return "latvanyterv";
    case 7:
      return "velemeny";
    default:
      return null; // 1: az igény felvételekor megy (igeny.ts); 2 és 6: nincs
  }
}

/** Értesítő Ricsinek (csak RICSI_EMAIL-re). A kezelőlink csak itt szerepelhet. */
export async function ertesitRicsit(env: Env, o: Order, tema: string, szoveg: string): Promise<MailResult> {
  const link = `${site(env)}/m/${o.ricsi_token}`;
  const r = await sendMail(env, {
    to: env.RICSI_EMAIL,
    subject: `#${o.id} – ${o.nev}: ${tema}`,
    text: `${szoveg}\n\nMegrendelés kezelése: ${link}`,
    html:
      `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5"><p style="white-space:pre-wrap">${esc(szoveg)}</p>` +
      `<p><a href="${esc(link)}">Megrendelés kezelése</a></p></div>`,
    replyTo: replyAddress(env, o.id, o.valasz_kulcs),
    fromName: o.nev,
  });
  return r;
}
