declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    ALLOWED_EMAILS?: string;
    ACCUWEATHER_API_KEY?: string;
  }
}
