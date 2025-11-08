import { supabase } from '@/lib/supabase'
import type { ClinicalTrial } from '@/types/trials'

export interface NormalizedTrial {
  id: number
  nct_id: string
  brief_title: string
  official_title?: string
  overall_status?: string
  phase?: string[]
  conditions?: string[]
  interventions?: string[]
  sponsors_lead?: string
  enrollment?: number
  start_date?: string
  completion_date?: string
  locations?: any
  study_type?: string
  created_at: string
  updated_at: string
}

export interface ProjectTrial extends NormalizedTrial {
  added_at: string
}

/**
 * Upsert a trial to the normalized trials table
 * Returns the trial ID
 */
export async function upsertTrial(trial: ClinicalTrial): Promise<number> {
  const { data, error } = await supabase
    .from('trials')
    .upsert(
      {
        nct_id: trial.nctId,
        brief_title: trial.briefTitle,
        official_title: trial.officialTitle,
        overall_status: trial.overallStatus,
        phase: trial.phase,
        conditions: trial.conditions,
        interventions: trial.interventions,
        sponsors_lead: trial.sponsors?.lead,
        enrollment: trial.enrollment,
        start_date: trial.startDate,
        completion_date: trial.completionDate,
        locations: trial.locations,
        study_type: trial.studyType,
      },
      { onConflict: 'nct_id' }
    )
    .select('id')
    .single()

  if (error) {
    console.error('[TrialService] Error upserting trial:', trial.nctId, error)
    throw error
  }

  return data.id
}

/**
 * Link a trial to a project
 */
export async function linkTrialToProject(
  projectId: number,
  trialId: number
): Promise<void> {
  const { error } = await supabase
    .from('project_trials')
    .upsert(
      {
        project_id: projectId,
        trial_id: trialId,
      },
      { onConflict: 'project_id,trial_id' }
    )

  if (error) {
    console.error('[TrialService] Error linking trial to project:', error)
    throw error
  }
}

/**
 * Get all trials for a project
 */
export async function getProjectTrials(projectId: number): Promise<ProjectTrial[]> {
  console.log('[TrialService] Fetching trials for project:', projectId)

  const { data, error } = await supabase
    .from('project_trials')
    .select(`
      added_at,
      trials (*)
    `)
    .eq('project_id', projectId)
    .order('added_at', { ascending: false })

  if (error) {
    console.error('[TrialService] Error fetching project trials:', error)
    throw error
  }

  // Flatten the structure
  const trials = data.map((row: any) => ({
    ...row.trials,
    added_at: row.added_at,
  }))

  console.log('[TrialService] Found', trials.length, 'trials for project')
  return trials
}

/**
 * Get a single trial by NCT ID
 */
export async function getTrialByNctId(nctId: string): Promise<NormalizedTrial | null> {
  const { data, error } = await supabase
    .from('trials')
    .select('*')
    .eq('nct_id', nctId)
    .single()

  if (error && error.code !== 'PGRST116') {
    // PGRST116 is "no rows found"
    console.error('[TrialService] Error fetching trial:', error)
    throw error
  }

  return data
}

/**
 * Delete a trial from a project (doesn't delete the trial itself)
 */
export async function unlinkTrialFromProject(
  projectId: number,
  trialId: number
): Promise<void> {
  const { error } = await supabase
    .from('project_trials')
    .delete()
    .eq('project_id', projectId)
    .eq('trial_id', trialId)

  if (error) {
    console.error('[TrialService] Error unlinking trial:', error)
    throw error
  }

  console.log('[TrialService] Trial unlinked from project')
}

