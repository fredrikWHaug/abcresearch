/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/lib/supabase'
import { handleSupabaseQuery } from './utils/supabaseHelpers'
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

export async function upsertTrial(trial: ClinicalTrial): Promise<number> {
  const data = await handleSupabaseQuery<{ id: number }>(
    supabase
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
  )
  return data.id
}

export async function linkTrialToProject(projectId: number, trialId: number): Promise<void> {
  await handleSupabaseQuery(
    supabase.from('project_trials').upsert(
      { project_id: projectId, trial_id: trialId },
      { onConflict: 'project_id,trial_id' }
    )
  )
}

export async function getProjectTrials(projectId: number): Promise<ClinicalTrial[]> {
  const data = await handleSupabaseQuery<any[]>(
    supabase
      .from('project_trials')
      .select('added_at, trials (*)')
      .eq('project_id', projectId)
      .order('added_at', { ascending: false })
  )

  return data?.map((row: any) => ({
    nctId: row.trials.nct_id,
    briefTitle: row.trials.brief_title,
    officialTitle: row.trials.official_title,
    overallStatus: row.trials.overall_status,
    phase: row.trials.phase,
    conditions: row.trials.conditions,
    interventions: row.trials.interventions,
    sponsors: { lead: row.trials.sponsors_lead },
    enrollment: row.trials.enrollment,
    startDate: row.trials.start_date,
    completionDate: row.trials.completion_date,
    locations: row.trials.locations,
    studyType: row.trials.study_type,
  })) ?? []
}

export async function getTrialByNctId(nctId: string): Promise<NormalizedTrial | null> {
  const { data, error } = await supabase.from('trials').select('*').eq('nct_id', nctId).single()
  if (error && error.code !== 'PGRST116') throw error
  return data
}

export async function unlinkTrialFromProject(projectId: number, trialId: number): Promise<void> {
  await handleSupabaseQuery(
    supabase.from('project_trials').delete().eq('project_id', projectId).eq('trial_id', trialId)
  )
}

