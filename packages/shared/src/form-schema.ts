/**
 * Canonical schema of the Tevel PTW Monday form.
 *
 * Source: https://forms.monday.com/forms/10a9b1154e8e65b9db479776224827a5?r=euc1
 *
 * This file is the single source of truth used by:
 *   - the React form (UI generation + validation)
 *   - the API (payload validation + storage)
 *   - the Playwright submitter (field-by-field filling)
 *   - the schema-guard worker (compares this snapshot to a fresh DOM scrape)
 *
 * If Tevel changes the form, the guard will block submissions until an admin
 * updates this file and approves the new schema version.
 */

export type FieldType =
  | 'datetime'
  | 'date_range'
  | 'dropdown'
  | 'multi_select'
  | 'radio_yes_no'
  | 'long_text'
  | 'short_text'
  | 'email'
  | 'phone'
  | 'file'
  | 'checkbox_group'
  | 'signature_name';

export interface SelectOption {
  value: string;
  labelHe: string;
  labelEn: string;
}

export interface FormField {
  /** Internal stable id used in our DB payload_json. */
  id: string;
  /** Monday form widget id (data-testid prefix in DOM). */
  mondayId: string;
  type: FieldType;
  labelHe: string;
  labelEn: string;
  required: boolean;
  description?: string;
  options?: SelectOption[];
  maxLength?: number;
  /** Helper text shown to the user in our UI. */
  helpHe?: string;
}

/**
 * NOTE: dropdown options for fields marked TODO must be filled by an admin
 * before submissions can succeed. The schema-guard worker will scrape and
 * suggest them automatically once it runs.
 */
export const tevelFormSchema: FormField[] = [
  {
    id: 'applicationDate',
    mondayId: 'date_mkt8gjg4',
    type: 'datetime',
    labelHe: 'תאריך הגשת הבקשה',
    labelEn: 'Application date',
    required: true,
  },
  {
    id: 'contractor',
    mondayId: 'dropdown_mkwht0bk',
    type: 'dropdown',
    labelHe: 'קבלן מבצע',
    labelEn: 'Contractor',
    required: true,
    options: [], // TODO: fill from schema-guard scrape
  },
  {
    id: 'workStart',
    mondayId: 'date_mkt89s2z',
    type: 'datetime',
    labelHe: 'תאריך ושעת ביצוע עבודה - התחלה',
    labelEn: 'Date and time of work execution - start',
    required: true,
  },
  {
    id: 'workEnd',
    mondayId: 'date_mkt8y1ye',
    type: 'datetime',
    labelHe: 'תאריך ושעת ביצוע עבודה - סיום',
    labelEn: 'Date and time of work execution - finish',
    required: true,
    helpHe: 'אישור העבודה תקף רק בטווח התאריכים הרשומים ובכל יום בין שעות ההתחלה והסיום',
  },
  {
    id: 'dateRangeConfirm',
    mondayId: 'date_rangespf1l905',
    type: 'date_range',
    labelHe: 'אישור טווח התאריכים',
    labelEn: 'Confirm date range',
    required: true,
    helpHe: 'נמלא אוטומטית מהתאריכים שלמעלה',
  },
  {
    id: 'workPeriod',
    mondayId: 'multi_selectn0iyc2my',
    type: 'multi_select',
    labelHe: 'שעות עבודה',
    labelEn: 'Work Period',
    required: true,
    options: [], // TODO: fill from schema-guard scrape
  },
  {
    id: 'ohleDisconnection',
    mondayId: 'single_select39jnk2c',
    type: 'radio_yes_no',
    labelHe: 'האם נדרש ניתוק וקיצור של מערכת חשמול OHLE',
    labelEn: 'OHLE power disconnection and grounding is required',
    required: true,
  },
  {
    id: 'turnoutShift',
    mondayId: 'single_selectynx93hf',
    type: 'radio_yes_no',
    labelHe: 'האם נדרשת הזזת מפלג',
    labelEn: 'Turnout shift required',
    required: true,
  },
  {
    id: 'trainImpact',
    mondayId: 'single_selectw3daunz',
    type: 'radio_yes_no',
    labelHe: 'השפעה על תנועת רכבות',
    labelEn: 'Implication on Train movements',
    required: true,
  },
  {
    id: 'workType',
    mondayId: 'color_mkt8y109',
    type: 'dropdown',
    labelHe: 'סוג עבודה',
    labelEn: 'Type of work',
    required: true,
    options: [], // TODO
  },
  {
    id: 'workSite',
    mondayId: 'dropdown_mkt8hrxn',
    type: 'dropdown',
    labelHe: 'אתר העבודה',
    labelEn: 'Work site',
    required: true,
    options: [], // TODO
  },
  {
    id: 'itWorkRequired',
    mondayId: 'single_selectlzi25fv',
    type: 'radio_yes_no',
    labelHe: 'האם קיים צורך בעבודות מערכות מידע',
    labelEn: 'Does IT work required',
    required: true,
  },
  {
    id: 'locationDetails',
    mondayId: 'long_textfo40j7lt',
    type: 'long_text',
    labelHe: 'פירוט מיקום/מקטע העבודה',
    labelEn: 'Location/Section of work',
    required: false,
    maxLength: 2000,
    helpHe: 'תחנות, חדרים, מקטע מסילה',
  },
  {
    id: 'workDescription',
    mondayId: 'long_text_mkt86dts',
    type: 'long_text',
    labelHe: 'תיאור העבודה',
    labelEn: 'Work description',
    required: true,
    maxLength: 2000,
  },
  {
    id: 'documents',
    mondayId: 'fileokuwfivn',
    type: 'file',
    labelHe: 'נוהל עבודה / מסמכים רלוונטיים',
    labelEn: 'Method Statement / Related documents',
    required: false,
  },
  {
    id: 'mmisReference',
    mondayId: 'multi_select3tr1conz',
    type: 'checkbox_group',
    labelHe: 'סימוכין',
    labelEn: 'MMIS reference',
    required: false,
    options: [
      { value: 'SR', labelHe: 'SR', labelEn: 'SR' },
      { value: 'WO', labelHe: 'WO', labelEn: 'WO' },
      { value: 'PM', labelHe: 'PM', labelEn: 'PM' },
    ],
  },
  {
    id: 'highRiskType',
    mondayId: 'dropdown_mkt824bf',
    type: 'dropdown',
    labelHe: 'עבודות בסיכון גבוה - סוג העבודה',
    labelEn: 'High-risk jobs - type of work',
    required: true,
    options: [], // TODO
  },
  {
    id: 'teamLeaderName',
    mondayId: 'short_text1xmalvr7',
    type: 'short_text',
    labelHe: 'ראש צוות הקבלן - שם מלא',
    labelEn: 'Contractor Team Leader - Full Name',
    required: true,
  },
  {
    id: 'teamLeaderRole',
    mondayId: 'text_mkt86mzk',
    type: 'short_text',
    labelHe: 'ראש צוות הקבלן - תפקיד',
    labelEn: 'Contractor Team Leader - Position',
    required: true,
  },
  {
    id: 'teamLeaderPhone',
    mondayId: 'phone_mkt8meqd',
    type: 'phone',
    labelHe: 'ראש צוות הקבלן - נייד',
    labelEn: 'Contractor Team Leader - Mobile',
    required: true,
  },
  {
    id: 'secondaryContact',
    mondayId: 'long_textoec56rbo',
    type: 'long_text',
    labelHe: 'פרטי איש קשר משני',
    labelEn: 'Secondary Contact',
    required: false,
    maxLength: 2000,
  },
  {
    id: 'requesterName',
    mondayId: 'text_mkt89qez',
    type: 'short_text',
    labelHe: 'שם מגיש הבקשה',
    labelEn: 'Requester name',
    required: true,
  },
  {
    id: 'requesterEmail',
    mondayId: 'email_mkt81m91',
    type: 'email',
    labelHe: 'דוא"ל מגיש הבקשה',
    labelEn: 'Requester email',
    required: true,
  },
  {
    id: 'requesterSignature',
    mondayId: 'file_mkt8xw60',
    type: 'signature_name',
    labelHe: 'חתימת מגיש הבקשה',
    labelEn: 'Requester Signature',
    required: true,
    maxLength: 30,
    helpHe: 'הקלד שם מלא — ייחתם דיגיטלית בטופס תבל',
  },
];

/**
 * Stable hash of the schema structure (ids, types, required, options).
 * Used by the schema-guard to detect drift between code and live form.
 * Changing a label or help text does NOT change the hash.
 */
export function hashSchema(schema: FormField[] = tevelFormSchema): string {
  const stable = schema.map((f) => ({
    id: f.id,
    mondayId: f.mondayId,
    type: f.type,
    required: f.required,
    options: (f.options ?? []).map((o) => o.value).sort(),
  }));
  // simple deterministic hash (FNV-1a over JSON)
  const json = JSON.stringify(stable);
  let h = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export const SCHEMA_VERSION = hashSchema();
