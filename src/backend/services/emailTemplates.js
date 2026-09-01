/**
 * Branded HTML Email Templates for TraceMind
 */

/**
 * Common Header Partial
 */
const renderEmailHeader = (title = 'Document Intelligence') => `
  <tr>
    <td style="padding: 32px 32px 24px 32px; background: linear-gradient(135deg, #0f2042 0%, #0b1528 100%); border-bottom: 1px solid rgba(255, 255, 255, 0.08); text-align: center;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center">
        <tr>
          <td style="vertical-align: middle;">
            <div style="background: linear-gradient(135deg, #38bdf8 0%, #2563eb 100%); width: 36px; height: 36px; border-radius: 8px; text-align: center; line-height: 36px; font-weight: bold; color: #ffffff; font-size: 18px; margin: 0 auto 12px auto;">
              ⚡
            </div>
          </td>
        </tr>
        <tr>
          <td style="font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em;">
            TraceMind <span style="color: #60a5fa; font-weight: 400; font-size: 15px; margin-left: 4px;">AI</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
`;

/**
 * Common Footer Partial
 */
const renderEmailFooter = () => `
  <tr>
    <td style="padding: 20px 32px 28px 32px; background-color: #060b18; border-top: 1px solid rgba(255, 255, 255, 0.05); text-align: center;">
      <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b;">
        TraceMind Document Intelligence Platform
      </p>
      <p style="margin: 0; font-size: 11px; color: #475569;">
        &copy; ${new Date().getFullYear()} TraceMind. All rights reserved.
      </p>
    </td>
  </tr>
`;

/**
 * OTP Verification Email Template (Account Activation)
 */
export const getOtpEmailTemplate = ({ name, otp, expiresInMinutes = 10 }) => {
  const userName = name || 'Valued User';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TraceMind Email Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #070d1e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e8f0;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #070d1e; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 540px; background-color: #0b1528; border: 1px solid rgba(59, 130, 246, 0.25); border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);">
          ${renderEmailHeader()}
          <tr>
            <td style="padding: 32px 32px 24px 32px;">
              <h1 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #f8fafc;">
                Verify your email address
              </h1>
              <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #94a3b8;">
                Hello <strong style="color: #e2e8f0;">${userName}</strong>,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #94a3b8;">
                Thank you for creating an account on TraceMind. To complete your registration and activate your document intelligence workspace, please enter the 6-digit verification code below:
              </p>
              <div style="margin: 28px 0; text-align: center;">
                <div style="display: inline-block; background: rgba(30, 58, 138, 0.4); border: 2px solid #3b82f6; border-radius: 10px; padding: 16px 36px;">
                  <span style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 10px; color: #60a5fa; text-shadow: 0 0 12px rgba(96, 165, 250, 0.4);">
                    ${otp}
                  </span>
                </div>
              </div>
              <div style="background: rgba(234, 179, 8, 0.1); border-left: 3px solid #eab308; border-radius: 4px; padding: 12px 16px; margin: 24px 0;">
                <p style="margin: 0; font-size: 13px; color: #fde047; line-height: 1.5;">
                  ⏱️ This code will expire in <strong>${expiresInMinutes} minutes</strong>. If you did not request this verification, please safely ignore this email.
                </p>
              </div>
              <p style="margin: 24px 0 0 0; font-size: 13px; line-height: 1.5; color: #64748b;">
                For security reasons, never share this code with anyone. TraceMind will never ask for your verification code.
              </p>
            </td>
          </tr>
          ${renderEmailFooter()}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
};

/**
 * Password Reset OTP Email Template (Forgot Password)
 */
export const getPasswordResetOtpTemplate = ({ name, otp, expiresInMinutes = 10 }) => {
  const userName = name || 'User';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset Request</title>
</head>
<body style="margin: 0; padding: 0; background-color: #070d1e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e8f0;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #070d1e; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 540px; background-color: #0b1528; border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);">
          ${renderEmailHeader()}
          <tr>
            <td style="padding: 32px 32px 24px 32px;">
              <h1 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #fca5a5;">
                Password Reset Verification
              </h1>
              <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #94a3b8;">
                Hello <strong style="color: #e2e8f0;">${userName}</strong>,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #94a3b8;">
                We received a request to reset your password for your TraceMind account. Use the one-time code below to proceed with setting up a new password:
              </p>
              <div style="margin: 28px 0; text-align: center;">
                <div style="display: inline-block; background: rgba(239, 68, 68, 0.1); border: 2px solid #ef4444; border-radius: 10px; padding: 16px 36px;">
                  <span style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 10px; color: #f87171; text-shadow: 0 0 12px rgba(248, 113, 113, 0.4);">
                    ${otp}
                  </span>
                </div>
              </div>
              <div style="background: rgba(239, 68, 68, 0.1); border-left: 3px solid #ef4444; border-radius: 4px; padding: 12px 16px; margin: 24px 0;">
                <p style="margin: 0; font-size: 13px; color: #fca5a5; line-height: 1.5;">
                  ⚠️ This code will expire in <strong>${expiresInMinutes} minutes</strong> and allows a maximum of 5 attempts. If you did not initiate this password reset, please secure your account immediately.
                </p>
              </div>
              <p style="margin: 24px 0 0 0; font-size: 13px; line-height: 1.5; color: #64748b;">
                Never share this reset code with anyone. TraceMind support representatives will never ask for your password or reset codes.
              </p>
            </td>
          </tr>
          ${renderEmailFooter()}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
};

/**
 * Password Change Verification OTP Email Template (Logged-in User)
 */
export const getPasswordChangeOtpTemplate = ({ name, otp, expiresInMinutes = 10 }) => {
  const userName = name || 'User';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Security Verification: Password Change</title>
</head>
<body style="margin: 0; padding: 0; background-color: #070d1e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e8f0;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #070d1e; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 540px; background-color: #0b1528; border: 1px solid rgba(59, 130, 246, 0.25); border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);">
          ${renderEmailHeader()}
          <tr>
            <td style="padding: 32px 32px 24px 32px;">
              <h1 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #60a5fa;">
                Confirm Password Change Request
              </h1>
              <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #94a3b8;">
                Hello <strong style="color: #e2e8f0;">${userName}</strong>,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #94a3b8;">
                You requested to change your account password from your TraceMind profile settings. To authorize this security change, enter the 6-digit code below:
              </p>
              <div style="margin: 28px 0; text-align: center;">
                <div style="display: inline-block; background: rgba(30, 58, 138, 0.4); border: 2px solid #3b82f6; border-radius: 10px; padding: 16px 36px;">
                  <span style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 10px; color: #60a5fa; text-shadow: 0 0 12px rgba(96, 165, 250, 0.4);">
                    ${otp}
                  </span>
                </div>
              </div>
              <div style="background: rgba(234, 179, 8, 0.1); border-left: 3px solid #eab308; border-radius: 4px; padding: 12px 16px; margin: 24px 0;">
                <p style="margin: 0; font-size: 13px; color: #fde047; line-height: 1.5;">
                  ⏱️ This code expires in <strong>${expiresInMinutes} minutes</strong>. If you did not make this change in your profile, ignore this message and ensure your account is protected.
                </p>
              </div>
            </td>
          </tr>
          ${renderEmailFooter()}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
};

/**
 * Password Changed Confirmation Email Template
 */
export const getPasswordChangedNotificationTemplate = ({
  name,
  clientUrl = 'http://localhost:5173',
  actionType = 'updated'
}) => {
  const userName = name || 'User';
  const actionText = actionType === 'reset'
    ? 'reset via email verification code'
    : 'updated from your account profile settings';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Security Notice: TraceMind Password Updated</title>
</head>
<body style="margin: 0; padding: 0; background-color: #070d1e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e8f0;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #070d1e; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 540px; background-color: #0b1528; border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);">
          ${renderEmailHeader()}
          <tr>
            <td style="padding: 32px 32px 24px 32px;">
              <div style="display: inline-block; background: rgba(16, 185, 129, 0.15); border-radius: 50%; width: 44px; height: 44px; line-height: 44px; text-align: center; color: #34d399; font-size: 22px; margin-bottom: 16px;">
                ✓
              </div>
              <h1 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #34d399;">
                Password Successfully ${actionType === 'reset' ? 'Reset' : 'Updated'}
              </h1>
              <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #94a3b8;">
                Hello <strong style="color: #e2e8f0;">${userName}</strong>,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #94a3b8;">
                This is a confirmation that the password for your TraceMind account was successfully <strong>${actionText}</strong> on <strong>${new Date().toUTCString()}</strong>.
              </p>
              <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 14px 18px; margin: 24px 0;">
                <p style="margin: 0; font-size: 13px; color: #94a3b8; line-height: 1.5;">
                  🔒 If you did not perform this action, please immediately <a href="${clientUrl}/forgot-password" style="color: #60a5fa; text-decoration: underline;">reset your password</a> to protect your workspace.
                </p>
              </div>
            </td>
          </tr>
          ${renderEmailFooter()}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
};

/**
 * Welcome Onboarding Email Template
 */
export const getWelcomeEmailTemplate = ({ name, clientUrl = 'http://localhost:5173' }) => {
  const userName = name || 'Innovator';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to TraceMind</title>
</head>
<body style="margin: 0; padding: 0; background-color: #070d1e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e8f0;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #070d1e; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; background-color: #0b1528; border: 1px solid rgba(59, 130, 246, 0.25); border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);">
          ${renderEmailHeader()}
          <tr>
            <td style="padding: 32px 32px 24px 32px;">
              <p style="margin: 0 0 18px 0; font-size: 15px; line-height: 1.6; color: #e2e8f0;">
                Hi <strong>${userName}</strong>,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #94a3b8;">
                Your email has been verified successfully. Your TraceMind workspace is fully activated and ready for secure document investigation and analysis.
              </p>
              <div style="text-align: center; margin: 32px 0 20px 0;">
                <a href="${clientUrl}/chat" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 13px 32px; border-radius: 8px; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4); border: 1px solid rgba(255, 255, 255, 0.15);">
                  Launch Your Workspace &rarr;
                </a>
              </div>
            </td>
          </tr>
          ${renderEmailFooter()}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
};
