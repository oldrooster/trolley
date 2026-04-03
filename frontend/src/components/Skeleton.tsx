function Bone({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-stone-200 dark:bg-stone-700 rounded-lg ${className}`} />
  )
}

export function ListSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Bone className="h-7 w-40" />
        <Bone className="h-8 w-24" />
      </div>
      <Bone className="h-11 w-full rounded-xl" />
      <div className="card divide-y divide-stone-100 dark:divide-stone-700">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Bone className="w-5 h-5 rounded-full shrink-0" />
            <Bone className="h-4 flex-1" />
            <Bone className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function CardGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Bone className="h-7 w-32" />
        <Bone className="h-9 w-28" />
      </div>
      <Bone className="h-10 w-full rounded-xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[...Array(count)].map((_, i) => (
          <div key={i} className="card overflow-hidden">
            <Bone className="w-full h-40 rounded-none" />
            <div className="p-4 space-y-2">
              <Bone className="h-5 w-3/4" />
              <Bone className="h-3 w-full" />
              <Bone className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function CatalogueSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Bone className="h-7 w-44" />
        <Bone className="h-9 w-28" />
      </div>
      <Bone className="h-10 w-full rounded-xl" />
      <div className="flex gap-2">
        {[...Array(5)].map((_, i) => <Bone key={i} className="h-7 w-20 rounded-full" />)}
      </div>
      {[...Array(2)].map((_, g) => (
        <div key={g} className="space-y-2">
          <Bone className="h-4 w-28" />
          <div className="card divide-y divide-stone-100 dark:divide-stone-700">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Bone className="h-4 flex-1" />
                <Bone className="h-3 w-12" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function PlannerSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Bone className="h-7 w-36" />
        <Bone className="h-9 w-40" />
      </div>
      <div className="flex items-center gap-3">
        <Bone className="h-9 w-9 rounded-lg" />
        <Bone className="h-5 flex-1" />
        <Bone className="h-9 w-9 rounded-lg" />
      </div>
      <div className="space-y-3">
        {[...Array(3)].map((_, r) => (
          <div key={r}>
            <Bone className="h-3 w-20 mb-2" />
            <div className="grid grid-cols-7 gap-2">
              {[...Array(7)].map((_, c) => <Bone key={c} className="h-16 rounded-lg" />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
