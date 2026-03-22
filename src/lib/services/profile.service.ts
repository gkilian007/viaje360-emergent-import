import { createServiceClient } from "@/lib/supabase/server"
import type { DbProfile } from "@/lib/supabase/database.types"

export async function createProfile(
  userId: string,
  data: { name?: string; avatarUrl?: string }
): Promise<DbProfile | null> {
  try {
    const supabase = createServiceClient()
    const { data: profile, error } = await supabase
      .from("profiles")
      .insert({
        id: userId,
        name: data.name ?? null,
        avatar_url: data.avatarUrl ?? null,
      })
      .select()
      .single()

    if (error) {
      console.error("createProfile error:", error)
      return null
    }
    return profile as DbProfile
  } catch (err) {
    console.error("createProfile exception:", err)
    return null
  }
}

export async function getProfile(userId: string): Promise<DbProfile | null> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single()

    if (error) return null
    return data as DbProfile
  } catch {
    return null
  }
}

export async function updateXp(
  userId: string,
  amount: number
): Promise<void> {
  try {
    const supabase = createServiceClient()
    const profile = await getProfile(userId)
    if (!profile) return

    const newXp = profile.xp + amount
    const newLevel = Math.min(Math.floor(newXp / 500) + 1, 20)

    await supabase
      .from("profiles")
      .update({ xp: newXp, level: newLevel, updated_at: new Date().toISOString() })
      .eq("id", userId)
  } catch (err) {
    console.error("updateXp error:", err)
  }
}

export async function updateProfile(
  userId: string,
  data: Partial<Omit<DbProfile, "id" | "created_at">>
): Promise<void> {
  try {
    const supabase = createServiceClient()
    await supabase
      .from("profiles")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", userId)
  } catch (err) {
    console.error("updateProfile error:", err)
  }
}
