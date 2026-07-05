import type { TopicId } from "./questions";

export interface TopicMeta {
  id: TopicId;
  label: string;
  short: string;
  /** chart color token index 1..8 used by analytics */
  tone: string;
  blurb: string;
}

export const TOPICS: TopicMeta[] = [
  {
    id: "trauma",
    label: "Abdominal Trauma & Polytrauma",
    short: "Trauma",
    tone: "var(--viz-1)",
    blurb: "Open vs closed injuries, polytrauma.",
  },
  {
    id: "hernia-lap",
    label: "Hernias & Laparotomy",
    short: "Hernia",
    tone: "var(--viz-2)",
    blurb: "Inguinal/incisional hernias, operative principles.",
  },
  {
    id: "acute-abdomen",
    label: "Peritonitis, Abscess & Acute Abdomen",
    short: "Acute abdomen",
    tone: "var(--viz-3)",
    blurb: "Peritonitis, intra-abdominal abscess, acute abdomen.",
  },
  {
    id: "pancreas",
    label: "Pancreatitis & Pancreatic Tumours",
    short: "Pancreas",
    tone: "var(--viz-4)",
    blurb: "Acute/chronic pancreatitis, tumours, injuries.",
  },
  {
    id: "spleen-adrenal",
    label: "Spleen & Adrenal Surgery",
    short: "Spleen/Adrenal",
    tone: "var(--viz-5)",
    blurb: "Splenic injury/indications, adrenal tumours.",
  },
  {
    id: "ulcer-gastric",
    label: "Peptic Ulcer & Gastric Tumours",
    short: "Ulcer/Gastric",
    tone: "var(--viz-6)",
    blurb: "Ulcer complications, gastric cancer, Z-E syndrome.",
  },
  {
    id: "small-bowel",
    label: "Small Bowel & Neuroendocrine",
    short: "Small bowel",
    tone: "var(--viz-7)",
    blurb: "Obstruction, short-bowel, carcinoid, polyposis.",
  },
  {
    id: "crohn-meckel",
    label: "Crohn Disease & Meckel Diverticulum",
    short: "Crohn/Meckel",
    tone: "var(--viz-8)",
    blurb: "Crohn disease, Meckel diverticulum.",
  },
  {
    id: "appendix",
    label: "Appendicitis",
    short: "Appendix",
    tone: "var(--viz-1)",
    blurb: "Acute appendicitis and its complications.",
  },
  {
    id: "liver",
    label: "Liver Disease, Tumours & Transplantation",
    short: "Liver",
    tone: "var(--viz-2)",
    blurb: "Echinococcosis, injury, tumours, transplant.",
  },
  {
    id: "biliary",
    label: "Biliary Tract & Gallbladder",
    short: "Biliary",
    tone: "var(--viz-3)",
    blurb: "Cholecystitis, Mirizzi, biliary ileus, cancer.",
  },
  {
    id: "colorectal",
    label: "Colon, Rectum & Anal",
    short: "Colorectal",
    tone: "var(--viz-4)",
    blurb: "Colitis, diverticula, carcinoma, anorectal.",
  },
  {
    id: "transfusion",
    label: "Blood Transfusion",
    short: "Transfusion",
    tone: "var(--viz-5)",
    blurb: "Donation, screening, blood components.",
  },
];

export const TOPIC_BY_ID: Record<TopicId, TopicMeta> = Object.fromEntries(
  TOPICS.map((t) => [t.id, t]),
) as Record<TopicId, TopicMeta>;
