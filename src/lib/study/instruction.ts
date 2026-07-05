import type { Question } from "@/data/questions";

export function instruction(q: Question): { text: string; strong: string } {
  const n =
    q.select === 1 ? "the ONE" : q.select === 2 ? "TWO" : q.select === 3 ? "THREE" : `${q.select}`;
  const pol = q.polarity === "incorrect" ? "INCORRECT" : "CORRECT";
  if (q.select === 1) {
    return {
      text: `Select ${pol === "INCORRECT" ? "the INCORRECT" : "the ONE correct"} answer`,
      strong: pol,
    };
  }
  return { text: `Select ${n} ${pol.toLowerCase()} answers`, strong: `${n} ${pol}` };
}
