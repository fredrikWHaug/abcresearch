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

