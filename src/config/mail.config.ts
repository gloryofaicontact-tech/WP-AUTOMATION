import { registerAs } from '@nestjs/config';

export interface MailConfig {
  host?: string;
  port: number;
  user?: string;
  password?: string;
  from: string;
  fromName: string;
  secure: boolean;
}

export default registerAs('mail', (): MailConfig => ({
  host: process.env.MAIL_HOST || '',
  port: parseInt(process.env.MAIL_PORT || '587', 10),
  user: process.env.MAIL_USERNAME || '',
  password: process.env.MAIL_PASSWORD || '',
  from: process.env.MAIL_FROM_ADDRESS || 'noreply@wpautomation.com',
  fromName: process.env.MAIL_FROM_NAME || 'WP Blog Automation',
  secure: process.env.SMTP_SECURE === 'true',
}));
