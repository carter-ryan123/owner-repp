declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    PLATFORM_OWNER_EMAIL?: string;
    STRIPE_API_KEY?: string;
    STRIPE_WEBHOOK_SECRET?: string;
    STRIPE_BOOST_PRICE_ID?: string;
    STRIPE_PLATFORM_ACCOUNT_ID?: string;
    STRIPE_CHECKOUT_ENABLED?: string;
  }
}
