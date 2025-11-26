/**
 * Trial Test Fixtures
 * Realistic clinical trial data for testing
 */

import type { ClinicalTrial } from '@/types/trials'

export const phase2AlzheimersTrial: ClinicalTrial = {
  nctId: 'NCT04567890',
  briefTitle: "Efficacy of Novel Drug in Alzheimer's Disease",
  officialTitle: "A Phase 2, Randomized, Double-Blind, Placebo-Controlled Study of Novel Drug in Patients with Mild to Moderate Alzheimer's Disease",
  overallStatus: 'Recruiting',
  phase: ['Phase 2'],
  conditions: ["Alzheimer's Disease", 'Dementia'],
  interventions: ['Novel Alzheimer Drug', 'Placebo'],
  sponsors: { 
    lead: 'Alzheimer Research Institute',
    collaborators: ['National Institute on Aging']
  },
  enrollment: 200,
  startDate: '2023-06-01',
  completionDate: '2025-12-31',
  locations: [
    { facility: 'Memory Care Center', city: 'Boston', state: 'MA', country: 'USA' },
    { facility: 'Brain Health Institute', city: 'San Francisco', state: 'CA', country: 'USA' }
  ],
  studyType: 'Interventional',
}

export const phase3DiabetesTrial: ClinicalTrial = {
  nctId: 'NCT05678901',
  briefTitle: 'GLP-1 Agonist for Type 2 Diabetes',
  officialTitle: 'A Phase 3, Multicenter, Randomized, Double-Blind Study Comparing GLP-1 Agonist to Placebo in Adults with Type 2 Diabetes',
  overallStatus: 'Active, not recruiting',
  phase: ['Phase 3'],
  conditions: ['Type 2 Diabetes Mellitus', 'Hyperglycemia'],
  interventions: ['GLP-1 Agonist', 'Placebo', 'Metformin'],
  sponsors: { 
    lead: 'Diabetes Pharma Corp',
  },
  enrollment: 1500,
  startDate: '2022-01-15',
  completionDate: '2024-06-30',
  locations: [
    { facility: 'Diabetes Center', city: 'New York', state: 'NY', country: 'USA' },
    { facility: 'Endocrinology Clinic', city: 'Chicago', state: 'IL', country: 'USA' },
    { facility: 'Metabolic Research Unit', city: 'Houston', state: 'TX', country: 'USA' }
  ],
  studyType: 'Interventional',
}

export const phase1CancerTrial: ClinicalTrial = {
  nctId: 'NCT06789012',
  briefTitle: 'First-in-Human Study of Novel Immunotherapy in Advanced Melanoma',
  officialTitle: 'A Phase 1 Dose-Escalation Study of Novel Checkpoint Inhibitor in Patients with Metastatic Melanoma',
  overallStatus: 'Recruiting',
  phase: ['Phase 1'],
  conditions: ['Melanoma', 'Metastatic Cancer'],
  interventions: ['Novel Checkpoint Inhibitor'],
  sponsors: { 
    lead: 'Oncology Therapeutics Inc',
    collaborators: ['Cancer Research Center']
  },
  enrollment: 45,
  startDate: '2024-03-01',
  completionDate: '2026-03-01',
  locations: [
    { facility: 'Cancer Treatment Center', city: 'Seattle', state: 'WA', country: 'USA' }
  ],
  studyType: 'Interventional',
}

export const observationalStudy: ClinicalTrial = {
  nctId: 'NCT07890123',
  briefTitle: 'Long-term Outcomes of Cardiovascular Disease Prevention',
  officialTitle: 'Observational Study of Long-term Outcomes in Patients Receiving Standard Cardiovascular Preventive Care',
  overallStatus: 'Enrolling by invitation',
  phase: [],
  conditions: ['Cardiovascular Disease', 'Hypertension', 'Hyperlipidemia'],
  interventions: ['Standard of Care'],
  sponsors: { 
    lead: 'Heart Health Foundation',
  },
  enrollment: 5000,
  startDate: '2020-01-01',
  completionDate: '2030-12-31',
  locations: [
    { facility: 'Community Health Center', city: 'Various', state: 'Multiple', country: 'USA' }
  ],
  studyType: 'Observational',
}

export const mockTrials = [
  phase2AlzheimersTrial,
  phase3DiabetesTrial,
  phase1CancerTrial,
  observationalStudy,
]

