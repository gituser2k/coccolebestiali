<?php

namespace App\Models;

use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class PetAssistantSearch
{
    public function getOptions(int $userId = 0): array
    {
        $featuresByService = DB::table('servicefeaturedata as data')
            ->join('servicefeature as feature', 'feature.id', '=', 'data.feature_id')
            ->orderBy('feature.name')
            ->get(['data.service_id', 'feature.id', 'feature.name'])
            ->groupBy('service_id');

        $services = DB::table('service')
            ->select(['id', 'name', 'description'])
            ->orderBy('name')
            ->get()
            ->map(fn ($service) => [
                'id' => (int) $service->id,
                'name' => (string) $service->name,
                'description' => (string) $service->description,
                'features' => collect($featuresByService->get($service->id, []))->map(fn ($feature) => [
                    'id' => (int) $feature->id,
                    'name' => (string) $feature->name,
                ])->values()->all(),
            ])
            ->all();

        $pets = [];
        $role = '';

        if ($userId > 0) {
            $role = (string) DB::table('users')->where('id', $userId)->value('role');

            if ($role === 'pet_owner') {
                $pets = DB::table('ownerpet as p')
                    ->leftJoin('ownerpetgallery as g', function ($join) {
                        $join->on('g.pet_id', '=', 'p.id')
                            ->whereRaw('g.id = (SELECT g2.id FROM ownerpetgallery g2 WHERE g2.pet_id = p.id ORDER BY g2.is_profile DESC, g2.sortorder, g2.id LIMIT 1)');
                    })
                    ->select(['p.id', 'p.name', 'p.pet_size', 'g.photo'])
                    ->where('p.user_id', $userId)
                    ->orderBy('p.sortorder')
                    ->orderBy('p.id')
                    ->get()
                    ->map(fn ($pet) => [
                        'id' => (int) $pet->id,
                        'name' => (string) $pet->name,
                        'petSize' => (string) $pet->pet_size,
                        'photoUrl' => $this->normalizePhotoUrl((string) ($pet->photo ?? '')),
                    ])
                    ->all();
            }
        }

        return [
            'services' => $services,
            'pets' => $pets,
            'authenticatedRole' => $role,
            'policies' => PortalPolicy::publicSnapshot(),
        ];
    }

    public function search(string $startDate, string $endDate, array $serviceIds, int $petId = 0, int $userId = 0, int $durationMinutes = 60, string $sortBy = 'ranking', bool $onlyWithPhoto = false, array $optionFilters = [], bool $onlyFavorites = false, bool $showFavoriteStatus = false): array
    {
        $canReadFavorites = ($onlyFavorites || $showFavoriteStatus)
            && DB::table('users')->where('id', $userId)->where('role', 'pet_owner')->exists();
        if ($onlyFavorites && ! $canReadFavorites) {
            throw new RuntimeException('FAVORITES_OWNER_REQUIRED');
        }

        $serviceIds = array_values(array_unique(array_filter(array_map('intval', $serviceIds), fn ($id) => $id > 0)));
        $requiredFeatures = $this->normalizeOptionFilters($optionFilters, $serviceIds);

        $pet = $petId > 0 ? $this->getOwnedPet($userId, $petId) : null;

        $availability = DB::table('calendar_day as day')
            ->join('calendar_day_slot as slot', 'slot.calendar_day_id', '=', 'day.id')
            ->join('calendar_day_slot_service as slot_service', 'slot_service.slot_id', '=', 'slot.id')
            ->join('users as user', 'user.id', '=', 'day.user_id')
            ->join('personaldata as personal', 'personal.user_id', '=', 'user.id')
            ->join('operatordata as operator', 'operator.user_id', '=', 'user.id')
            ->join('service', 'service.id', '=', 'slot_service.service_id')
            ->leftJoin('user_reputation as reputation', 'reputation.user_id', '=', 'user.id')
            ->leftJoin('operator_public_profile as public_profile', 'public_profile.user_id', '=', 'user.id')
            ->join('operatorservicedata as operator_service', function ($join) {
                $join->on('operator_service.user_id', '=', 'user.id')
                    ->on('operator_service.service_id', '=', 'service.id');
            })
            ->where('user.role', 'pet_assistant')
            ->where('day.enabled', 1)
            ->where('slot.enabled', 1)
            ->where('slot_service.enabled', 1)
            ->whereBetween('day.date', [$startDate, $endDate])
            ->whereIn('slot_service.service_id', $serviceIds)
            ->when($onlyWithPhoto, fn ($query) => $query->whereRaw("TRIM(COALESCE(personal.photo, '')) <> ''"))
            ->when($onlyFavorites, fn ($query) => $query->whereIn('user.id', (new PublicPetAssistant)->favorites($userId)->select('assistant_user_id')))
            ->select([
                'user.id as user_id',
                'user.name as alias',
                'user.avatar',
                'personal.photo',
                'personal.city',
                'personal.location_lat',
                'personal.location_lng',
                'public_profile.publish_exact_location',
                'operator.operator_type',
                'operator.business_name',
                'operator.bio',
                'operator.experience_years',
                'operator.pet_size',
                'operator.booking_confirmation_mode',
                'service.id as service_id',
                'service.name as service_name',
                'service.description as service_description',
                'service.requires_home_photo as service_requires_home_photo',
                'operator_service.home_photo_enabled as operator_home_photo_enabled',
                'slot.id as slot_id',
                'day.date',
                'slot.start_time',
                'slot.end_time',
                'slot_service.hour_price as slot_hour_price',
                'operator_service.hour_price as service_hour_price',
                DB::raw('COALESCE(reputation.score, 60) as ranking_score'),
            ])
            ->orderBy('day.date')
            ->orderBy('slot.start_time')
            ->get();

        $availability = $this->filterAvailabilityByOptions($availability, $requiredFeatures);

        if ($availability->isEmpty()) {
            return [
                'results' => [],
                'total' => 0,
                'pet' => $pet ? $this->petSummary($pet) : null,
            ];
        }

        $availability = $this->expandAvailableIntervals($availability, $startDate, $endDate, $durationMinutes);
        if ($availability->isEmpty()) {
            return [
                'results' => [],
                'total' => 0,
                'pet' => $pet ? $this->petSummary($pet) : null,
            ];
        }

        $candidateIds = $availability->pluck('user_id')->map(fn ($id) => (int) $id)->unique()->values()->all();
        $compatibility = $this->buildPetCompatibility($candidateIds, $pet);
        $candidateIds = array_values(array_filter($candidateIds, fn ($id) => $compatibility[$id]['matches'] ?? false));

        if ($candidateIds === []) {
            return [
                'results' => [],
                'total' => 0,
                'pet' => $pet ? $this->petSummary($pet) : null,
            ];
        }

        $favoriteIds = [];
        if ($onlyFavorites) {
            $favoriteIds = array_fill_keys($candidateIds, true);
        } elseif ($canReadFavorites) {
            $favoriteIds = (new PublicPetAssistant)->favorites($userId)->whereIn('assistant_user_id', $candidateIds)
                ->pluck('assistant_user_id')->flip()->all();
        }

        $titles = DB::table('operatortitledata as data')
            ->join('operatortitle as title', 'title.id', '=', 'data.title_id')
            ->whereIn('data.user_id', $candidateIds)
            ->orderBy('title.sortorder')
            ->orderBy('title.name')
            ->get(['data.user_id', 'title.name'])
            ->groupBy('user_id');

        $houseGalleries = DB::table('operatorgallery')
            ->whereIn('user_id', $candidateIds)
            ->orderBy('user_id')
            ->orderBy('sortorder')
            ->orderBy('id')
            ->get(['id', 'user_id', 'photo', 'caption', 'sortorder'])
            ->groupBy('user_id');

        $allServices = $this->getAssistantServices($candidateIds);
        $rowsByAssistant = $availability
            ->whereIn('user_id', $candidateIds)
            ->groupBy('user_id');

        $ownerLocation = $this->getOwnerLocation($userId);
        $results = $rowsByAssistant->map(function ($rows, $assistantId) use ($compatibility, $titles, $houseGalleries, $allServices, $durationMinutes, $ownerLocation, $requiredFeatures, $favoriteIds) {
            $first = $rows->first();
            $matchedServices = $rows->groupBy('service_id')->map(function ($serviceRows) use ($durationMinutes, $allServices, $assistantId, $requiredFeatures) {
                $service = $serviceRows->first();
                $serviceDetails = collect($allServices->get((int) $assistantId, []))->firstWhere('id', (int) $service->service_id);
                $rates = $serviceRows->map(function ($row) {
                    $slotRate = (float) $row->slot_hour_price;

                    return $slotRate > 0 ? $slotRate : (float) $row->service_hour_price;
                })->filter(fn ($rate) => $rate > 0);

                return [
                    'id' => (int) $service->service_id,
                    'name' => (string) $service->service_name,
                    'description' => (string) $service->service_description,
                    'features' => $serviceDetails['features'] ?? [],
                    'requestedFeatureIds' => $requiredFeatures[(int) $service->service_id] ?? [],
                    'requiresHomePhoto' => (bool) $service->service_requires_home_photo
                        && (bool) $service->operator_home_photo_enabled,
                    'hourlyRate' => $rates->isEmpty() ? 0 : round((float) $rates->min(), 2),
                    'totalCost' => $rates->isEmpty() ? 0 : round((float) $rates->min() * ($durationMinutes / 60), 2),
                    'availableDays' => $serviceRows->pluck('date')->unique()->count(),
                    'slots' => $serviceRows->take(4)->map(fn ($row) => [
                        'slotId' => (int) $row->slot_id,
                        'date' => (string) $row->date,
                        'startTime' => (string) $row->free_start_time,
                        'endTime' => (string) $row->free_end_time,
                        'hourlyRate' => round((float) (((float) $row->slot_hour_price > 0) ? $row->slot_hour_price : $row->service_hour_price), 2),
                        'confirmationMode' => (string) ($row->booking_confirmation_mode ?? 'manual'),
                    ])->values()->all(),
                ];
            })->sortByDesc(fn ($service) => count($service['requestedFeatureIds']))->values()->all();

            $matchedServiceIds = collect($matchedServices)->pluck('id')->all();
            $otherServices = collect($allServices->get((int) $assistantId, []))
                ->reject(fn ($service) => in_array($service['id'], $matchedServiceIds, true))
                ->values()
                ->all();
            $displayName = trim((string) $first->business_name);
            if ($displayName === '') {
                $displayName = (string) $first->alias;
            }

            $point = self::publicPoint((float) $first->location_lat, (float) $first->location_lng, (bool) $first->publish_exact_location);

            return [
                'id' => (int) $assistantId,
                'favorite' => isset($favoriteIds[$assistantId]),
                'name' => $displayName,
                'alias' => (string) $first->alias,
                'photoUrl' => $this->normalizePhotoUrl((string) ($first->photo ?: $first->avatar)),
                'city' => (string) $first->city,
                'bio' => (string) $first->bio,
                'experienceYears' => (int) $first->experience_years,
                'rankingScore' => (int) $first->ranking_score,
                'stars' => round(((int) $first->ranking_score / 20) * 2) / 2,
                'distanceKm' => $this->distanceToPoint($ownerLocation, $point),
                'titles' => collect($titles->get((int) $assistantId, []))->pluck('name')->values()->all(),
                'houseGallery' => collect($houseGalleries->get((int) $assistantId, []))->map(fn ($photo) => [
                    'id' => (int) $photo->id,
                    'photoUrl' => $this->normalizePhotoUrl((string) $photo->photo),
                    'caption' => (string) $photo->caption,
                    'sortorder' => (int) $photo->sortorder,
                ])->values()->all(),
                'petMatch' => $compatibility[(int) $assistantId]['label'] ?? '',
                'matchedServices' => $matchedServices,
                'otherServices' => $otherServices,
                'availableDays' => $rows->pluck('date')->unique()->count(),
                'firstAvailableDate' => (string) $rows->min('date'),
                'minimumTotalCost' => collect($matchedServices)->pluck('totalCost')->filter(fn ($value) => $value > 0)->min() ?: 0,
            ];
        })->values()->sort(fn ($left, $right) => $this->compareResults($left, $right, $sortBy))->values()->all();

        return [
            'results' => $results,
            'total' => count($results),
            'pet' => $pet ? $this->petSummary($pet) : null,
        ];
    }

    private function normalizeOptionFilters(array $optionFilters, array $serviceIds): array
    {
        $selectedServices = array_flip($serviceIds);
        $allowedFeatures = DB::table('servicefeaturedata')
            ->whereIn('service_id', $serviceIds)
            ->get(['service_id', 'feature_id'])
            ->groupBy('service_id')
            ->map(fn ($rows) => $rows->pluck('feature_id')->map(fn ($id) => (int) $id)->all());
        $normalized = [];

        foreach ($optionFilters as $filter) {
            $serviceId = (int) ($filter['serviceId'] ?? 0);
            if ($serviceId <= 0 || ! isset($selectedServices[$serviceId])) {
                continue;
            }

            $featureIds = array_values(array_unique(array_filter(
                array_map('intval', $filter['featureIds'] ?? []),
                fn ($featureId) => $featureId > 0
            )));
            $featureIds = array_values(array_intersect($featureIds, $allowedFeatures->get($serviceId, [])));
            if ($featureIds !== []) {
                $normalized[$serviceId] = $featureIds;
            }
        }

        return $normalized;
    }

    private function filterAvailabilityByOptions($availability, array $requiredFeatures)
    {
        if ($availability->isEmpty() || $requiredFeatures === []) {
            return $availability;
        }

        $assistantIds = $availability->pluck('user_id')->map(fn ($id) => (int) $id)->unique()->values()->all();
        $featureRows = DB::table('operatorservicefeaturedata')
            ->whereIn('user_id', $assistantIds)
            ->whereIn('service_id', array_keys($requiredFeatures))
            ->get(['user_id', 'service_id', 'feature_id'])
            ->groupBy(fn ($row) => $row->user_id.'|'.$row->service_id);

        $matchingAssistantsByService = [];
        foreach ($requiredFeatures as $serviceId => $featureIds) {
            $availableAssistantIds = $availability
                ->where('service_id', $serviceId)
                ->pluck('user_id')
                ->map(fn ($id) => (int) $id)
                ->unique()
                ->all();
            $matchingAssistantsByService[$serviceId] = collect($availableAssistantIds)->filter(function ($assistantId) use ($featureRows, $serviceId, $featureIds) {
                $enabledFeatureIds = collect($featureRows->get($assistantId.'|'.$serviceId, []))
                    ->pluck('feature_id')
                    ->map(fn ($id) => (int) $id)
                    ->all();

                return array_diff($featureIds, $enabledFeatureIds) === [];
            })->all();
        }

        $matchingAssistantIds = collect($assistantIds)->filter(function ($assistantId) use ($matchingAssistantsByService) {
            foreach ($matchingAssistantsByService as $serviceAssistantIds) {
                if (! in_array($assistantId, $serviceAssistantIds, true)) {
                    return false;
                }
            }

            return true;
        })->all();

        return $availability->filter(function ($row) use ($requiredFeatures, $matchingAssistantIds, $matchingAssistantsByService) {
            $assistantId = (int) $row->user_id;
            $serviceId = (int) $row->service_id;
            if (! in_array($assistantId, $matchingAssistantIds, true)) {
                return false;
            }

            return ! isset($requiredFeatures[$serviceId])
                || in_array($assistantId, $matchingAssistantsByService[$serviceId], true);
        })->values();
    }

    public function assistantAvailability(int $assistantId, string $startDate, string $endDate): array
    {
        $rows = DB::table('calendar_day as day')
            ->join('calendar_day_slot as slot', 'slot.calendar_day_id', '=', 'day.id')
            ->join('calendar_day_slot_service as offered', 'offered.slot_id', '=', 'slot.id')
            ->join('operatorservicedata as service', function ($join) {
                $join->on('service.user_id', '=', 'day.user_id')->on('service.service_id', '=', 'offered.service_id');
            })
            ->where('day.user_id', $assistantId)
            ->whereBetween('day.date', [$startDate, $endDate])
            ->where('day.enabled', 1)->where('slot.enabled', 1)->where('offered.enabled', 1)
            ->orderBy('day.date')->orderBy('slot.start_time')->orderBy('slot.id')
            ->get(['day.user_id', 'day.date', 'slot.id as slot_id', 'slot.start_time', 'slot.end_time', 'offered.service_id', 'offered.hour_price']);

        return $this->expandAvailableIntervals($rows, $startDate, $endDate, 30)->map(fn ($row) => [
            'serviceId' => (int) $row->service_id,
            'slotId' => (int) $row->slot_id,
            'date' => (string) $row->date,
            'startTime' => (string) $row->free_start_time,
            'endTime' => (string) $row->free_end_time,
            'hourlyRateCents' => (int) round((float) $row->hour_price * 100),
        ])->all();
    }

    private function expandAvailableIntervals($availability, string $startDate, string $endDate, int $durationMinutes)
    {
        $assistantIds = $availability->pluck('user_id')->map(fn ($id) => (int) $id)->unique()->values()->all();
        $blocked = DB::table('booking')
            ->whereIn('assistant_user_id', $assistantIds)
            ->whereBetween('booking_date', [$startDate, $endDate])
            ->whereIn('status', ['pending', 'confirmed', 'reschedule_pending'])
            ->where(fn ($query) => $query->where('status', '<>', 'pending')
                ->orWhere('response_deadline', '>', time())->orWhere('response_deadline', 0))
            ->get(['assistant_user_id', 'booking_date', 'start_time', 'end_time'])
            ->groupBy(fn ($row) => $row->assistant_user_id.'|'.$row->booking_date);
        $proposals = DB::table('booking_reschedule as proposal')
            ->join('booking', 'booking.id', '=', 'proposal.booking_id')
            ->whereIn('booking.assistant_user_id', $assistantIds)
            ->whereBetween('proposal.booking_date', [$startDate, $endDate])
            ->where('proposal.status', 'pending')
            ->get(['booking.assistant_user_id', 'proposal.booking_date', 'proposal.start_time', 'proposal.end_time']);
        foreach ($proposals as $proposal) {
            $key = $proposal->assistant_user_id.'|'.$proposal->booking_date;
            $blocked->put($key, collect($blocked->get($key, []))->push($proposal));
        }

        $minimumTimestamp = (new DateTimeImmutable('now', new DateTimeZone('Europe/Rome')))
            ->modify('+'.PortalPolicy::value('booking_min_notice_hours').' hours')
            ->getTimestamp();

        return $availability->flatMap(function ($row) use ($blocked, $durationMinutes, $minimumTimestamp) {
            $segments = [[$this->timeToMinutes((string) $row->start_time), $this->timeToMinutes((string) $row->end_time)]];
            foreach ($blocked->get($row->user_id.'|'.$row->date, []) as $busy) {
                $segments = $this->subtractInterval($segments, $this->timeToMinutes((string) $busy->start_time), $this->timeToMinutes((string) $busy->end_time));
            }

            return collect($segments)->filter(function ($segment) use ($row, $durationMinutes, $minimumTimestamp) {
                $start = max($segment[0], $this->timestampToDayMinutes($minimumTimestamp, (string) $row->date));

                return ($segment[1] - $start) >= $durationMinutes;
            })->map(function ($segment) use ($row, $minimumTimestamp) {
                $start = max($segment[0], $this->timestampToDayMinutes($minimumTimestamp, (string) $row->date));
                $offset = ($start - $this->timeToMinutes((string) $row->start_time)) % 30;
                if ($offset !== 0) {
                    $start += 30 - $offset;
                }
                $clone = clone $row;
                $clone->free_start_time = $this->minutesToTime($start);
                $clone->free_end_time = $this->minutesToTime($segment[1]);

                return $clone;
            })->filter(fn ($candidate) => ($this->timeToMinutes((string) $candidate->free_end_time) - $this->timeToMinutes((string) $candidate->free_start_time)) >= $durationMinutes);
        })->values();
    }

    private function subtractInterval(array $segments, int $busyStart, int $busyEnd): array
    {
        $result = [];
        foreach ($segments as [$start, $end]) {
            if ($busyEnd <= $start || $busyStart >= $end) {
                $result[] = [$start, $end];

                continue;
            }
            if ($busyStart > $start) {
                $result[] = [$start, min($busyStart, $end)];
            }
            if ($busyEnd < $end) {
                $result[] = [max($busyEnd, $start), $end];
            }
        }

        return $result;
    }

    public function getOwnerLocation(int $userId): ?array
    {
        if ($userId <= 0) {
            return null;
        }
        $row = DB::table('personaldata')->where('user_id', $userId)->first(['location_lat', 'location_lng']);
        if (! $row || (float) $row->location_lat === 0.0 || (float) $row->location_lng === 0.0) {
            return null;
        }

        return [(float) $row->location_lat, (float) $row->location_lng];
    }

    public static function publicPoint(float $latitude, float $longitude, bool $exact): ?array
    {
        if ($latitude === 0.0 || $longitude === 0.0 || abs($latitude) > 90 || abs($longitude) > 180) {
            return null;
        }

        return [
            'latitude' => $exact ? $latitude : round($latitude, 2),
            'longitude' => $exact ? $longitude : round($longitude, 2),
            'exact' => $exact,
        ];
    }

    public function distanceToPoint(?array $origin, ?array $point): ?float
    {
        if ($origin === null || $point === null) {
            return null;
        }
        ['latitude' => $latitude, 'longitude' => $longitude] = $point;
        [$originLat, $originLng] = $origin;
        $latDelta = deg2rad($latitude - $originLat);
        $lngDelta = deg2rad($longitude - $originLng);
        $a = sin($latDelta / 2) ** 2 + cos(deg2rad($originLat)) * cos(deg2rad($latitude)) * sin($lngDelta / 2) ** 2;

        return round(6371 * (2 * atan2(sqrt($a), sqrt(1 - $a))), 1);
    }

    private function compareResults(array $left, array $right, string $sortBy): int
    {
        if ($sortBy === 'distance') {
            $leftValue = $left['distanceKm'] ?? PHP_FLOAT_MAX;
            $rightValue = $right['distanceKm'] ?? PHP_FLOAT_MAX;
            $comparison = $leftValue <=> $rightValue;
        } elseif ($sortBy === 'cost' || $sortBy === 'cost_desc') {
            $fallback = $sortBy === 'cost' ? PHP_FLOAT_MAX : -PHP_FLOAT_MAX;
            $leftValue = $left['minimumTotalCost'] > 0 ? $left['minimumTotalCost'] : $fallback;
            $rightValue = $right['minimumTotalCost'] > 0 ? $right['minimumTotalCost'] : $fallback;
            $comparison = $sortBy === 'cost' ? $leftValue <=> $rightValue : $rightValue <=> $leftValue;
        } else {
            $comparison = $right['rankingScore'] <=> $left['rankingScore'];
        }

        return $comparison !== 0 ? $comparison : strcmp($left['firstAvailableDate'], $right['firstAvailableDate']);
    }

    private function timeToMinutes(string $time): int
    {
        [$hour, $minute] = array_map('intval', explode(':', $time));

        return ($hour * 60) + $minute;
    }

    private function minutesToTime(int $minutes): string
    {
        return sprintf('%02d:%02d', intdiv($minutes, 60), $minutes % 60);
    }

    private function timestampToDayMinutes(int $timestamp, string $date): int
    {
        $localDateTime = (new DateTimeImmutable('@'.$timestamp))->setTimezone(new DateTimeZone('Europe/Rome'));
        if ($localDateTime->format('Y-m-d') < $date) {
            return 0;
        }
        if ($localDateTime->format('Y-m-d') > $date) {
            return 24 * 60;
        }

        return ((int) $localDateTime->format('H') * 60) + (int) $localDateTime->format('i');
    }

    private function getOwnedPet(int $userId, int $petId): object
    {
        if ($userId <= 0) {
            throw new RuntimeException('PET_OWNER_SESSION_REQUIRED');
        }

        $pet = DB::table('ownerpet')
            ->where('id', $petId)
            ->where('user_id', $userId)
            ->first(['id', 'name', 'pet_size']);

        if (! $pet) {
            throw new RuntimeException('PET_NOT_AVAILABLE');
        }

        $pet->breedIds = DB::table('ownerpetbreeddata')->where('pet_id', $petId)->pluck('petbreed_id')->map(fn ($id) => (int) $id)->all();
        $pet->typeIds = DB::table('ownerpettypedata')->where('pet_id', $petId)->pluck('pettype_id')->map(fn ($id) => (int) $id)->all();

        return $pet;
    }

    private function buildPetCompatibility(array $assistantIds, ?object $pet): array
    {
        if ($pet === null) {
            return collect($assistantIds)->mapWithKeys(fn ($id) => [$id => [
                'matches' => true,
                'label' => '',
            ]])->all();
        }

        $anyBreedId = (int) DB::table('petbreed')->whereRaw('LOWER(name) = ?', ['qualsiasi'])->value('id');
        $anyTypeId = (int) DB::table('pettype')->whereRaw('LOWER(name) = ?', ['qualsiasi'])->value('id');
        $breeds = DB::table('petbreeddata')->whereIn('user_id', $assistantIds)->get(['user_id', 'petbreed_id'])->groupBy('user_id');
        $types = DB::table('pettypedata')->whereIn('user_id', $assistantIds)->get(['user_id', 'pettype_id'])->groupBy('user_id');
        $sizes = DB::table('operatordata')->whereIn('user_id', $assistantIds)->pluck('pet_size', 'user_id');

        $result = [];
        foreach ($assistantIds as $assistantId) {
            $assistantBreedIds = collect($breeds->get($assistantId, []))->pluck('petbreed_id')->map(fn ($id) => (int) $id)->all();
            $assistantTypeIds = collect($types->get($assistantId, []))->pluck('pettype_id')->map(fn ($id) => (int) $id)->all();
            $breedMatches = $pet->breedIds === []
                || in_array($anyBreedId, $assistantBreedIds, true)
                || array_intersect($pet->breedIds, $assistantBreedIds) !== [];
            $typeMatches = $pet->typeIds === []
                || in_array($anyTypeId, $assistantTypeIds, true)
                || array_intersect($pet->typeIds, $assistantTypeIds) !== [];
            $sizeMatches = (string) $pet->pet_size === '' || (string) ($sizes[$assistantId] ?? '') === (string) $pet->pet_size;

            $result[$assistantId] = [
                'matches' => $breedMatches && $typeMatches && $sizeMatches,
                'label' => $breedMatches && $typeMatches && $sizeMatches ? 'Compatibile con '.$pet->name : '',
            ];
        }

        return $result;
    }

    public function getAssistantServices(array $assistantIds)
    {
        $features = DB::table('operatorservicefeaturedata as data')
            ->join('servicefeature as feature', 'feature.id', '=', 'data.feature_id')
            ->whereIn('data.user_id', $assistantIds)
            ->orderBy('feature.name')
            ->get(['data.user_id', 'data.service_id', 'feature.id', 'feature.name'])
            ->groupBy(fn ($row) => $row->user_id.'-'.$row->service_id);

        return DB::table('operatorservicedata as data')
            ->join('service', 'service.id', '=', 'data.service_id')
            ->whereIn('data.user_id', $assistantIds)
            ->orderBy('service.name')
            ->get(['data.user_id', 'service.id', 'service.name', 'service.description', 'data.hour_price'])
            ->groupBy('user_id')
            ->map(fn ($rows) => $rows->map(fn ($row) => [
                'id' => (int) $row->id,
                'name' => (string) $row->name,
                'description' => (string) $row->description,
                'hourlyRate' => round((float) $row->hour_price, 2),
                'features' => collect($features->get($row->user_id.'-'.$row->id, []))->map(fn ($feature) => [
                    'id' => (int) $feature->id,
                    'name' => (string) $feature->name,
                ])->values()->all(),
            ])->values()->all());
    }

    private function petSummary(object $pet): array
    {
        return [
            'id' => (int) $pet->id,
            'name' => (string) $pet->name,
            'petSize' => (string) $pet->pet_size,
        ];
    }

    public function normalizePhotoUrl(string $value): string
    {
        $value = trim($value);
        if ($value === '') {
            return '';
        }

        if (preg_match('#^(https?://|data:|/)#i', $value) === 1) {
            return $value;
        }

        return '/storage/'.ltrim($value, '/');
    }
}
