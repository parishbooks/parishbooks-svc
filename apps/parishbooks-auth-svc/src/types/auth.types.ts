export interface BetterAuthConfig {
    secret: string;
    baseURL: string;
    databaseURL: string;
    googleClientId: string;
    googleClientSecret: string;
    stripeSecretKey: string;
    stripeWebhookSecret: string;
    stripeStarterPriceId: string;
    stripeProPriceId: string;
    orgServiceUrl: string;
    internalServiceKey: string;
    resendApiKey: string;
    resendFromEmail: string;
}
