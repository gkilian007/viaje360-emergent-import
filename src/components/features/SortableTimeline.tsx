"use client"

import { useCallback } from "react"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { TimelineItem } from "./TimelineItem"
import { WalkingChip } from "./WalkingChip"
import { TransitChoiceCard } from "./TransitChoiceCard"
import type { TimelineActivity } from "@/lib/types"

interface WalkingSegment {
  walkingMinutes: number
  distanceMeters: number
  mapsUrl: string
}

interface SortableTimelineItemProps {
  activity: TimelineActivity
  /** 1-based index of activity in the day */
  index: number
  isFirst: boolean
  isLast: boolean
  isCurrent: boolean
  onClick?: (activity: TimelineActivity) => void
  onEdit?: (activityId: string, patch: { name: string; time: string; duration: number }) => Promise<void>
  next?: TimelineActivity
  segment?: WalkingSegment
  offerTransit?: boolean
  destination?: string
  dayProgress?: number
}

function SortableTimelineItem({
  activity,
  index,
  isFirst,
  isLast,
  isCurrent,
  onClick,
  onEdit,
  next,
  segment,
  offerTransit,
  destination,
  dayProgress,
}: SortableTimelineItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: activity.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
    position: "relative" as const,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <div className="flex items-start gap-1">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="shrink-0 mt-3 p-1 rounded-lg cursor-grab active:cursor-grabbing touch-none"
          style={{ color: "rgba(255,255,255,0.25)" }}
          aria-label="Arrastrar para reordenar"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="5" cy="4" r="1.5" />
            <circle cx="11" cy="4" r="1.5" />
            <circle cx="5" cy="8" r="1.5" />
            <circle cx="11" cy="8" r="1.5" />
            <circle cx="5" cy="12" r="1.5" />
            <circle cx="11" cy="12" r="1.5" />
          </svg>
        </button>

        {/* Timeline item */}
        <div className="flex-1 min-w-0">
          <TimelineItem
            activity={activity}
            index={index}
            isFirst={isFirst}
            isLast={isLast}
            isCurrent={isCurrent}
            nextActivity={next ?? null}
            destination={destination}
            onClick={onClick}
            onEdit={onEdit}
          />
          {segment && offerTransit && next && (
            <TransitChoiceCard
              fromActivity={activity.name}
              toActivity={next.name}
              distanceMeters={segment.distanceMeters}
              walkingMinutes={segment.walkingMinutes}
              destination={destination ?? ""}
              dayProgress={dayProgress ?? 0}
              walkingMapsUrl={segment.mapsUrl}
            />
          )}
          {segment && !offerTransit && (
            <WalkingChip
              walkingMinutes={segment.walkingMinutes}
              distanceMeters={segment.distanceMeters}
              mapsUrl={segment.mapsUrl}
            />
          )}
        </div>
      </div>
    </div>
  )
}

interface SortableTimelineProps {
  activities: TimelineActivity[]
  dayNumber: number
  tripId?: string
  isCurrent?: (id: string) => boolean
  onClick?: (activity: TimelineActivity) => void
  onEdit?: (activityId: string, patch: { name: string; time: string; duration: number }) => Promise<void>
  getSegment?: (fromId: string, toId: string) => WalkingSegment | undefined
  shouldOfferTransit?: (distanceMeters: number) => boolean
  destination?: string
  onReorder: (dayNumber: number, orderedIds: string[]) => void
}

export function SortableTimeline({
  activities,
  dayNumber,
  tripId,
  isCurrent,
  onClick,
  onEdit,
  getSegment,
  shouldOfferTransit,
  destination,
  onReorder,
}: SortableTimelineProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    })
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = activities.findIndex((a) => a.id === active.id)
      const newIndex = activities.findIndex((a) => a.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      const reordered = arrayMove(activities, oldIndex, newIndex)
      const orderedIds = reordered.map((a) => a.id)
      onReorder(dayNumber, orderedIds)

      // Persist to server (fire-and-forget for non-logged-in users)
      if (tripId) {
        fetch("/api/itinerary/reorder", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tripId, dayNumber, activityIds: orderedIds }),
        }).catch(() => {})
      }
    },
    [activities, dayNumber, tripId, onReorder]
  )

  if (activities.length === 0) {
    return (
      <div className="text-center py-12">
        <span className="material-symbols-outlined text-[48px] text-[#c0c6d6]/30">beach_access</span>
        <p className="text-[#c0c6d6] mt-2">Día libre — ¡disfruta!</p>
      </div>
    )
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={activities.map((a) => a.id)} strategy={verticalListSortingStrategy}>
        {activities.map((activity, i) => {
          const next = activities[i + 1]
          const seg = next && getSegment ? getSegment(activity.id, next.id) : undefined
          const totalActivities = activities.length
          const dayProgress = totalActivities > 1 ? i / (totalActivities - 1) : 0
          const offerTransit = seg && shouldOfferTransit ? shouldOfferTransit(seg.distanceMeters) : false

          return (
            <SortableTimelineItem
              key={activity.id}
              activity={activity}
              index={i + 1}
              isFirst={i === 0}
              isLast={i === activities.length - 1}
              isCurrent={isCurrent ? isCurrent(activity.id) : false}
              onClick={onClick}
              onEdit={onEdit}
              next={next}
              segment={seg}
              offerTransit={offerTransit}
              destination={destination}
              dayProgress={dayProgress}
            />
          )
        })}
      </SortableContext>
    </DndContext>
  )
}
