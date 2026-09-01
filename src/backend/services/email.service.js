import { createEmailTransporter, defaultSender, isSmtpConfigured } from '../config/email.js';
import {
  getOtpEmailTemplate,
  getWelcomeEmailTemplate,
  getPasswordResetOtpTemplate,
  getPasswordChangeOtpTemplate,
  getPasswordChangedNotificationTemplate,
} from './emailTemplates.js';

class EmailService {
  constructor() {
    this.transporter = createEmailTransporter();
  }

  /**
   * Helper to refresh transporter if environment changed
   */
  getTransporter() {
    if (!this.transporter && isSmtpConfigured()) {
      this.transporter = createEmailTransporter();
    }
    return this.transporter;
  }

  /**
   * Send 6-digit OTP verification email for account activation
   */
  async sendOtpEmail({ to, name, otp }) {
    const transporter = this.getTransporter();

    console.log('\n' + '='.repeat(60));
    console.log(`📨 [TraceMind OTP Email - Account Verification]`);
    console.log(`👤 Recipient: ${to} (${name || 'User'})`);
    console.log(`🔑 6-Digit OTP Code: >>> ${otp} <<<`);
    console.log(`⏱️ Expires in: 10 minutes`);
    console.log('='.repeat(60) + '\n');

    if (!transporter) {
      console.log('ℹ️  SMTP is not configured. Email logged to console above for local testing.');
      return { success: true, mode: 'console' };
    }

    try {
      const htmlContent = getOtpEmailTemplate({ name, otp, expiresInMinutes: 10 });

      const info = await transporter.sendMail({
        from: `"${defaultSender.name}" <${defaultSender.address}>`,
        to,
        subject: `Your TraceMind Verification Code: ${otp}`,
        text: `Hello ${name || 'User'},\n\nYour TraceMind verification code is: ${otp}\n\nThis code will expire in 10 minutes.`,
        html: htmlContent,
      });

      console.log(`✅ [TraceMind Email] OTP delivered to ${to} (Message ID: ${info.messageId})`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error(`❌ [TraceMind Email] Failed to send OTP email to ${to}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send 6-digit OTP verification email for Password Reset (Forgot Password)
   */
  async sendPasswordResetOtpEmail({ to, name, otp }) {
    const transporter = this.getTransporter();

    console.log('\n' + '='.repeat(60));
    console.log(`🔒 [TraceMind OTP Email - PASSWORD RESET]`);
    console.log(`👤 Recipient: ${to} (${name || 'User'})`);
    console.log(`🔑 6-Digit Reset Code: >>> ${otp} <<<`);
    console.log(`⏱️ Expires in: 10 minutes | Max attempts: 5`);
    console.log('='.repeat(60) + '\n');

    if (!transporter) {
      console.log('ℹ️  SMTP is not configured. Reset OTP logged to console for testing.');
      return { success: true, mode: 'console' };
    }

    try {
      const htmlContent = getPasswordResetOtpTemplate({ name, otp, expiresInMinutes: 10 });

      const info = await transporter.sendMail({
        from: `"${defaultSender.name}" <${defaultSender.address}>`,
        to,
        subject: `TraceMind Password Reset Code: ${otp}`,
        text: `Hello ${name || 'User'},\n\nYour password reset code is: ${otp}\n\nThis code will expire in 10 minutes.\n\nTraceMind Document Intelligence`,
        html: htmlContent,
      });

      console.log(`✅ [TraceMind Email] Password reset OTP delivered to ${to} (Message ID: ${info.messageId})`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error(`❌ [TraceMind Email] Failed to send password reset OTP to ${to}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send 6-digit OTP verification email for In-App Password Change
   */
  async sendPasswordChangeOtpEmail({ to, name, otp }) {
    const transporter = this.getTransporter();

    console.log('\n' + '='.repeat(60));
    console.log(`🛡️ [TraceMind OTP Email - PASSWORD CHANGE AUTHORIZATION]`);
    console.log(`👤 Recipient: ${to} (${name || 'User'})`);
    console.log(`🔑 6-Digit Authorization Code: >>> ${otp} <<<`);
    console.log(`⏱️ Expires in: 10 minutes | Max attempts: 5`);
    console.log('='.repeat(60) + '\n');

    if (!transporter) {
      console.log('ℹ️  SMTP is not configured. Change Password OTP logged to console.');
      return { success: true, mode: 'console' };
    }

    try {
      const htmlContent = getPasswordChangeOtpTemplate({ name, otp, expiresInMinutes: 10 });

      const info = await transporter.sendMail({
        from: `"${defaultSender.name}" <${defaultSender.address}>`,
        to,
        subject: `Authorize Password Change: ${otp}`,
        text: `Hello ${name || 'User'},\n\nYour authorization code to change your TraceMind password is: ${otp}\n\nThis code will expire in 10 minutes.`,
        html: htmlContent,
      });

      console.log(`✅ [TraceMind Email] Password change OTP delivered to ${to} (Message ID: ${info.messageId})`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error(`❌ [TraceMind Email] Failed to send password change OTP to ${to}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send confirmation notification after password has been successfully reset or changed
   */
  async sendPasswordChangedNotification({ to, name, actionType = 'updated' }) {
    const transporter = this.getTransporter();
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

    console.log('\n' + '='.repeat(60));
    console.log(`🔔 [TraceMind Email - PASSWORD ${actionType.toUpperCase()} CONFIRMATION]`);
    console.log(`👤 Recipient: ${to} (${name || 'User'})`);
    console.log(`🔒 Action: Password successfully ${actionType === 'reset' ? 'reset' : 'updated'}`);
    console.log(`⏱️ Timestamp: ${new Date().toISOString()}`);
    console.log('='.repeat(60) + '\n');

    if (!transporter) {
      console.log('ℹ️  SMTP is not configured. Password update notification logged to console for testing.');
      return { success: true, mode: 'console' };
    }

    try {
      const htmlContent = getPasswordChangedNotificationTemplate({ name, clientUrl, actionType });

      const info = await transporter.sendMail({
        from: `"${defaultSender.name}" <${defaultSender.address}>`,
        to,
        subject: `Your TraceMind Password Was Successfully ${actionType === 'reset' ? 'Reset' : 'Updated'}`,
        text: `Hello ${name || 'User'},\n\nYour TraceMind password was ${actionType === 'reset' ? 'reset via verification code' : 'updated from your account profile'}.\n\nIf you did not make this change, please reset your password immediately at ${clientUrl}/forgot-password`,
        html: htmlContent,
      });

      console.log(`✅ [TraceMind Email] Password update confirmation delivered to ${to} (Message ID: ${info.messageId})`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error(`❌ [TraceMind Email] Failed to send password update confirmation to ${to}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send Welcome Onboarding Email after email verification
   */
  async sendWelcomeEmail({ to, name }) {
    const transporter = this.getTransporter();
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

    console.log(`🎉 [TraceMind Email] Sending Welcome email to: ${to} (${name})`);

    if (!transporter) {
      console.log('ℹ️  SMTP is not configured. Welcome email simulated in console.');
      return { success: true, mode: 'console' };
    }

    try {
      const htmlContent = getWelcomeEmailTemplate({ name, clientUrl });

      const info = await transporter.sendMail({
        from: `"${defaultSender.name}" <${defaultSender.address}>`,
        to,
        subject: `Welcome to TraceMind AI Document Intelligence! 🚀`,
        text: `Hello ${name || 'User'},\n\nWelcome to TraceMind! Your email has been verified and your workspace is now active.\n\nGet started at: ${clientUrl}/chat`,
        html: htmlContent,
      });

      console.log(`✅ [TraceMind Email] Welcome email delivered to ${to} (Message ID: ${info.messageId})`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error(`❌ [TraceMind Email] Failed to send Welcome email to ${to}:`, error.message);
      return { success: false, error: error.message };
    }
  }
}

export const emailService = new EmailService();
export default emailService;
