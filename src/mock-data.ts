// src/mock-data.ts

export interface Trial {
  id: string;
  drug: string;
  company: string;
  phase: string;
  status: string;
}

export const mockTrials: Trial[] = [
  {
    id: '1',
    drug: 'Semaglutide',
    company: 'Novo Nordisk',
    phase: 'Phase 3',
    status: 'Active'
  },
  {
    id: '2',
    drug: 'Tirzepatide',
    company: 'Eli Lilly',
    phase: 'Phase 3',
    status: 'Active'
  },
  {
    id: '3',
    drug: 'Liraglutide',
    company: 'Novo Nordisk',
    phase: 'Phase 2',
    status: 'Completed'
  },
  {
    id: '4',
    drug: 'Drug Candidate X',
    company: 'Pfizer',
    phase: 'Phase 1',
    status: 'Recruiting'
  },
  {
    id: '5',
    drug: 'Insulin Analog A',
    company: 'Novo Nordisk',
    phase: 'Phase 3',
    status: 'Active'
  },
  {
    id: '6',
    drug: 'GLP-1 Variant B',
    company: 'Eli Lilly',
    phase: 'Phase 2',
    status: 'Active'
  },
  {
    id: '7',
    drug: 'Metformin XR',
    company: 'Generic',
    phase: 'Phase 4',
    status: 'Completed'
  },
  {
    id: '8',
    drug: 'SGLT2 Inhibitor C',
    company: 'AstraZeneca',
    phase: 'Phase 2',
    status: 'Active'
  },
  {
    id: '9',
    drug: 'DPP-4 Inhibitor D',
    company: 'Merck',
    phase: 'Phase 3',
    status: 'Active'
  },
  {
    id: '10',
    drug: 'Basal Insulin E',
    company: 'Sanofi',
    phase: 'Phase 3',
    status: 'Active'
  },
  {
    id: '11',
    drug: 'GLP-1/GIP Dual Agonist',
    company: 'Eli Lilly',
    phase: 'Phase 2',
    status: 'Recruiting'
  },
  {
    id: '12',
    drug: 'Novel Beta Cell Therapy',
    company: 'Johnson & Johnson',
    phase: 'Phase 1',
    status: 'Active'
  },
  {
    id: '13',
    drug: 'Oral Semaglutide',
    company: 'Novo Nordisk',
    phase: 'Phase 3',
    status: 'Completed'
  },
  {
    id: '14',
    drug: 'SGLT1/2 Dual Inhibitor',
    company: 'Boehringer Ingelheim',
    phase: 'Phase 2',
    status: 'Active'
  },
  {
    id: '15',
    drug: 'Glucagon Receptor Antagonist',
    company: 'Pfizer',
    phase: 'Phase 1',
    status: 'Recruiting'
  },
  {
    id: '16',
    drug: 'Smart Insulin Patch',
    company: 'Medtronic',
    phase: 'Phase 2',
    status: 'Active'
  },
  {
    id: '17',
    drug: 'Gene Therapy GT-101',
    company: 'Vertex Pharmaceuticals',
    phase: 'Phase 1',
    status: 'Recruiting'
  },
  {
    id: '18',
    drug: 'FGF21 Analog',
    company: 'AstraZeneca',
    phase: 'Phase 2',
    status: 'Active'
  },
  {
    id: '19',
    drug: 'Amylin Analog',
    company: 'AstraZeneca',
    phase: 'Phase 3',
    status: 'Active'
  },
  {
    id: '20',
    drug: 'Mitochondrial Therapy',
    company: 'Sanofi',
    phase: 'Phase 1',
    status: 'Active'
  }
];

