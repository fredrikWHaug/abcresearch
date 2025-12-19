/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/lib/supabase'
import { handleSupabaseQuery } from './utils/supabaseHelpers'

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

export async function upsertDrug(drug: {
  name: string
  normalized_name?: string
  drug_type?: string
  brand_names?: string[]
  mechanism?: string
}): Promise<number> {
  const data = await handleSupabaseQuery<{ id: number }>(
    supabase
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
  )
  return data.id
}

export async function linkDrugToProject(projectId: number, drugId: number): Promise<void> {
  await handleSupabaseQuery(
    supabase.from('project_drugs').upsert(
      { project_id: projectId, drug_id: drugId },
      { onConflict: 'project_id,drug_id' }
    )
  )
}

export async function getProjectDrugs(projectId: number): Promise<ProjectDrug[]> {
  const data = await handleSupabaseQuery<any[]>(
    supabase
      .from('project_drugs')
      .select('added_at, drugs (*)')
      .eq('project_id', projectId)
      .order('added_at', { ascending: false })
  )

  return data?.map((row: any) => ({ ...row.drugs, added_at: row.added_at })) ?? []
}

export async function getDrugByName(name: string): Promise<NormalizedDrug | null> {
  const { data, error } = await supabase.from('drugs').select('*').eq('name', name).single()
  if (error && error.code !== 'PGRST116') throw error
  return data
}

export async function unlinkDrugFromProject(projectId: number, drugId: number): Promise<void> {
  await handleSupabaseQuery(
    supabase.from('project_drugs').delete().eq('project_id', projectId).eq('drug_id', drugId)
  )
}

/**
 * BULK VERSION: Upsert multiple drugs in a single database call.
 * Returns a Map of drug name -> database id for linking to projects/entities.
 * Much more efficient than calling upsertDrug() in a loop.
 */
export async function bulkUpsertDrugs(drugs: {
  name: string
  normalized_name?: string
  drug_type?: string
  brand_names?: string[]
  mechanism?: string
}[]): Promise<Map<string, number>> {
  if (drugs.length === 0) return new Map()
  
  // Deduplicate by name before upserting
  const uniqueDrugs = Array.from(
    new Map(drugs.map(d => [d.name, d])).values()
  )
  
  const drugRecords = uniqueDrugs.map(drug => ({
    name: drug.name,
    normalized_name: drug.normalized_name || drug.name.toLowerCase(),
    drug_type: drug.drug_type,
    brand_names: drug.brand_names,
    mechanism: drug.mechanism,
  }))
  
  const data = await handleSupabaseQuery<{ id: number; name: string }[]>(
    supabase
      .from('drugs')
      .upsert(drugRecords, { onConflict: 'name' })
      .select('id, name')
  )
  
  const result = new Map<string, number>()
  for (const row of data) {
    result.set(row.name, row.id)
  }
  
  return result
}

/**
 * BULK VERSION: Link multiple drugs to a project in a single database call.
 */
export async function bulkLinkDrugsToProject(projectId: number, drugIds: number[]): Promise<void> {
  if (drugIds.length === 0) return
  
  const links = drugIds.map(drugId => ({
    project_id: projectId,
    drug_id: drugId,
  }))
  
  await handleSupabaseQuery(
    supabase.from('project_drugs').upsert(links, { onConflict: 'project_id,drug_id' })
  )
}

