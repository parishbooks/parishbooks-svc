import { Logger } from '@nestjs/common';
import { emailOTP } from 'better-auth/plugins';

export const emailOtpPlugin = (logger: Logger) => {
    return emailOTP({
        otpLength: 6,
        overrideDefaultEmailVerification: true,
        sendVerificationOnSignUp: true,
        sendVerificationOTP: async ({ email, otp, type }) => {
            logger.log(`OTP ${otp} for ${email} (${type})`);
        },
    });
};
