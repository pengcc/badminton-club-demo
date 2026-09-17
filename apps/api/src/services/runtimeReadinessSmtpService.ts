import type { Transporter } from 'nodemailer';

interface SmtpConfiguration {
  host?: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from?: string;
}

interface SmtpTransportFactory {
  (options: {
    host: string;
    port: number;
    secure: boolean;
    auth: { user: string; pass: string };
  }): Pick<Transporter, 'verify' | 'close'>;
}

export async function inspectConfiguredSmtp(
  smtp: SmtpConfiguration,
  verifyTransport: boolean,
  createTransport: SmtpTransportFactory
): Promise<{ configured: boolean; verified: boolean }> {
  const configured = Boolean(
    smtp.host &&
      smtp.user &&
      smtp.pass &&
      smtp.from &&
      Number.isInteger(smtp.port)
  );
  if (!configured || !verifyTransport) return { configured, verified: false };

  const transporter = createTransport({
    host: smtp.host!,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user!, pass: smtp.pass! },
  });
  try {
    await transporter.verify();
  } finally {
    transporter.close();
  }
  return { configured: true, verified: true };
}
