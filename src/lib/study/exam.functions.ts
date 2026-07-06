import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { EXAM_QUESTIONS } from "@/data/questions";
import { grade } from "@/lib/study/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const examAnswerSchema = z.object({
  answers: z.array(
    z.object({
      examNo: z.number().int().min(1),
      selected: z.array(z.string()),
    }),
  ),
});

export const syncExamAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => examAnswerSchema.parse(data))
  .handler(async ({ data, context }) => {
    const byExamNo = new Map(data.answers.map((answer) => [answer.examNo, answer.selected]));
    const score = EXAM_QUESTIONS.reduce((total, question) => {
      const selected = byExamNo.get(question.examNo ?? -1) ?? [];
      return total + (grade(question, selected).correct ? 1 : 0);
    }, 0);

    const { data: userData } = await context.supabase.auth.getUser();
    const user = userData.user;
    const metadata = (user?.user_metadata ?? {}) as { display_name?: string; full_name?: string };
    const displayName =
      metadata.display_name || metadata.full_name || user?.email?.split("@")[0] || "Player";

    const { data: existing } = await context.supabase
      .from("profiles")
      .select("best_exam_score, character")
      .eq("user_id", context.userId)
      .maybeSingle();

    const previous = existing?.best_exam_score ?? 0;
    const best = Math.max(previous, score);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin.from("profiles").upsert(
      {
        user_id: context.userId,
        display_name: displayName.slice(0, 40),
        best_exam_score: best,
        character: existing?.character ?? {},
      },
      { onConflict: "user_id" },
    );

    return { score, best, perfect: score === EXAM_QUESTIONS.length };
  });
