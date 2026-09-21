import { MessagingError } from '../messaging.error';
import { EmailService } from './email.service';

const send = jest.fn();

jest.mock('resend', () => ({
    Resend: jest.fn().mockImplementation(() => ({ emails: { send } })),
}));

describe('EmailService', () => {
    let service: EmailService;

    beforeEach(() => {
        send.mockReset();
        service = new EmailService({ apiKey: 'test-key', defaultFrom: 'noreply@parishbooks.com' });
    });

    it('sends an email and returns the Resend id', async () => {
        send.mockResolvedValue({ data: { id: 'email-123' }, error: null });

        const result = await service.sendEmail({ to: 'member@example.com', subject: 'Welcome', html: '<p>Hi</p>' });

        expect(result).toEqual({ id: 'email-123' });
        expect(send).toHaveBeenCalledWith(
            expect.objectContaining({
                from: 'noreply@parishbooks.com',
                to: 'member@example.com',
                subject: 'Welcome',
                html: '<p>Hi</p>',
            }),
        );
    });

    it('uses an explicit `from` over the configured default', async () => {
        send.mockResolvedValue({ data: { id: 'email-456' }, error: null });

        await service.sendEmail({ to: 'member@example.com', subject: 'Welcome', from: 'custom@parishbooks.com', text: 'Hi' });

        expect(send).toHaveBeenCalledWith(expect.objectContaining({ from: 'custom@parishbooks.com' }));
    });

    it('throws MessagingError when neither `from` nor a default is available', async () => {
        service = new EmailService({ apiKey: 'test-key' });

        await expect(service.sendEmail({ to: 'member@example.com', subject: 'Welcome', html: '<p>Hi</p>' })).rejects.toThrow(MessagingError);
        expect(send).not.toHaveBeenCalled();
    });

    it('throws MessagingError when neither html nor text is provided', async () => {
        await expect(service.sendEmail({ to: 'member@example.com', subject: 'Welcome' })).rejects.toThrow(MessagingError);
        expect(send).not.toHaveBeenCalled();
    });

    it('throws MessagingError when Resend returns an error', async () => {
        send.mockResolvedValue({ data: null, error: { message: 'invalid API key' } });

        await expect(service.sendEmail({ to: 'member@example.com', subject: 'Welcome', html: '<p>Hi</p>' })).rejects.toThrow('invalid API key');
    });
});
