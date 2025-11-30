/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/lib/supabase'

export interface NormalizedDrug {
  id: number
  name: string
  normalized_name: string
  drug_type?: string
  brand_names?: string[]
  mechanism?: string
  created_at: string
  updated_at: string
}

export interface ProjectDrug extends NormalizedDrug {
  added_at: string
}

/**
 * Upsert a drug to the normalized drugs table
 * Returns the drug ID
 */
export async function upsertDrug(drug: {
  name: string
  normalized_name?: string
  drug_type?: string
  brand_names?: string[]
  mechanism?: string
}): Promise<number> {
  console.log('[DrugService] Upserting drug:', drug.name)

  const { data, error } = await supabase
    .from('drugs')
    .upsert(
      {
        name: drug.name,
        normalized_name: drug.normalized_name || drug.name.toLowerCase(),
        drug_type: drug.drug_type,
        brand_names: drug.brand_names,
        mechanism: drug.mechanism,
      },
      { onConflict: 'name' }
    )
    .select('id')
    .single()

  if (error) {
    console.error('[DrugService] Error upserting drug:', error)
    throw error
  }

  console.log('[DrugService] Drug upserted with ID:', data.id)
  return data.id
}

/**
 * Link a drug to a project
 */
export async function linkDrugToProject(
  projectId: number,
  drugId: number
): Promise<void> {
  console.log('[DrugService] Linking drug to project:', { projectId, drugId })

  const { error } = await supabase
    .from('project_drugs')
    .upsert(
      {
        project_id: projectId,
        drug_id: drugId,
      },
      { onConflict: 'project_id,drug_id' }
    )

  if (error) {
    console.error('[DrugService] Error linking drug to project:', error)
    throw error
  }

  console.log('[DrugService] Drug linked successfully')
}

/**
 * Get all drugs for a project
 */
export async function getProjectDrugs(projectId: number): Promise<ProjectDrug[]> {
  console.log('[DrugService] Fetching drugs for project:', projectId)

  const { data, error } = await supabase
    .from('project_drugs')
    .select(`
      added_at,
      drugs (*)
    `)
    .eq('project_id', projectId)
    .order('added_at', { ascending: false })

  if (error) {
    console.error('[DrugService] Error fetching project drugs:', error)
    throw error
  }

  // Handle case where data is null or undefined
  if (!data) {
    console.log('[DrugService] No drugs data returned for project:', projectId)
    return []
  }

  // Flatten the structure
  const drugs = data.map((row: any) => ({
    ...row.drugs,
    added_at: row.added_at,
  }))

  console.log('[DrugService] Found', drugs.length, 'drugs for project')
  return drugs
}

/**
 * Get a single drug by name
 */
export async function getDrugByName(name: string): Promise<NormalizedDrug | null> {
  const { data, error } = await supabase
    .from('drugs')
    .select('*')
    .eq('name', name)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('[DrugService] Error fetching drug:', error)
    throw error
  }

  return data
}

/**
 * Delete a drug from a project
 */
export async function unlinkDrugFromProject(
  projectId: number,
  drugId: number
): Promise<void> {
  const { error } = await supabase
    .from('project_drugs')
    .delete()
    .eq('project_id', projectId)
    .eq('drug_id', drugId)

  if (error) {
    console.error('[DrugService] Error unlinking drug:', error)
    throw error
  }

  console.log('[DrugService] Drug unlinked from project')
}

