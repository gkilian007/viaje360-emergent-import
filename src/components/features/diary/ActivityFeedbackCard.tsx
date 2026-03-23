"use client"

import { motion } from "framer-motion"
import type { TimelineActivity } from "@/lib/types"
import { ACTIVITY_ICONS } from "@/lib/constants"

interface ActivityFeedback {
  activityId: string
  liked: boolean | null
  wouldRepeat: boolean | null
  notes: string
}

interface ActivityFeedbackCardProps {
  activity: TimelineActivity
  feedback: ActivityFeedback | undefined
  onFeedbackChange: (feedback: ActivityFeedback) => void
}

export function ActivityFeedbackCard({
  activity,
  feedback,
  onFeedbackChange,
}: ActivityFeedbackCardProps) {
  const icon = activity.icon ?? ACTIVITY_ICONS[activity.type] ?? "place"
  const liked = feedback?.liked
  const wouldRepeat = feedback?.wouldRepeat

  const updateFeedback = (updates: Partial<ActivityFeedback>) => {
    onFeedbackChange({
      activityId: activity.id,
      liked: feedback?.liked ?? null,
      wouldRepeat: feedback?.wouldRepeat ?? null,
      notes: feedback?.notes ?? "",
      ...updates,
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-2xl"
      style={{
        background: "rgba(42,42,44,0.6)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Activity header */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "rgba(10,132,255,0.15)" }}
        >
          <span className="material-symbols-outlined text-[20px] text-[#0A84FF]">
            {icon}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-white truncate">{activity.name}</p>
          <p className="text-[11px] text-[#c0c6d6]">{activity.time} · {activity.location}</p>
        </div>
      </div>

      {/* Feedback buttons */}
      <div className="flex flex-col gap-3">
        {/* Like/Dislike */}
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-[#c0c6d6]">¿Te gustó?</span>
          <div className="flex gap-2">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => updateFeedback({ liked: liked === true ? null : true })}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all"
              style={{
                background: liked === true ? "rgba(48,209,88,0.2)" : "rgba(42,42,44,0.8)",
                border: `2px solid ${liked === true ? "#30D158" : "transparent"}`,
              }}
              data-testid={`activity-${activity.id}-like`}
            >
              <span
                className="material-symbols-outlined text-[20px]"
                style={{
                  color: liked === true ? "#30D158" : "#c0c6d6",
                  fontVariationSettings: liked === true ? "'FILL' 1" : "'FILL' 0",
                }}
              >
                thumb_up
              </span>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => updateFeedback({ liked: liked === false ? null : false })}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all"
              style={{
                background: liked === false ? "rgba(255,69,58,0.2)" : "rgba(42,42,44,0.8)",
                border: `2px solid ${liked === false ? "#FF453A" : "transparent"}`,
              }}
              data-testid={`activity-${activity.id}-dislike`}
            >
              <span
                className="material-symbols-outlined text-[20px]"
                style={{
                  color: liked === false ? "#FF453A" : "#c0c6d6",
                  fontVariationSettings: liked === false ? "'FILL' 1" : "'FILL' 0",
                }}
              >
                thumb_down
              </span>
            </motion.button>
          </div>
        </div>

        {/* Would repeat */}
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-[#c0c6d6]">¿Lo repetirías?</span>
          <div className="flex gap-2">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => updateFeedback({ wouldRepeat: wouldRepeat === true ? null : true })}
              className="px-4 py-2 rounded-xl text-[12px] font-medium transition-all"
              style={{
                background: wouldRepeat === true ? "rgba(10,132,255,0.2)" : "rgba(42,42,44,0.8)",
                border: `2px solid ${wouldRepeat === true ? "#0A84FF" : "transparent"}`,
                color: wouldRepeat === true ? "#0A84FF" : "#c0c6d6",
              }}
              data-testid={`activity-${activity.id}-repeat-yes`}
            >
              Sí
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => updateFeedback({ wouldRepeat: wouldRepeat === false ? null : false })}
              className="px-4 py-2 rounded-xl text-[12px] font-medium transition-all"
              style={{
                background: wouldRepeat === false ? "rgba(255,159,10,0.2)" : "rgba(42,42,44,0.8)",
                border: `2px solid ${wouldRepeat === false ? "#FF9F0A" : "transparent"}`,
                color: wouldRepeat === false ? "#FF9F0A" : "#c0c6d6",
              }}
              data-testid={`activity-${activity.id}-repeat-no`}
            >
              No
            </motion.button>
          </div>
        </div>

        {/* Notes input */}
        <div>
          <textarea
            placeholder="Notas adicionales..."
            value={feedback?.notes ?? ""}
            onChange={(e) => updateFeedback({ notes: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 rounded-xl text-[13px] text-white placeholder:text-[#c0c6d6]/50 resize-none"
            style={{
              background: "rgba(42,42,44,0.8)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
            data-testid={`activity-${activity.id}-notes`}
          />
        </div>
      </div>
    </motion.div>
  )
}
