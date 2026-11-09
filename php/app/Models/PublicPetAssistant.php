<?php

namespace App\Models;

use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

class PublicPetAssistant
{
    public function profiles(): Builder
    {
        return DB::table('users as u')
            ->join('operatordata as operator', 'operator.user_id', '=', 'u.id')
            ->leftJoin('personaldata as personal', 'personal.user_id', '=', 'u.id')
            ->leftJoin('operator_public_profile as public_profile', 'public_profile.user_id', '=', 'u.id')
            ->leftJoin('user_reputation as reputation', 'reputation.user_id', '=', 'u.id')
            ->where('u.role', 'pet_assistant');
    }

    public function exists(int $assistantId): bool
    {
        return $this->profiles()->where('u.id', $assistantId)->exists();
    }

    public function get(int $assistantId, int $viewerId): ?array
    {
        $row = $this->profiles()->where('u.id', $assistantId)->first([
            'u.id', 'u.name', 'u.avatar', 'personal.city', 'personal.photo', 'personal.location_lat', 'personal.location_lng',
            'operator.business_name', 'operator.bio', 'operator.experience_years', 'operator.pet_size',
            'operator.booking_confirmation_mode', 'reputation.score', 'public_profile.headline', 'public_profile.typical_day',
            'public_profile.safety_and_home', 'public_profile.owner_instructions', 'public_profile.publish_exact_location',
        ]);
        if (! $row) {
            return null;
        }

        $search = new PetAssistantSearch;
        $viewer = $search->getOptions($viewerId);
        $point = PetAssistantSearch::publicPoint((float) $row->location_lat, (float) $row->location_lng, (bool) $row->publish_exact_location);
        $ownerId = $viewer['authenticatedRole'] === 'pet_owner' ? $viewerId : 0;

        return [
            'id' => $assistantId,
            'name' => $this->displayName($row),
            'photoUrl' => $search->normalizePhotoUrl((string) ($row->photo ?: $row->avatar)),
            'city' => (string) $row->city,
            'distanceKm' => $search->distanceToPoint($search->getOwnerLocation($ownerId), $point),
            'mapPoint' => $point,
            'rankingScore' => (int) ($row->score ?? 60),
            'experienceYears' => (int) $row->experience_years,
            'roles' => $this->labels($assistantId, 'operatortitledata', 'operatortitle', 'title_id'),
            'headline' => (string) $row->headline,
            'bio' => (string) $row->bio,
            'typicalDay' => (string) $row->typical_day,
            'safetyAndHome' => (string) $row->safety_and_home,
            'ownerInstructions' => (string) $row->owner_instructions,
            'petSize' => (string) $row->pet_size,
            'breeds' => $this->labels($assistantId, 'petbreeddata', 'petbreed', 'petbreed_id'),
            'petTypes' => $this->labels($assistantId, 'pettypedata', 'pettype', 'pettype_id'),
            'houseFeatures' => $this->labels($assistantId, 'housefeaturedata', 'housefeature', 'housefeature_id'),
            'gallery' => DB::table('operatorgallery')->where('user_id', $assistantId)->orderBy('sortorder')->orderBy('id')
                ->get(['id', 'photo', 'caption'])->map(fn ($photo) => [
                    'id' => (int) $photo->id,
                    'photoUrl' => $search->normalizePhotoUrl((string) $photo->photo),
                    'caption' => (string) $photo->caption,
                ])->all(),
            'services' => $search->getAssistantServices([$assistantId])->get($assistantId, []),
            'confirmationMode' => (string) $row->booking_confirmation_mode,
            'responses' => $this->responseStats($assistantId),
            'reviews' => $this->reviews($assistantId),
            'favorite' => $ownerId > 0 && $this->favorites($ownerId)->where('assistant_user_id', $assistantId)->exists(),
            'viewerRole' => $viewer['authenticatedRole'],
            'pets' => $viewer['pets'],
            'policies' => $viewer['policies'],
        ];
    }

    public function favorites(int $ownerId): Builder
    {
        return DB::table('pet_assistant_favorite')->where('owner_user_id', $ownerId);
    }

    public function listFavorites(int $ownerId): array
    {
        $search = new PetAssistantSearch;

        return $this->profiles()->join('pet_assistant_favorite as favorite', 'favorite.assistant_user_id', '=', 'u.id')
            ->where('favorite.owner_user_id', $ownerId)->orderByDesc('favorite.created_at')->orderBy('u.id')
            ->get(['u.id', 'u.name', 'u.avatar', 'personal.city', 'personal.photo', 'operator.business_name'])
            ->map(fn ($row) => [
                'id' => (int) $row->id,
                'name' => $this->displayName($row),
                'city' => (string) $row->city,
                'photoUrl' => $search->normalizePhotoUrl((string) ($row->photo ?: $row->avatar)),
            ])->all();
    }

    public function setFavorite(int $ownerId, int $assistantId, bool $favorite): void
    {
        if ($favorite) {
            DB::table('pet_assistant_favorite')->insertOrIgnore([
                'owner_user_id' => $ownerId,
                'assistant_user_id' => $assistantId,
                'created_at' => time(),
            ]);
        } else {
            $this->favorites($ownerId)->where('assistant_user_id', $assistantId)->delete();
        }
    }

    public function responseStats(int $assistantId, ?int $now = null): array
    {
        $now ??= time();
        $rows = DB::table('booking')->where('assistant_user_id', $assistantId)
            ->where('confirmation_mode', 'manual')->whereBetween('created_at', [$now - 90 * 86400, $now])
            ->get(['first_response_at', 'created_at', 'response_deadline', 'cancelled_by_user_id', 'owner_user_id', 'cancelled_at', 'status']);
        $eligible = 0;
        $seconds = [];
        foreach ($rows as $row) {
            $reply = (int) $row->first_response_at;
            if ($reply > 0 && $reply >= (int) $row->created_at && $reply <= $now) {
                $eligible++;
                $seconds[] = $reply - (int) $row->created_at;
                continue;
            }

            $deadline = (int) $row->response_deadline;
            $withdrawn = $row->status === 'cancelled'
                && (int) $row->cancelled_by_user_id === (int) $row->owner_user_id
                && (int) $row->cancelled_at > 0 && (int) $row->cancelled_at < $deadline;
            if (! $withdrawn && $deadline > 0 && $deadline <= $now) {
                $eligible++;
            }
        }

        sort($seconds, SORT_NUMERIC);
        $count = count($seconds);
        $median = $count === 0 ? null : (int) round(($seconds[intdiv($count - 1, 2)] + $seconds[intdiv($count, 2)]) / 2);

        return ['rate' => $eligible > 0 ? (int) round(100 * $count / $eligible) : null, 'medianSeconds' => $median];
    }

    private function reviews(int $assistantId): array
    {
        $query = DB::table('booking_review as review')
            ->join('booking', 'booking.id', '=', 'review.booking_id')
            ->join('service', 'service.id', '=', 'booking.service_id')
            ->where('review.reviewed_user_id', $assistantId)
            ->whereColumn('review.reviewer_user_id', 'booking.owner_user_id')
            ->whereColumn('review.reviewed_user_id', 'booking.assistant_user_id');
        $counts = (clone $query)->groupBy('review.sentiment')->selectRaw('review.sentiment, COUNT(*) AS total')
            ->pluck('total', 'sentiment');

        return [
            'positive' => (int) ($counts['positive'] ?? 0),
            'negative' => (int) ($counts['negative'] ?? 0),
            'comments' => $query->where('review.publish_comment', 1)->orderByDesc('review.created_at')->orderByDesc('review.id')
                ->limit(20)->get(['review.id', 'review.sentiment', 'review.comment', 'review.created_at', 'service.name'])
                ->map(fn ($row) => [
                    'id' => (int) $row->id,
                    'sentiment' => (string) $row->sentiment,
                    'text' => (string) $row->comment,
                    'date' => (int) $row->created_at,
                    'service' => (string) $row->name,
                ])->all(),
        ];
    }

    private function labels(int $assistantId, string $table, string $catalog, string $foreignKey): array
    {
        return DB::table($table.' as selected')->join($catalog.' as catalog', 'catalog.id', '=', 'selected.'.$foreignKey)
            ->where('selected.user_id', $assistantId)->orderBy('catalog.name')->pluck('catalog.name')->all();
    }

    private function displayName(object $row): string
    {
        return trim((string) $row->business_name) ?: (string) $row->name;
    }
}
