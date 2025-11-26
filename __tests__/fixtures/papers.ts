/**
 * Paper Test Fixtures
 * Realistic research paper data for testing
 */

import type { PubMedArticle } from '@/types/papers'

export const alzheimersPaper: PubMedArticle = {
  pmid: '38123456',
  title: "Novel Therapeutic Approach for Alzheimer's Disease: Results from a Phase 2 Clinical Trial",
  abstract: "Background: Alzheimer's disease represents a significant unmet medical need. We conducted a randomized, placebo-controlled trial to evaluate the efficacy and safety of a novel therapeutic approach. Methods: 200 patients with mild to moderate Alzheimer's disease were randomized to receive either the active treatment or placebo for 12 months. Primary outcome was change in cognitive function. Results: The treatment group showed a statistically significant improvement in cognitive scores compared to placebo (p<0.001). Conclusion: This novel approach shows promise for treating Alzheimer's disease.",
  journal: 'New England Journal of Medicine',
  publicationDate: '2024-02-15',
  authors: ['Smith JA', 'Johnson RB', 'Williams CD', 'Brown EF'],
  doi: '10.1056/NEJMoa2024001',
  nctNumber: 'NCT04567890',
  relevanceScore: 95,
  fullTextLinks: [{ url: 'https://www.nejm.org/doi/full/10.1056/NEJMoa2024001', source: 'Publisher' }],
}

export const diabetesPaper: PubMedArticle = {
  pmid: '38234567',
  title: 'GLP-1 Receptor Agonists in Type 2 Diabetes: A Systematic Review and Meta-Analysis',
  abstract: "Objective: To evaluate the efficacy and safety of GLP-1 receptor agonists in type 2 diabetes. Methods: We systematically reviewed randomized controlled trials comparing GLP-1 agonists to placebo or other antidiabetic agents. Results: GLP-1 agonists significantly reduced HbA1c levels (mean difference -1.2%, 95% CI -1.4 to -1.0) and body weight (mean difference -3.5 kg, 95% CI -4.2 to -2.8) compared to placebo. Cardiovascular outcomes were improved in high-risk patients. Conclusion: GLP-1 agonists are effective for glycemic control and weight reduction in type 2 diabetes.",
  journal: 'Diabetes Care',
  publicationDate: '2023-11-20',
  authors: ['Garcia MH', 'Martinez LP', 'Rodriguez AS', 'Gonzalez JM'],
  doi: '10.2337/dc23-1234',
  relevanceScore: 92,
  fullTextLinks: [],
}

export const cancerPaper: PubMedArticle = {
  pmid: '38345678',
  title: 'Immune Checkpoint Inhibitors in Advanced Melanoma: Current Status and Future Directions',
  abstract: "Immune checkpoint inhibitors have revolutionized the treatment of advanced melanoma. This review summarizes the clinical evidence for PD-1, PD-L1, and CTLA-4 inhibitors in melanoma, discusses resistance mechanisms, and explores emerging combination strategies. Recent trials have demonstrated unprecedented long-term survival benefits, with 5-year overall survival rates exceeding 50% in some studies. Future research directions include biomarker development, novel combinations, and personalized treatment approaches.",
  journal: 'Journal of Clinical Oncology',
  publicationDate: '2024-01-10',
  authors: ['Chen X', 'Li Y', 'Wang Z', 'Zhang H', 'Liu W'],
  doi: '10.1200/JCO.2023.41.1234',
  relevanceScore: 88,
  fullTextLinks: [{ url: 'https://ascopubs.org/doi/full/10.1200/JCO.2023.41.1234', source: 'Publisher' }],
}

export const methodologyPaper: PubMedArticle = {
  pmid: '38456789',
  title: 'Best Practices for Conducting Phase 2 Clinical Trials in Neurodegenerative Diseases',
  abstract: "Phase 2 clinical trials in neurodegenerative diseases face unique challenges including patient heterogeneity, slow disease progression, and lack of validated biomarkers. This article provides recommendations for trial design, outcome measure selection, sample size calculation, and statistical analysis methods. We discuss adaptive trial designs, enrichment strategies, and the use of digital endpoints to improve trial efficiency and success rates.",
  journal: 'Clinical Trials',
  publicationDate: '2023-09-05',
  authors: ['Anderson KL', 'Thompson RM', 'White PJ'],
  doi: '10.1177/1740774523001234',
  relevanceScore: 75,
  fullTextLinks: [],
}

export const mockPapers = [
  alzheimersPaper,
  diabetesPaper,
  cancerPaper,
  methodologyPaper,
]

