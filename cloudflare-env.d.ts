declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    ALLOWED_EMAILS?: string;
    ACCUWEATHER_API_KEY?: string;
    AUTH_PROVIDER?: string;
    ACCESS_TEAM_DOMAIN?: string;
    ACCESS_AUD?: string;
    R2_MAX_BYTES?: string;
    R2_MAX_WRITES_PER_MONTH?: string;
    R2_MAX_READS_PER_MONTH?: string;
  }
}
