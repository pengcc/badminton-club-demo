import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

// Page layout configuration
const PAGE_LAYOUT = {
  pageSize: [595, 842] as [number, number], // A4 size
  margins: {
    top: 50,
    bottom: 50,
    left: 50,
    right: 50
  },
  spacing: {
    paragraph: 30,
    line: 15,
    section: 40
  },
  fontSize: {
    header: 18,
    subheader: 14,
    body: 11,
    small: 10
  }
};

// Text wrapping utility
export const wrapTextToLines = (text: string, maxChars: number = 90): string[] => {
  const lines: string[] = [];
  let remainingText = text;

  while (remainingText.length > maxChars) {
    let breakIndex = remainingText.lastIndexOf(' ', maxChars);
    if (breakIndex <= 0) breakIndex = maxChars;

    lines.push(remainingText.slice(0, breakIndex).trim());
    remainingText = remainingText.slice(breakIndex).trim();
  }

  if (remainingText) lines.push(remainingText);
  return lines;
};

// Type definitions for form data
export interface PersonalInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  address: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };
}

export interface BankingInfo {
  accountHolder: string;
  iban: string;
  bic?: string;
  bankName: string;
  accountHolderAddress: string;
}

export interface MembershipApplicationData {
  personalInfo: PersonalInfo;
  membershipType: string;
  motivation?: string;
  bankingInfo?: BankingInfo;
}

export class PDFService {
  private static readonly TEXTS = {
    de: {
      membershipApplication: {
        header: 'Aufnahmeantrag',
        subtitle: 'Badminton Demo Club e.V.',
        introduction: 'Hiermit beantrage ich die Mitgliedschaft im Badminton Demo Club e.V. Die folgenden Angaben sind für die Durchführung des Mitgliedschaftsverhältnisses erforderlich.',
        personalInfo: 'Persönliche Angaben',
        membershipInfo: 'Mitgliedschaft',
        membershipFee: {
          title: 'Mitgliedsbetrag',
          text: 'Der Mitgliedsbeitrag wird mittels SEPA-Lastschriftmandat eingezogen. Das Formular für das SEPA-Lastschriftmandat und die Beitragsordnung finden Sie unter club-demo.de/#documents.'
        },
        checklist: [
          'Die Datenschutzhinweise in der Anlage 1 (unter club-demo.de/#documents) habe ich erhalten und zur Kenntnis genommen.',
          'Ich bin mit dem Verein hinsichtlich der Nutzung und Zuweisung von Hallen für die Mitglieder einverstanden.',
          'Mit meiner Unterschrift erkenne ich die Satzung und Ordnungen des Vereins in der jeweils gültigen Fassung an.'
        ],
        signature: {
          date: 'Ort, Datum',
          signature: 'Unterschrift'
        }
      },
      sepaMandate: {
        header: 'SEPA-Basis-Lastschriftmandat',
        introduction: 'Ich ermächtige (Wir ermächtigen) Badminton Demo Club, Zahlungen von meinem (unserem) Konto mittels Lastschrift einzuziehen. Zugleich weise ich mein (weisen wir unser) Kreditinstitut an, die von Badminton Demo Club auf mein (unser) Konto gezogenen Lastschriften einzulösen.',
        notice: {
          title: 'Hinweis',
          text: 'Ich kann (Wir können) innerhalb von acht Wochen, beginnend mit dem Belastungsdatum, die Erstattung des belasteten Betrages verlangen. Es gelten dabei die mit meinem (unserem) Kreditinstitut vereinbarten Bedingungen.'
        },
        paymentFrequency: {
          title: 'Zahlungsweise',
          quarterly: 'vierteljährlich',
          annually: 'jährlich (Bei jährlicher Zahlungsweise reduziert sich der Jahresbeitrag. Siehe Beitragsordnung)'
        },
        accountHolder: 'Vorname und Nachname des Kontoinhabers',
        accountHolderAddress: 'Anschrift (wenn abweichend vom Antragsteller)',
        signature: {
          date: 'Ort, Datum',
          signature: 'Unterschrift'
        }
      },
      genderMap: {
        male: 'männlich',
        female: 'weiblich',
        other: 'andere'
      } as Record<string, string>,
      membershipTypeMap: {
        regular: 'Reguläre Mitgliedschaft',
        student: 'Studentenmitgliedschaft'
      } as Record<string, string>
    }
  };

  // Getter for backward compatibility
  private static get GERMAN_TEXTS() {
    return this.TEXTS.de;
  }

  /**
   * Create membership application PDF (German only)
   */
  public static async createMembershipApplicationPDF(data: MembershipApplicationData): Promise<Buffer> {
    try {
      const pdfDoc = await PDFDocument.create();
      pdfDoc.registerFontkit(fontkit);

      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // Create main application page
      await this.createApplicationPage(pdfDoc, data, helveticaFont, helveticaBold);

      return Buffer.from(await pdfDoc.save());
    } catch (error) {
      throw new Error(`Failed to create membership application PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create SEPA mandate PDF (German only)
   */
  public static async createSEPAMandatePDF(personalInfo: PersonalInfo, bankingInfo: BankingInfo): Promise<Buffer> {
    try {
      const pdfDoc = await PDFDocument.create();
      pdfDoc.registerFontkit(fontkit);

      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      await this.createSEPAMandatePage(pdfDoc, personalInfo, bankingInfo, helveticaFont, helveticaBold);

      return Buffer.from(await pdfDoc.save());
    } catch (error) {
      throw new Error(`Failed to create SEPA mandate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create the main application page (German only)
   */
  private static async createApplicationPage(
    pdfDoc: PDFDocument,
    data: MembershipApplicationData,
    helveticaFont: any,
    helveticaBold: any
  ): Promise<void> {
    const page = pdfDoc.addPage(PAGE_LAYOUT.pageSize);
    const form = pdfDoc.getForm();
    const { width, height } = page.getSize();

    let yPosition = height - PAGE_LAYOUT.margins.top;
    const texts = this.TEXTS.de.membershipApplication;

    // Header
    page.drawText(texts.header.toUpperCase(), {
      x: PAGE_LAYOUT.margins.left,
      y: yPosition,
      size: PAGE_LAYOUT.fontSize.header,
      font: helveticaBold
    });

    yPosition -= PAGE_LAYOUT.spacing.line;
    page.drawText(texts.subtitle, {
      x: PAGE_LAYOUT.margins.left,
      y: yPosition,
      size: PAGE_LAYOUT.fontSize.body,
      font: helveticaFont
    });

    yPosition -= PAGE_LAYOUT.spacing.section;

    // Introduction
    const introLines = wrapTextToLines(texts.introduction);
    introLines.forEach(line => {
      page.drawText(line, {
        x: PAGE_LAYOUT.margins.left,
        y: yPosition,
        size: PAGE_LAYOUT.fontSize.body,
        font: helveticaFont
      });
      yPosition -= PAGE_LAYOUT.spacing.line;
    });

    yPosition -= PAGE_LAYOUT.spacing.paragraph;

    // Personal Information
    page.drawText(texts.personalInfo, {
      x: PAGE_LAYOUT.margins.left,
      y: yPosition,
      size: PAGE_LAYOUT.fontSize.subheader,
      font: helveticaBold
    });

    yPosition -= PAGE_LAYOUT.spacing.paragraph;

    // Personal data fields
    const dob = new Date(`${data.personalInfo.dateOfBirth}T00:00:00Z`);
    const dobDisplay = isNaN(dob.getTime())
      ? data.personalInfo.dateOfBirth
      : dob.toLocaleDateString('de-DE');

    const personalData = [
      ['Vorname:', data.personalInfo.firstName],
      ['Name:', data.personalInfo.lastName],
      ['E-Mail:', data.personalInfo.email],
      ['Telefon:', data.personalInfo.phone],
      ['Geburtsdatum:', dobDisplay],
      ['Geschlecht:', this.GERMAN_TEXTS.genderMap[data.personalInfo.gender] || data.personalInfo.gender],
      ['Anschrift:', `${data.personalInfo.address.street}, ${data.personalInfo.address.postalCode} ${data.personalInfo.address.city}, ${data.personalInfo.address.country}`]
    ];

    personalData.forEach(([label, value]) => {
      page.drawText(label, {
        x: PAGE_LAYOUT.margins.left,
        y: yPosition,
        size: PAGE_LAYOUT.fontSize.body,
        font: helveticaBold
      });

      const textIndent = PAGE_LAYOUT.margins.left + 100;
      page.drawText(value, {
        x: textIndent,
        y: yPosition,
        size: PAGE_LAYOUT.fontSize.body,
        font: helveticaFont
      });

      // Underline for signature
      page.drawLine({
        start: { x: textIndent, y: yPosition - 2 },
        end: { x: width - PAGE_LAYOUT.margins.right, y: yPosition - 2 },
        thickness: 1
      });

      yPosition -= 25;
    });

    yPosition -= PAGE_LAYOUT.spacing.paragraph;

    // Membership type
    page.drawText('Mitgliedschaftsart:', {
      x: PAGE_LAYOUT.margins.left,
      y: yPosition,
      size: PAGE_LAYOUT.fontSize.body,
      font: helveticaBold
    });

    const membershipType = this.GERMAN_TEXTS.membershipTypeMap[data.membershipType] || data.membershipType;
    page.drawText(membershipType, {
      x: PAGE_LAYOUT.margins.left + 120,
      y: yPosition,
      size: PAGE_LAYOUT.fontSize.body,
      font: helveticaFont
    });

    yPosition -= PAGE_LAYOUT.spacing.section;

    // Checklist
    texts.checklist.forEach((item, index) => {
      const checkBox = form.createCheckBox(`checkbox_${index}`);
      checkBox.addToPage(page, {
        x: PAGE_LAYOUT.margins.left,
        y: yPosition - 2,
        width: 12,
        height: 12,
        borderWidth: 1
      });
      checkBox.check();

      const itemLines = wrapTextToLines(item, 85);
      itemLines.forEach(line => {
        page.drawText(line, {
          x: PAGE_LAYOUT.margins.left + 20,
          y: yPosition,
          size: PAGE_LAYOUT.fontSize.body,
          font: helveticaFont
        });
        yPosition -= PAGE_LAYOUT.spacing.line;
      });
      yPosition -= PAGE_LAYOUT.spacing.line / 2;
    });

    // Signature section
    yPosition -= PAGE_LAYOUT.spacing.section;

    // Date signature line
    page.drawLine({
      start: { x: PAGE_LAYOUT.margins.left, y: yPosition },
      end: { x: PAGE_LAYOUT.margins.left + 180, y: yPosition },
      thickness: 1
    });
    page.drawText(texts.signature.date, {
      x: PAGE_LAYOUT.margins.left,
      y: yPosition - 15,
      size: PAGE_LAYOUT.fontSize.body,
      font: helveticaFont
    });

    // Signature line
    page.drawLine({
      start: { x: width - PAGE_LAYOUT.margins.right - 180, y: yPosition },
      end: { x: width - PAGE_LAYOUT.margins.right, y: yPosition },
      thickness: 1
    });
    page.drawText(texts.signature.signature, {
      x: width - PAGE_LAYOUT.margins.right - 180,
      y: yPosition - 15,
      size: PAGE_LAYOUT.fontSize.body,
      font: helveticaFont
    });
  }

  /**
   * Create SEPA mandate page (German only)
   */
  private static async createSEPAMandatePage(
    pdfDoc: PDFDocument,
    personalInfo: PersonalInfo,
    bankingInfo: BankingInfo,
    helveticaFont: any,
    helveticaBold: any
  ): Promise<void> {
    const page = pdfDoc.addPage(PAGE_LAYOUT.pageSize);
    const form = pdfDoc.getForm();
    const { width, height } = page.getSize();

    let yPosition = height - PAGE_LAYOUT.margins.top;
    const texts = this.TEXTS.de.sepaMandate;

    // Header
    page.drawText(texts.header.toUpperCase(), {
      x: PAGE_LAYOUT.margins.left,
      y: yPosition,
      size: PAGE_LAYOUT.fontSize.header,
      font: helveticaBold
    });

    yPosition -= PAGE_LAYOUT.spacing.section;

    // Introduction
    const introLines = wrapTextToLines(texts.introduction);
    introLines.forEach(line => {
      page.drawText(line, {
        x: PAGE_LAYOUT.margins.left,
        y: yPosition,
        size: PAGE_LAYOUT.fontSize.body,
        font: helveticaFont
      });
      yPosition -= PAGE_LAYOUT.spacing.line;
    });

    yPosition -= PAGE_LAYOUT.spacing.paragraph;

    // Notice section
    page.drawText(`${texts.notice.title}:`, {
      x: PAGE_LAYOUT.margins.left,
      y: yPosition,
      size: PAGE_LAYOUT.fontSize.body,
      font: helveticaBold
    });

    yPosition -= PAGE_LAYOUT.spacing.line;

    const noticeLines = wrapTextToLines(texts.notice.text);
    noticeLines.forEach(line => {
      page.drawText(line, {
        x: PAGE_LAYOUT.margins.left,
        y: yPosition,
        size: PAGE_LAYOUT.fontSize.body,
        font: helveticaFont
      });
      yPosition -= PAGE_LAYOUT.spacing.line;
    });

    yPosition -= PAGE_LAYOUT.spacing.paragraph;

    // Payment frequency options
    page.drawText(`${texts.paymentFrequency.title}:`, {
      x: PAGE_LAYOUT.margins.left,
      y: yPosition,
      size: PAGE_LAYOUT.fontSize.body,
      font: helveticaBold
    });

    yPosition -= PAGE_LAYOUT.spacing.line;

    const radioGroup = form.createRadioGroup('zahlungsweise');

    // Quarterly option
    radioGroup.addOptionToPage('quarterly', page, {
      x: PAGE_LAYOUT.margins.left,
      y: yPosition - 2,
      width: 12,
      height: 12
    });
    page.drawText(texts.paymentFrequency.quarterly, {
      x: PAGE_LAYOUT.margins.left + 20,
      y: yPosition,
      size: PAGE_LAYOUT.fontSize.body,
      font: helveticaFont
    });

    yPosition -= PAGE_LAYOUT.spacing.line;

    // Annual option
    radioGroup.addOptionToPage('annually', page, {
      x: PAGE_LAYOUT.margins.left,
      y: yPosition - 2,
      width: 12,
      height: 12
    });

    const annualLines = wrapTextToLines(texts.paymentFrequency.annually);
    annualLines.forEach(line => {
      page.drawText(line, {
        x: PAGE_LAYOUT.margins.left + 20,
        y: yPosition,
        size: PAGE_LAYOUT.fontSize.body,
        font: helveticaFont
      });
      yPosition -= PAGE_LAYOUT.spacing.line;
    });

    // Default selection
    radioGroup.select('quarterly');

    yPosition -= PAGE_LAYOUT.spacing.paragraph;

    // Account holder information
    page.drawText(texts.accountHolder, {
      x: PAGE_LAYOUT.margins.left,
      y: yPosition,
      size: PAGE_LAYOUT.fontSize.body,
      font: helveticaBold
    });

    yPosition -= PAGE_LAYOUT.spacing.line;

    page.drawText(bankingInfo.accountHolder, {
      x: PAGE_LAYOUT.margins.left,
      y: yPosition,
      size: PAGE_LAYOUT.fontSize.body,
      font: helveticaFont
    });

    page.drawLine({
      start: { x: PAGE_LAYOUT.margins.left, y: yPosition - 2 },
      end: { x: width - PAGE_LAYOUT.margins.right, y: yPosition - 2 },
      thickness: 1
    });

    yPosition -= PAGE_LAYOUT.spacing.paragraph;

    // Account holder address
    page.drawText(texts.accountHolderAddress, {
      x: PAGE_LAYOUT.margins.left,
      y: yPosition,
      size: PAGE_LAYOUT.fontSize.body,
      font: helveticaBold
    });

    yPosition -= PAGE_LAYOUT.spacing.line;

    page.drawText(bankingInfo.accountHolderAddress, {
      x: PAGE_LAYOUT.margins.left,
      y: yPosition,
      size: PAGE_LAYOUT.fontSize.body,
      font: helveticaFont
    });

    page.drawLine({
      start: { x: PAGE_LAYOUT.margins.left, y: yPosition - 2 },
      end: { x: width - PAGE_LAYOUT.margins.right, y: yPosition - 2 },
      thickness: 1
    });

    yPosition -= PAGE_LAYOUT.spacing.paragraph;

    // Banking details
    const bankingData = [
      ['IBAN:', bankingInfo.iban],
      ['BIC:', bankingInfo.bic || ''],
      ['Bank:', bankingInfo.bankName]
    ];

    bankingData.forEach(([label, value]) => {
      page.drawText(label, {
        x: PAGE_LAYOUT.margins.left,
        y: yPosition,
        size: PAGE_LAYOUT.fontSize.body,
        font: helveticaBold
      });

      page.drawText(value, {
        x: PAGE_LAYOUT.margins.left + 80,
        y: yPosition,
        size: PAGE_LAYOUT.fontSize.body,
        font: helveticaFont
      });

      page.drawLine({
        start: { x: PAGE_LAYOUT.margins.left + 80, y: yPosition - 2 },
        end: { x: width - PAGE_LAYOUT.margins.right, y: yPosition - 2 },
        thickness: 1
      });

      yPosition -= 25;
    });

    // Signature section
    yPosition -= PAGE_LAYOUT.spacing.section;

    // Date signature line
    page.drawLine({
      start: { x: PAGE_LAYOUT.margins.left, y: yPosition },
      end: { x: PAGE_LAYOUT.margins.left + 180, y: yPosition },
      thickness: 1
    });
    page.drawText(texts.signature.date, {
      x: PAGE_LAYOUT.margins.left,
      y: yPosition - 15,
      size: PAGE_LAYOUT.fontSize.body,
      font: helveticaFont
    });

    // Signature line
    page.drawLine({
      start: { x: width - PAGE_LAYOUT.margins.right - 180, y: yPosition },
      end: { x: width - PAGE_LAYOUT.margins.right, y: yPosition },
      thickness: 1
    });
    page.drawText(texts.signature.signature, {
      x: width - PAGE_LAYOUT.margins.right - 180,
      y: yPosition - 15,
      size: PAGE_LAYOUT.fontSize.body,
      font: helveticaFont
    });
  }
}