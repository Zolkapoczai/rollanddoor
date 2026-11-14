export interface Env {
  DB: D1Database;
  FILES: R2Bucket;
  ASSETS: Fetcher;
  RICSI_EMAIL: string;
  REPLY_DOMAIN: string;
  SITE_URL: string;
  RESEND_API_KEY?: string;
  RESEND_WEBHOOK_SECRET?: string;
  TURNSTILE_SECRET?: string;
  /** Csak a próbaüzemhez: ha meg van adva (pl. "onboarding@resend.dev"), a levelek feladó-címe ez lesz.
   *  A Reply-To marad a rendelés saját címe. Élesben NE legyen beállítva. */
  MAIL_TEST_FROM?: string;
}
