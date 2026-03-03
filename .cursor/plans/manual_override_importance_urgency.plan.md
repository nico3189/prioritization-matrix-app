# Plan: Beskyttelse af manuelt overskrevne importance/urgency

## Problem

Når brugeren manuelt ændrer importance eller urgency i task-overlay og trykker Gem, overskrives værdierne af AI via `syncTaskUrgency` – brugerens ændringer går tabt.

## Nuværende flow

1. **Gem (handleSaveAndQualify):** PATCH med form-værdier (inkl. importance, urgency) → på success kaldes `syncTaskUrgency` → AI parse overskriver importance + urgency.
2. **Genberegn hastegrad (Flere handlinger):** Kalder sync-urgency direkte – bruger vil eksplicit have AI-værdier.
3. **Cron sync-urgency:** Kører for alle opgaver – overskriver også manuelt ændrede.

## Ønsket logik

| Handling | Importance | Urgency |
|----------|------------|---------|
| **Gem** (bruger har ændret værdier) | Bevar brugerens værdi | Bevar brugerens værdi |
| **Gem** (kun dueAt ændret) | Bevar eksisterende | Opdater fra deadline hvis dueAt sat |
| **Genberegn hastegrad** | AI overskriver | AI overskriver |
| **Cron sync** | Spring over hvis manuelt overskrevet | Spring over hvis manuelt overskrevet |

## Implementering

### 1. Fjern syncTaskUrgency fra Gem-flow

**Fil:** [components/task-overlay.tsx](components/task-overlay.tsx)

I `handleSaveAndQualify`: Fjern kaldet til `syncTaskUrgency.mutate` efter PATCH success. Brugerens form-værdier er allerede sendt til PATCH og gemt. Ingen efterfølgende AI-opdatering.

```ts
// Før:
updateTask.mutate(payload, {
  onSuccess: () => {
    syncTaskUrgency.mutate({ id: task.id, dueAt }, { onSettled: () => { showToast('Gemt!'); closeWithAnimation() } })
  },
})

// Efter:
updateTask.mutate(payload, {
  onSuccess: () => {
    showToast('Gemt!')
    closeWithAnimation()
  },
})
```

**Valgfri forbedring:** Hvis bruger kun ændrer dueAt (ikke importance/urgency), kan urgency beregnes fra deadline på klienten og sendes med i payload – så PATCH får korrekt urgency uden sync. Kræver at `computeUrgencyFromDeadline` importeres i overlay (lib/eisenhower er server-safe, kan bruges på klient).

### 2. Sync-urgency API: Tilføj `preserveManualOverrides`

**Fil:** [app/api/tasks/[id]/sync-urgency/route.ts](app/api/tasks/[id]/sync-urgency/route.ts)

Nyt query/body-parameter: `preserveManualOverrides?: boolean`. Når `true`:
- Hvis task har TaskEvent `overridden` med `importance` eller `urgency` i payload.next → returnér task uændret (eller kun opdater urgency fra dueAt hvis dueAt sat og urgency ikke var i override).
- Ellers: kør som nu.

**Alternativ (enklere):** Behold API uændret. "Genberegn" kalder uden flag = fuld overskrivning. Gem kalder ikke længere sync. Så behøver vi ikke ændre API.

### 3. Cron sync-urgency: Spring over manuelt overskrevne

**Fil:** [lib/sync-urgency.ts](lib/sync-urgency.ts)

For opgaver **uden** deadline (AI-delen): Før AI-parse, tjek om task har seneste TaskEvent `overridden` hvor `payload.next` indeholder `importance` eller `urgency`. Hvis ja, spring task over – brug ikke AI til at overskrive.

```ts
// Pseudokode
const lastOverride = await prisma.taskEvent.findFirst({
  where: { taskId: task.id, eventType: 'overridden' },
  orderBy: { createdAt: 'desc' },
})
const payload = lastOverride?.payload as { next?: Record<string, unknown> } | null
if (payload?.next && ('importance' in payload.next || 'urgency' in payload.next)) {
  continue // spring over – bruger har manuelt overskrevet
}
```

For opgaver **med** deadline: Urgency beregnes fra `computeUrgencyFromDeadline` – ingen AI. Spørgsmål: Skal cron også respektere manuel urgency-override her? Hvis bruger har sat urgency manuelt selv med deadline, vil de måske bevare den. Samme tjek: hvis `urgency` i lastOverride.next → spring over.

### 4. Valgfri: Auto-urgency fra deadline ved Gem

Hvis bruger ændrer dueAt men ikke rører urgency, kan vi automatisk sætte urgency fra deadline i PATCH-payload (på klienten). Det kræver:
- Import af `computeUrgencyFromDeadline` i task-overlay (fra lib/eisenhower – ingen server-only kode).
- I handleSaveAndQualify: hvis `form.dueAt` er sat og `form.urgency` er uændret fra task.urgency (eller tom), brug `computeUrgencyFromDeadline(form.dueAt)` som urgency i payload.

Dette er en UX-forbedring – ikke strengt nødvendig for at løse problemet.

## Opsummering af ændringer

| Fil | Ændring |
|-----|---------|
| `components/task-overlay.tsx` | Fjern `syncTaskUrgency.mutate` fra `handleSaveAndQualify` |
| `lib/sync-urgency.ts` | Tjek TaskEvent overridden før AI-opdatering; spring over hvis importance/urgency manuelt ændret |
| `app/api/tasks/[id]/sync-urgency/route.ts` | (Valgfri) Understøt `preserveManualOverrides` – ellers uændret |

## Testscenarier

1. Åbn opgave → sæt importance 85, urgency 70 → Gem. Verificer at 85 og 70 er gemt (ikke AI-værdier).
2. Åbn opgave → sæt kun dueAt → Gem. Verificer at eksisterende importance/urgency bevares (eller at urgency opdateres fra deadline hvis vi implementerer det).
3. Åbn opgave → Gem (ingen ændringer) → Verificer at værdier bevares.
4. Åbn opgave → Flere handlinger → Genberegn hastegrad. Verificer at AI-værdier anvendes.
5. Manuelt overskriv opgave → Vent på cron (eller kør manuelt) → Verificer at cron ikke overskriver.
