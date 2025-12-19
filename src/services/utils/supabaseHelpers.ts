/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/lib/supabase'

type EntityConfig = {
  table: string
  idField: string
  conflictFields: string
}

const ENTITY_CONFIGS: Record<string, EntityConfig> = {
  trial: { table: 'drug_trials', idField: 'trial_id', conflictFields: 'drug_id,trial_id,project_id' },
  paper: { table: 'drug_papers', idField: 'paper_id', conflictFields: 'drug_id,paper_id,project_id' },
  pressRelease: { table: 'drug_press_releases', idField: 'press_release_id', conflictFields: 'drug_id,press_release_id,project_id' },
  irDeck: { table: 'drug_ir_decks', idField: 'ir_deck_id', conflictFields: 'drug_id,ir_deck_id,project_id' },
}

export async function handleSupabaseQuery<T = any>(queryBuilder: any): Promise<T> {
  const { data, error } = await queryBuilder
  if (error) throw error
  return data as T
}

export async function linkDrugToEntity(
  drugId: number,
  entityId: number,
  projectId: number,
  entityType: keyof typeof ENTITY_CONFIGS
): Promise<void> {
  const config = ENTITY_CONFIGS[entityType]
  await handleSupabaseQuery(
    supabase.from(config.table).upsert(
      { drug_id: drugId, [config.idField]: entityId, project_id: projectId },
      { onConflict: config.conflictFields }
    )
  )
}

export async function getDrugEntityIds(
  drugId: number,
  projectId: number,
  entityType: keyof typeof ENTITY_CONFIGS
): Promise<number[]> {
  const config = ENTITY_CONFIGS[entityType]
  const data = await handleSupabaseQuery<any[]>(
    supabase.from(config.table).select(config.idField).eq('drug_id', drugId).eq('project_id', projectId)
  )
  return data.map((row: any) => row[config.idField])
}

/**
 * BATCH VERSION: Get ALL drug-entity associations for a project in a single query.
 * Returns a Map where key = drugId, value = array of entity IDs.
 * This eliminates the N+1 query problem when loading drug groups.
 */
export async function getAllDrugEntityAssociations(
  projectId: number,
  entityType: keyof typeof ENTITY_CONFIGS
): Promise<Map<number, number[]>> {
  const config = ENTITY_CONFIGS[entityType]
  const data = await handleSupabaseQuery<any[]>(
    supabase.from(config.table).select(`drug_id, ${config.idField}`).eq('project_id', projectId)
  )
  
  const result = new Map<number, number[]>()
  for (const row of data) {
    const drugId = row.drug_id
    const entityId = row[config.idField]
    if (!result.has(drugId)) {
      result.set(drugId, [])
    }
    result.get(drugId)!.push(entityId)
  }
  return result
}

/**
 * BATCH VERSION: Get all project drug associations in 4 parallel queries.
 * Much more efficient than calling getDrugAssociations per drug.
 */
export async function getAllProjectDrugAssociations(projectId: number): Promise<{
  drugTrials: Map<number, number[]>
  drugPapers: Map<number, number[]>
  drugPressReleases: Map<number, number[]>
  drugIRDecks: Map<number, number[]>
}> {
  const [drugTrials, drugPapers, drugPressReleases, drugIRDecks] = await Promise.all([
    getAllDrugEntityAssociations(projectId, 'trial'),
    getAllDrugEntityAssociations(projectId, 'paper'),
    getAllDrugEntityAssociations(projectId, 'pressRelease'),
    getAllDrugEntityAssociations(projectId, 'irDeck'),
  ])
  
  return { drugTrials, drugPapers, drugPressReleases, drugIRDecks }
}
