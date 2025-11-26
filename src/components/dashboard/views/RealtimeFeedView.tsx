 
import React from 'react'
import { RealtimeFeed } from '@/components/RealtimeFeed'

interface RealtimeFeedViewProps {
  isVisible?: boolean;
}

export function RealtimeFeedView({ isVisible }: RealtimeFeedViewProps) {
  return (
    <div className="h-full overflow-y-auto">
      <RealtimeFeed isVisible={isVisible} />
    </div>
  )
}

