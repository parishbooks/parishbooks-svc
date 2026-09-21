import { Logger } from '@nestjs/common';
import { emailOTP } from 'better-auth/plugins';
import { EmailService } from '@parishbooks/messaging';

const OTP_SUBJECTS: Record<'sign-in' | 'email-verification' | 'forget-password' | 'change-email', string> = {
    'sign-in': 'Your ParishBooks sign-in code',
    'email-verification': 'Verify your ParishBooks email',
    'forget-password': 'Reset your ParishBooks password',
    'change-email': 'Confirm your new ParishBooks email',
};

export const emailOtpPlugin = (logger: Logger, emailService: EmailService) => {
    return emailOTP({
        otpLength: 6,
        overrideDefaultEmailVerification: true,
        sendVerificationOnSignUp: true,
        sendVerificationOTP: async ({ email, otp, type }) => {
            logger.log(`Sending OTP for ${email} (${type})`);
            await emailService.sendEmail({
                to: email,
                subject: OTP_SUBJECTS[type],
                text: `Your verification code is ${otp}. It expires in 5 minutes.`,
            });
        },
    });
};
