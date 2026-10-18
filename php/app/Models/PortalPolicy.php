<?php

namespace App\Models;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class PortalPolicy
{
    public const DEFINITIONS = [
        'booking_min_notice_hours' => ['label' => 'Anticipo minimo prenotazione', 'description' => 'Ore minime tra la richiesta e l’inizio del servizio.', 'value' => 24, 'unit' => 'ore', 'min' => 1, 'max' => 168, 'group' => 'Prenotazioni'],
        'manual_response_hours' => ['label' => 'Tempo risposta richiesta manuale', 'description' => 'Ore disponibili al Pet Assistant per rispondere.', 'value' => 24, 'unit' => 'ore', 'min' => 1, 'max' => 168, 'group' => 'Prenotazioni'],
        'assistant_cutoff_hours' => ['label' => 'Scadenza prima del servizio', 'description' => 'Ore prima del servizio entro cui il Pet Assistant deve rispondere o annullare senza penalità.', 'value' => 3, 'unit' => 'ore', 'min' => 1, 'max' => 72, 'group' => 'Prenotazioni'],
        'owner_free_cancellation_hours' => ['label' => 'Annullamento gratuito Pet Owner', 'description' => 'Ore di anticipo necessarie per annullare senza penalità.', 'value' => 24, 'unit' => 'ore', 'min' => 0, 'max' => 168, 'group' => 'Cancellazioni'],
        'owner_late_cancellation_penalty' => ['label' => 'Penalità Pet Owner', 'description' => 'Punti sottratti per un annullamento tardivo.', 'value' => 5, 'unit' => 'punti', 'min' => 0, 'max' => 50, 'group' => 'Ranking'],
        'assistant_late_action_penalty' => ['label' => 'Penalità Pet Assistant', 'description' => 'Punti sottratti per rifiuto o annullamento oltre la scadenza.', 'value' => 5, 'unit' => 'punti', 'min' => 0, 'max' => 50, 'group' => 'Ranking'],
        'positive_review_points' => ['label' => 'Recensione positiva', 'description' => 'Punti aggiunti al destinatario di una recensione positiva.', 'value' => 5, 'unit' => 'punti', 'min' => 0, 'max' => 50, 'group' => 'Ranking'],
        'negative_review_penalty' => ['label' => 'Recensione negativa', 'description' => 'Punti sottratti al destinatario di una recensione negativa.', 'value' => 5, 'unit' => 'punti', 'min' => 0, 'max' => 50, 'group' => 'Ranking'],
        'initial_reputation_score' => ['label' => 'Ranking iniziale', 'description' => 'Punteggio assegnato a ogni nuovo iscritto.', 'value' => 60, 'unit' => 'su 100', 'min' => 0, 'max' => 100, 'group' => 'Ranking'],
        'review_window_days' => ['label' => 'Periodo disponibile per recensione', 'description' => 'Giorni disponibili dal termine del servizio per recensire.', 'value' => 30, 'unit' => 'giorni', 'min' => 1, 'max' => 365, 'group' => 'Recensioni'],
        'max_booking_duration_minutes' => ['label' => 'Durata massima prenotazione', 'description' => 'Durata massima selezionabile, in multipli di 30 minuti.', 'value' => 480, 'unit' => 'minuti', 'min' => 30, 'max' => 1440, 'group' => 'Prenotazioni'],
    ];

    public static function values(): array
    {
        $values = array_map(static fn (array $definition) => (int) $definition['value'], self::DEFINITIONS);
        if (! Schema::hasTable('portal_policy')) {
            return $values;
        }

        foreach (DB::table('portal_policy')->pluck('value', 'policy_key') as $key => $value) {
            if (array_key_exists($key, $values)) {
                $values[$key] = (int) $value;
            }
        }

        return $values;
    }

    public static function value(string $key): int
    {
        return self::values()[$key] ?? (int) (self::DEFINITIONS[$key]['value'] ?? 0);
    }

    public static function adminRows(): array
    {
        $values = self::values();

        return array_map(static function (string $key) use ($values) {
            return ['key' => $key, ...self::DEFINITIONS[$key], 'value' => $values[$key]];
        }, array_keys(self::DEFINITIONS));
    }

    public static function publicSnapshot(): array
    {
        $values = self::values();

        return [
            'bookingMinNoticeHours' => $values['booking_min_notice_hours'],
            'manualResponseHours' => $values['manual_response_hours'],
            'assistantCutoffHours' => $values['assistant_cutoff_hours'],
            'ownerFreeCancellationHours' => $values['owner_free_cancellation_hours'],
            'ownerLateCancellationPenalty' => $values['owner_late_cancellation_penalty'],
            'assistantLateActionPenalty' => $values['assistant_late_action_penalty'],
            'positiveReviewPoints' => $values['positive_review_points'],
            'negativeReviewPenalty' => $values['negative_review_penalty'],
            'initialReputationScore' => $values['initial_reputation_score'],
            'reviewWindowDays' => $values['review_window_days'],
            'maxBookingDurationMinutes' => $values['max_booking_duration_minutes'],
        ];
    }
}
