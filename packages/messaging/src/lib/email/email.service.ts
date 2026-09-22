import { Inject, Injectable } from '@nestjs/common';
import { CreateEmailOptions, Resend } from 'resend';
import { MessagingError } from '../messaging.error';
import { EMAIL_MODULE_OPTIONS } from './email.constants';
import { EmailModuleOptions, SendEmailOptions, SendEmailResult } from './email.types';

@Injectable()
export class EmailService {
    private readonly resend: Resend;

    constructor(@Inject(EMAIL_MODULE_OPTIONS) private readonly options: EmailModuleOptions) {
        this.resend = new Resend(options.apiKey);
    }

    async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
        const from = options.from ?? this.options.defaultFrom;
        if (!from) throw new MessagingError('sendEmail requires a `from` address (none given and no defaultFrom configured)');
        if (!options.html && !options.text) throw new MessagingError('sendEmail requires `html` or `text` content');
        // Runtime-checked above: `html`/`text` satisfy Resend's "at least one" requirement,
        // which its own type can't express over our all-optional SendEmailOptions.
        const payload = {
            from,
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text,
            cc: options.cc,
            bcc: options.bcc,
            replyTo: options.replyTo,
            attachments: options.attachments,
        } as CreateEmailOptions;

        const { data, error } = await this.resend.emails.send(payload);
        if (error || !data) throw new MessagingError(error?.message ?? 'Resend returned no data for sendEmail', error);
        return { id: data.id };
    }
}
