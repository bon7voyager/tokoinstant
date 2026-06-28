"use client";

import { useActionState, useState } from "react";
import { rateOrderAction } from "@/app/actions/ratings";
import { Button, Alert, Textarea } from "@/components/ui";

export default function RatingForm({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState(rateOrderAction, undefined);
  const [stars, setStars] = useState(5);
  const [hover, setHover] = useState(0);

  if (state?.success) return <Alert tone="success">{state.success}</Alert>;

  const lit = hover || stars;

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="stars" value={stars} />
      {state?.error && <Alert tone="error">{state.error}</Alert>}

      <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            type="button"
            key={n}
            onClick={() => setStars(n)}
            onMouseEnter={() => setHover(n)}
            aria-label={`${n} bintang`}
            aria-pressed={stars === n}
            className="text-3xl leading-none transition-transform hover:scale-110"
          >
            <span className={lit >= n ? "" : "opacity-25 grayscale"}>⭐</span>
          </button>
        ))}
        <span className="ml-2 self-center text-sm font-bold text-ink/60">{stars}/5</span>
      </div>

      <Textarea
        name="comment"
        rows={2}
        maxLength={500}
        placeholder="Tulis ulasan singkat (opsional)"
        className="w-full"
      />

      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Mengirim..." : "Kirim Penilaian"}
      </Button>
    </form>
  );
}
