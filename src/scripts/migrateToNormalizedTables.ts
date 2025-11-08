/**
 * Migration script to move data from market_maps JSONB to normalized tables
 * Run this once to populate trials, papers, and drugs tables
 */

import { supabase } from '@/lib/supabase'
import { upsertTrial, linkTrialToProject } from '@/services/trialService'
import { upsertPaper, linkPaperToProject } from '@/services/paperService'
import type { ClinicalTrial } from '@/types/trials'
import type { PubMedArticle } from '@/types/papers'

interface MarketMapRow {
  id: number
  project_id: number | null
  trials_data: ClinicalTrial[] | null
  papers_data: PubMedArticle[] | null
}

export async function migrateToNormalizedTables() {
  console.log('=== Starting Migration to Normalized Tables ===')
  
  try {
    // Fetch all market maps with trials and papers data
    const { data: marketMaps, error } = await supabase
      .from('market_maps')
      .select('id, project_id, trials_data, papers_data')
    
    if (error) {
      console.error('Error fetching market maps:', error)
      throw error
    }
    
    console.log(`Found ${marketMaps?.length || 0} market maps to migrate`)
    
    if (!marketMaps || marketMaps.length === 0) {
      console.log('No data to migrate')
      return { success: true, migrated: 0, errors: [] }
    }
    
    let migratedTrials = 0
    let migratedPapers = 0
    const errors: string[] = []
    
    // Process each market map
    for (const map of marketMaps as MarketMapRow[]) {
      console.log(`\nProcessing market map ${map.id}...`)
      
      if (!map.project_id) {
        console.log(`  Skipping - no project_id`)
        continue
      }
      
      // Migrate trials
      if (map.trials_data && Array.isArray(map.trials_data) && map.trials_data.length > 0) {
        console.log(`  Migrating ${map.trials_data.length} trials...`)
        
        for (const trial of map.trials_data) {
          try {
            const trialId = await upsertTrial(trial)
            await linkTrialToProject(map.project_id, trialId)
            migratedTrials++
          } catch (err) {
            const errorMsg = `Failed to migrate trial ${trial.nctId}: ${err}`
            console.error(`  Error:`, errorMsg)
            errors.push(errorMsg)
          }
        }
      }
      
      // Migrate papers
      if (map.papers_data && Array.isArray(map.papers_data) && map.papers_data.length > 0) {
        console.log(`  Migrating ${map.papers_data.length} papers...`)
        
        for (const paper of map.papers_data) {
          try {
            const paperId = await upsertPaper(paper)
            await linkPaperToProject(map.project_id, paperId)
            migratedPapers++
          } catch (err) {
            const errorMsg = `Failed to migrate paper ${paper.pmid}: ${err}`
            console.error(`  Error:`, errorMsg)
            errors.push(errorMsg)
          }
        }
      }
    }
    
    console.log('\n=== Migration Complete ===')
    console.log(`Migrated ${migratedTrials} trials`)
    console.log(`Migrated ${migratedPapers} papers`)
    
    if (errors.length > 0) {
      console.log(`\nEncountered ${errors.length} errors:`)
      errors.forEach(err => console.log(`  - ${err}`))
    }
    
    return {
      success: true,
      migrated: migratedTrials + migratedPapers,
      errors,
      trials: migratedTrials,
      papers: migratedPapers
    }
    
  } catch (error) {
    console.error('Migration failed:', error)
    throw error
  }
}

// Allow running directly from command line
if (require.main === module) {
  migrateToNormalizedTables()
    .then(result => {
      console.log('\nMigration result:', result)
      process.exit(0)
    })
    .catch(error => {
      console.error('\nMigration failed:', error)
      process.exit(1)
    })
}

