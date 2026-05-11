import { Suspense } from 'react'
import FeedbackContent from './content'

export default function FeedbackPage() {
  return (
    <Suspense fallback={<div className="h-48 bg-[#111] border border-[#222] rounded-2xl animate-pulse" />}>
      <FeedbackContent />
    </Suspense>
  )
}
