export interface EmailModuleOptions {
    apiKey: string;
    /** Used as the `from` address when a send call doesn't specify one. */
    defaultFrom?: string;
}

export interface EmailAttachment {
    filename: string;
    content: string | Buffer;
}

export interface SendEmailOptions {
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
    /** Falls back to `EmailModuleOptions.defaultFrom` when omitted. */
    from?: string;
    cc?: string | string[];
    bcc?: string | string[];
    replyTo?: string | string[];
    attachments?: EmailAttachment[];
}

export interface SendEmailResult {
    id: string;
}
