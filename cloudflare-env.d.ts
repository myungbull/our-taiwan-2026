declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    ALLOWED_EMAILS?: string;
    ACCUWEATHER_API_KEY?: string;
    AUTH_PROVIDER?: string;
    ACCESS_TEAM_DOMAIN?: string;
    ACCESS_AUD?: string;
  }
}
