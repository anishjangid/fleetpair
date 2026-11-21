import { Suspense } from "react";
import { ChallengePage } from "@/components/challenge/ChallengePage";

export default function ChallengeRoute() {
  return (
    <Suspense
      fallback={
        <div className="text-sm text-muted-foreground">Loading challenge…</div>
      }
    >
      <ChallengePage />
    </Suspense>
  );
}
