export class Config {
    private static configs: Map<string, string> = new Map<string, string>();

    constructor() {
        Config.configs.set('AUTH_SERVICE_URL', process.env.AUTH_SERVICE_URL || 'http://localhost:3000/api');
    }

    public static get(key: string): string | undefined {
        return this.configs.get(key);
    }
}
