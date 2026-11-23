import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly fromName: string;
  private readonly fromAddress: string;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('mail.host');
    const port = this.configService.get<number>('mail.port', 587);
    const user = this.configService.get<string>('mail.user');
    const pass = this.configService.get<string>('mail.password');
    const secure = this.configService.get<boolean>('mail.secure', false);

    this.fromName = this.configService.get<string>('mail.fromName', 'WP Automation');
    this.fromAddress = this.configService.get<string>('mail.from', 'noreply@wpautomation.com');

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
      });
      this.logger.log(`Mail transporter initialized for host: ${host}`);
    } else {
      this.logger.warn('SMTP credentials not configured. Outgoing emails will be logged to console.');
    }
  }

  async sendMail(options: SendMailOptions): Promise<boolean> {
    const from = `"${this.fromName}" <${this.fromAddress}>`;

    if (!this.transporter) {
      this.logger.log(`[Email Mock Dispatch]
To: ${options.to}
From: ${from}
Subject: ${options.subject}
Content: ${options.text || options.html}`);
      return true;
    }

    try {
      await this.transporter.sendMail({
        from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });
      this.logger.log(`Email successfully sent to ${options.to}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${options.to}`, error);
      return false;
    }
  }

  async sendWelcomeEmail(to: string, name: string): Promise<boolean> {
    const subject = `Welcome to WP Blog Automation, ${name}!`;
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2b6cb0;">Welcome to WP Blog Automation</h2>
        <p>Hi <strong>${name}</strong>,</p>
        <p>Your account has been successfully created. You can now access your dashboard and start managing your automated blog content.</p>
        <p>Best regards,<br>The WP Automation Team</p>
      </div>
    `;
    return this.sendMail({ to, subject, html, text: `Welcome to WP Blog Automation, ${name}!` });
  }

  async sendPasswordResetEmail(to: string, resetToken: string): Promise<boolean> {
    const subject = 'Password Reset Request - WP Blog Automation';
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #c53030;">Password Reset Request</h2>
        <p>We received a request to reset your password. Use the token below to complete the reset process:</p>
        <div style="background-color: #f7fafc; padding: 15px; border-radius: 6px; font-size: 18px; font-weight: bold; letter-spacing: 2px; text-align: center; margin: 20px 0;">
          ${resetToken}
        </div>
        <p style="color: #718096; font-size: 14px;">This code will expire in 1 hour. If you did not request this, please ignore this email.</p>
      </div>
    `;
    return this.sendMail({
      to,
      subject,
      html,
      text: `Your password reset token is: ${resetToken}. This token expires in 1 hour.`,
    });
  }

  async sendEmailVerification(to: string, verifyToken: string): Promise<boolean> {
    const subject = 'Verify Your Email - WP Blog Automation';
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2b6cb0;">Verify Your Email Address</h2>
        <p>Thank you for registering. Please use the verification code below to verify your email address:</p>
        <div style="background-color: #ebf8ff; padding: 15px; border-radius: 6px; font-size: 18px; font-weight: bold; letter-spacing: 2px; text-align: center; margin: 20px 0; color: #2b6cb0;">
          ${verifyToken}
        </div>
        <p style="color: #718096; font-size: 14px;">This code will expire in 24 hours.</p>
      </div>
    `;
    return this.sendMail({
      to,
      subject,
      html,
      text: `Your email verification code is: ${verifyToken}.`,
    });
  }

  async sendInvitationEmail(to: string, role: string, inviteToken: string): Promise<boolean> {
    const subject = `You have been invited to WP Blog Automation as ${role}`;
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2b6cb0;">You are Invited!</h2>
        <p>You have been invited to join WP Blog Automation as a <strong>${role}</strong>.</p>
        <p>Please use this activation code to complete your account setup:</p>
        <div style="background-color: #f7fafc; padding: 15px; border-radius: 6px; font-size: 18px; font-weight: bold; letter-spacing: 2px; text-align: center; margin: 20px 0;">
          ${inviteToken}
        </div>
      </div>
    `;
    return this.sendMail({
      to,
      subject,
      html,
      text: `You have been invited to WP Blog Automation as ${role}. Use token: ${inviteToken} to set up your account.`,
    });
  }
}
