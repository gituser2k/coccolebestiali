<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

class Profile extends Model
{
    /** Common breeds and everyday names used only to find the corresponding pet group. */
    private const PET_GROUP_SEARCH_TERMS = [
        101 => 'pastore tedesco border collie australian shepherd pastore australiano pastore belga collie corgi pastore maremmano bovaro delle fiandre',
        102 => 'dobermann pinscher schnauzer boxer alano rottweiler cane corso mastino napoletano bullmastiff san bernardo terranova bovaro bernese molosso molossi',
        103 => 'jack russell yorkshire bull terrier staffordshire west highland white terrier westie airedale fox terrier',
        104 => 'bassotto dachshund teckel',
        105 => 'husky akita shiba spitz chow chow samoiedo volpino malamute basenji',
        106 => 'beagle basset hound bloodhound dalmata rhodesian ridgeback segugio italiano',
        107 => 'setter pointer bracco italiano weimaraner spinone epagneul breton',
        108 => 'labrador golden retriever cocker spaniel springer spaniel lagotto romagnolo barbet flat coated retriever',
        109 => 'chihuahua barboncino poodle maltese bolognese shih tzu carlino pug bulldog francese cavalier king bichon',
        110 => 'greyhound whippet levriero afghano saluki borzoi piccolo levriero italiano',
        111 => 'meticcio meticci incrocio non riconosciuto',
        201 => 'persiano exotic shorthair esotico',
        202 => 'maine coon norvegese delle foreste sacro di birmania ragdoll siberiano',
        203 => 'certosino british shorthair europeo bengala abissino somalo russian blue blu di russia sphynx',
        204 => 'siamese orientale balinese peterbald',
        205 => 'gatto domestico meticcio soriano non classificato',
        301 => 'nano olandese testa di leone ermellino',
        302 => 'coniglio medio rex fulvo di borgogna',
        303 => 'gigante fiammingo gigante pezzato',
        304 => 'ariete angora pelo lungo',
        401 => 'furetto ferret',
        411 => 'criceto gerbillo topo ratto domestico',
        412 => 'cavia porcellino india',
        413 => 'cincilla degu',
        414 => 'riccio africano insettivoro',
        415 => 'petauro scoiattolo piccolo mammifero',
        501 => 'pappagallo parrocchetto cocorita calopsitta inseparabile ara cacatua cenerino',
        502 => 'canarino diamante mandarino cardellino fringillide',
        503 => 'colombo tortora uccello ornamentale',
        504 => 'gallina gallo anatra oca tacchino quaglia',
        601 => 'geco iguana camaleonte pogona lucertola sauro',
        602 => 'tartaruga testuggine chelone',
        603 => 'serpente pitone boa colubro rettile',
        701 => 'rana rospo tritone salamandra axolotl anfibio',
        801 => 'guppy betta discus neon scalare pesce tropicale acqua dolce',
        802 => 'pesce rosso carpa koi acqua fredda',
        803 => 'pesce marino barriera corallo acquario marino',
        901 => 'insetto aracnide tarantola scorpione lumaca gambero invertebrato',
        1001 => 'cavallo pony asino mulo equide',
        1101 => 'altro animale compagnia',
    ];

    public function getPersonalProfile(int $userId, string $context): array
    {
        $row = (new ProfileData)->read($userId, $context);

        if ($row === []) {
            return [];
        }

        $photo = (string) ($row['photo'] ?? '');
        $avatar = (string) ($row['avatar'] ?? '');
        $photoPath = $photo !== '' ? $photo : $avatar;

        return [
            'alias' => (string) ($row['alias'] ?? ''),
            'email' => (string) ($row['email'] ?? ''),
            'name' => (string) ($row['name'] ?? ''),
            'photo' => $photo,
            'photoUrl' => $this->normalizePhotoUrl($photoPath),
            'age' => (int) ($row['age'] ?? 0),
            'city' => (string) ($row['city'] ?? ''),
            'phone' => (string) ($row['phone'] ?? ''),
            'address' => (string) ($row['address'] ?? ''),
            'addressnumber' => (string) ($row['addressnumber'] ?? ''),
            'locationLat' => (float) ($row['locationLat'] ?? 0),
            'locationLng' => (float) ($row['locationLng'] ?? 0),
            'serviceRadiusKm' => (int) ($row['serviceRadiusKm'] ?? 5),
            'profileSources' => $row['profileSources'] ?? [],
        ];
    }

    public function getOperatorOptions(): array
    {
        $this->ensureOperatorIdentitySchema();
        $this->ensureOperatorMetadataSeeded();

        $services = DB::table('service as s')
            ->leftJoin('servicefeaturedata as sfd', 'sfd.service_id', '=', 's.id')
            ->leftJoin('servicefeature as sf', 'sf.id', '=', 'sfd.feature_id')
            ->select([
                's.id',
                's.name',
                's.description',
                's.requires_home_photo',
                DB::raw("GROUP_CONCAT(DISTINCT sf.id ORDER BY sf.name SEPARATOR ',') as feature_ids"),
                DB::raw("GROUP_CONCAT(DISTINCT sf.name ORDER BY sf.name SEPARATOR '||') as feature_names"),
            ])
            ->groupBy('s.id', 's.name', 's.description', 's.requires_home_photo')
            ->orderBy('s.name')
            ->get()
            ->map(function ($row) {
                $featureIds = trim((string) ($row->feature_ids ?? '')) === ''
                    ? []
                    : array_values(array_filter(array_map('intval', explode(',', (string) $row->feature_ids))));

                $featureNames = trim((string) ($row->feature_names ?? '')) === ''
                    ? []
                    : array_values(array_filter(explode('||', (string) $row->feature_names)));

                $features = [];
                foreach ($featureNames as $index => $featureName) {
                    $featureId = (int) ($featureIds[$index] ?? 0);
                    if ($featureId <= 0) {
                        continue;
                    }

                    $features[] = [
                        'id' => $featureId,
                        'name' => (string) $featureName,
                    ];
                }

                return [
                    'id' => (int) $row->id,
                    'name' => (string) $row->name,
                    'description' => (string) $row->description,
                    'requiresHomePhoto' => (bool) $row->requires_home_photo,
                    'features' => $features,
                ];
            })
            ->all();

        return [
            'titles' => DB::table('operatortitle')
                ->select(['id', 'name'])
                ->orderBy('sortorder')
                ->orderBy('name')
                ->get()
                ->map(fn ($row) => [
                    'id' => (int) $row->id,
                    'name' => (string) $row->name,
                ])
                ->all(),
            'petGroups' => DB::table('petbreed')
                ->select(['id', 'category', 'name'])
                ->orderBy('sortorder')
                ->orderBy('name')
                ->get()
                ->map(fn ($row) => [
                    'id' => (int) $row->id,
                    'category' => (string) $row->category,
                    'name' => (string) $row->name,
                    'searchTerms' => self::PET_GROUP_SEARCH_TERMS[(int) $row->id] ?? '',
                ])
                ->all(),
            'petTypes' => DB::table('pettype')
                ->select(['id', 'name'])
                ->orderBy('sortorder')
                ->orderBy('name')
                ->get()
                ->map(fn ($row) => [
                    'id' => (int) $row->id,
                    'name' => (string) $row->name,
                ])
                ->all(),
            'houseFeatures' => DB::table('housefeature')
                ->select(['id', 'name'])
                ->orderBy('sortorder')
                ->orderBy('name')
                ->get()
                ->map(fn ($row) => [
                    'id' => (int) $row->id,
                    'name' => (string) $row->name,
                ])
                ->all(),
            'services' => $services,
        ];
    }

    public function getPetOwnerPetOptions(): array
    {
        $this->ensureOperatorIdentitySchema();
        $this->ensureOperatorMetadataSeeded();

        return [
            'petGroups' => DB::table('petbreed')
                ->select(['id', 'category', 'name'])
                ->orderBy('sortorder')
                ->orderBy('name')
                ->get()
                ->map(fn ($row) => [
                    'id' => (int) $row->id,
                    'category' => (string) $row->category,
                    'name' => (string) $row->name,
                ])
                ->all(),
            'petTypes' => DB::table('pettype')
                ->select(['id', 'name'])
                ->orderBy('sortorder')
                ->orderBy('name')
                ->get()
                ->map(fn ($row) => [
                    'id' => (int) $row->id,
                    'name' => (string) $row->name,
                ])
                ->all(),
        ];
    }

    public function getPetOwnerPets(int $userId): array
    {
        $this->ensurePetOwnerPetsSchema();

        $pets = DB::table('ownerpet')
            ->select([
                'id', 'name', 'sex', 'birth_date', 'microchip_code',
                'general_notes', 'pet_size', 'sortorder',
            ])
            ->where('user_id', $userId)
            ->orderBy('sortorder')
            ->orderBy('id')
            ->get();

        if ($pets->isEmpty()) {
            return [];
        }

        $petIds = $pets->pluck('id')->map(fn ($id) => (int) $id)->all();
        $groupIds = DB::table('ownerpetbreeddata')
            ->whereIn('pet_id', $petIds)
            ->orderBy('petbreed_id')
            ->get(['pet_id', 'petbreed_id'])
            ->groupBy('pet_id');
        $typeIds = DB::table('ownerpettypedata')
            ->whereIn('pet_id', $petIds)
            ->orderBy('pettype_id')
            ->get(['pet_id', 'pettype_id'])
            ->groupBy('pet_id');
        $gallery = DB::table('ownerpetgallery')
            ->whereIn('pet_id', $petIds)
            ->orderBy('sortorder')
            ->orderBy('id')
            ->get(['id', 'pet_id', 'photo', 'is_profile', 'sortorder'])
            ->groupBy('pet_id');
        $documents = DB::table('ownerpetdocument')
            ->whereIn('pet_id', $petIds)
            ->orderBy('sortorder')
            ->orderBy('id')
            ->get([
                'id', 'pet_id', 'document_type', 'title', 'issued_at', 'expires_at',
                'notes', 'file_path', 'original_name', 'mime_type', 'file_size', 'sortorder',
            ])
            ->groupBy('pet_id');

        return $pets->map(function ($pet) use ($groupIds, $typeIds, $gallery, $documents) {
            $petId = (int) $pet->id;

            return [
                'id' => $petId,
                'name' => (string) $pet->name,
                'sex' => (string) $pet->sex,
                'birthDate' => $pet->birth_date ? (string) $pet->birth_date : '',
                'microchipCode' => (string) $pet->microchip_code,
                'generalNotes' => (string) $pet->general_notes,
                'petSize' => (string) $pet->pet_size,
                'petGroupIds' => collect($groupIds->get($petId, []))
                    ->pluck('petbreed_id')->map(fn ($id) => (int) $id)->values()->all(),
                'petTypeIds' => collect($typeIds->get($petId, []))
                    ->pluck('pettype_id')->map(fn ($id) => (int) $id)->values()->all(),
                'gallery' => collect($gallery->get($petId, []))->map(fn ($item) => [
                    'id' => (int) $item->id,
                    'photo' => (string) $item->photo,
                    'photoUrl' => $this->normalizePhotoUrl((string) $item->photo),
                    'isProfile' => (bool) $item->is_profile,
                    'sortorder' => (int) $item->sortorder,
                ])->values()->all(),
                'documents' => collect($documents->get($petId, []))->map(fn ($item) => [
                    'id' => (int) $item->id,
                    'documentType' => (string) $item->document_type,
                    'title' => (string) $item->title,
                    'issuedAt' => $item->issued_at ? (string) $item->issued_at : '',
                    'expiresAt' => $item->expires_at ? (string) $item->expires_at : '',
                    'notes' => (string) $item->notes,
                    'filePath' => (string) $item->file_path,
                    'originalName' => (string) $item->original_name,
                    'mimeType' => (string) $item->mime_type,
                    'fileSize' => (int) $item->file_size,
                    'downloadUrl' => '/api/profile/petowner/pets/documents/'.(int) $item->id,
                    'sortorder' => (int) $item->sortorder,
                ])->values()->all(),
            ];
        })->values()->all();
    }

    public function getPetOwnerGalleryPaths(int $userId): array
    {
        $this->ensurePetOwnerPetsSchema();

        return DB::table('ownerpetgallery as gallery')
            ->join('ownerpet as pet', 'pet.id', '=', 'gallery.pet_id')
            ->where('pet.user_id', $userId)
            ->pluck('gallery.photo')
            ->map(fn ($photo) => (string) $photo)
            ->filter()
            ->values()
            ->all();
    }

    public function getPetOwnerDocumentPaths(int $userId): array
    {
        $this->ensurePetOwnerPetsSchema();

        return DB::table('ownerpetdocument as document')
            ->join('ownerpet as pet', 'pet.id', '=', 'document.pet_id')
            ->where('pet.user_id', $userId)
            ->pluck('document.file_path')
            ->map(fn ($path) => (string) $path)
            ->filter()
            ->values()
            ->all();
    }

    public function syncPetOwnerProfilePhoto(int $userId, string $photo): void
    {
        $this->ensurePersonalLocationSchema();
        (new ProfileData)->syncCommonPhoto($userId, $photo, time());
    }

    public function setPetOwnerProfilePhoto(int $userId, ?int $galleryId): array
    {
        $this->ensurePetOwnerPetsSchema();

        return DB::transaction(function () use ($userId, $galleryId) {
            $petIds = DB::table('ownerpet')->where('user_id', $userId)->pluck('id')->all();
            $selected = null;

            if ($galleryId !== null) {
                $selected = DB::table('ownerpetgallery as gallery')
                    ->join('ownerpet as pet', 'pet.id', '=', 'gallery.pet_id')
                    ->where('pet.user_id', $userId)
                    ->where('gallery.id', $galleryId)
                    ->first(['gallery.id', 'gallery.photo']);

                if (! $selected) {
                    throw new \RuntimeException('Foto della gallery non disponibile.');
                }
            }

            if ($petIds !== []) {
                DB::table('ownerpetgallery')->whereIn('pet_id', $petIds)->update(['is_profile' => 0]);
            }

            if ($selected) {
                DB::table('ownerpetgallery')->where('id', $selected->id)->update(['is_profile' => 1]);
                $this->syncPetOwnerProfilePhoto($userId, (string) $selected->photo);
            } else {
                $currentPhoto = (string) ($this->getPersonalProfile($userId, ProfileData::OWNER)['photo'] ?? '');
                if (str_starts_with($currentPhoto, 'owner-pet-gallery/')) {
                    $this->syncPetOwnerProfilePhoto($userId, '');
                }
            }

            return [
                'galleryId' => $selected ? (int) $selected->id : null,
                'profile' => $this->getPersonalProfile($userId, ProfileData::OWNER),
            ];
        });
    }

    public function getPetOwnerDocument(int $userId, int $documentId): ?object
    {
        $this->ensurePetOwnerPetsSchema();

        return DB::table('ownerpetdocument as document')
            ->join('ownerpet as pet', 'pet.id', '=', 'document.pet_id')
            ->where('pet.user_id', $userId)
            ->where('document.id', $documentId)
            ->first([
                'document.file_path',
                'document.original_name',
                'document.mime_type',
            ]);
    }

    public function savePetOwnerPets(int $userId, array $pets): array
    {
        $this->ensurePetOwnerPetsSchema();
        $now = time();

        DB::transaction(function () use ($userId, $pets, $now) {
            $existingPetIds = DB::table('ownerpet')->where('user_id', $userId)->pluck('id')->all();
            if ($existingPetIds !== []) {
                DB::table('ownerpetbreeddata')->whereIn('pet_id', $existingPetIds)->delete();
                DB::table('ownerpettypedata')->whereIn('pet_id', $existingPetIds)->delete();
                DB::table('ownerpetgallery')->whereIn('pet_id', $existingPetIds)->delete();
                DB::table('ownerpetdocument')->whereIn('pet_id', $existingPetIds)->delete();
            }
            DB::table('ownerpet')->where('user_id', $userId)->delete();

            foreach ($pets as $petIndex => $pet) {
                if (! is_array($pet)) {
                    continue;
                }

                $petId = (int) DB::table('ownerpet')->insertGetId([
                    'user_id' => $userId,
                    'name' => trim((string) ($pet['name'] ?? '')),
                    'sex' => (string) ($pet['sex'] ?? ''),
                    'birth_date' => ($pet['birthDate'] ?? '') !== '' ? $pet['birthDate'] : null,
                    'microchip_code' => strtoupper(trim((string) ($pet['microchipCode'] ?? ''))),
                    'general_notes' => trim((string) ($pet['generalNotes'] ?? '')),
                    'pet_size' => (string) ($pet['petSize'] ?? ''),
                    'sortorder' => $petIndex + 1,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                foreach (array_values(array_unique(array_map('intval', $pet['petGroupIds'] ?? []))) as $groupId) {
                    if ($groupId > 0) {
                        DB::table('ownerpetbreeddata')->insert([
                            'pet_id' => $petId,
                            'petbreed_id' => $groupId,
                            'created_at' => $now,
                            'updated_at' => $now,
                        ]);
                    }
                }

                foreach (array_values(array_unique(array_map('intval', $pet['petTypeIds'] ?? []))) as $typeId) {
                    if ($typeId > 0) {
                        DB::table('ownerpettypedata')->insert([
                            'pet_id' => $petId,
                            'pettype_id' => $typeId,
                            'created_at' => $now,
                            'updated_at' => $now,
                        ]);
                    }
                }

                foreach (($pet['gallery'] ?? []) as $galleryIndex => $item) {
                    if (! is_array($item) || trim((string) ($item['photo'] ?? '')) === '') {
                        continue;
                    }

                    DB::table('ownerpetgallery')->insert([
                        'pet_id' => $petId,
                        'photo' => trim((string) $item['photo']),
                        'is_profile' => (int) ($item['isProfile'] ?? false),
                        'sortorder' => $galleryIndex + 1,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }

                foreach (($pet['documents'] ?? []) as $documentIndex => $item) {
                    if (! is_array($item) || trim((string) ($item['filePath'] ?? '')) === '') {
                        continue;
                    }

                    DB::table('ownerpetdocument')->insert([
                        'pet_id' => $petId,
                        'document_type' => trim((string) ($item['documentType'] ?? 'other')),
                        'title' => trim((string) ($item['title'] ?? '')),
                        'issued_at' => ($item['issuedAt'] ?? '') !== '' ? $item['issuedAt'] : null,
                        'expires_at' => ($item['expiresAt'] ?? '') !== '' ? $item['expiresAt'] : null,
                        'notes' => trim((string) ($item['notes'] ?? '')),
                        'file_path' => trim((string) $item['filePath']),
                        'original_name' => trim((string) ($item['originalName'] ?? 'documento')),
                        'mime_type' => trim((string) ($item['mimeType'] ?? 'application/octet-stream')),
                        'file_size' => max(0, (int) ($item['fileSize'] ?? 0)),
                        'sortorder' => $documentIndex + 1,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }
            }
        });

        return $this->getPetOwnerPets($userId);
    }

    public function getOperatorProfile(int $userId): array
    {
        $this->ensureOperatorIdentitySchema();
        $this->ensureOperatorMetadataSeeded();

        $row = DB::table('operatordata')
            ->select([
                'operator_type',
                'fiscal_code',
                'business_name',
                'vat_number',
                'bio',
                'experience_years',
                'pet_size',
            ])
            ->where('user_id', $userId)
            ->first();

        $operatorType = (string) ($row->operator_type ?? 'person');
        if (! in_array($operatorType, ['person', 'association'], true)) {
            $operatorType = 'person';
        }

        $associates = DB::table('operatorassociatedata')
            ->select(['id', 'first_name', 'last_name', 'fiscal_code'])
            ->where('user_id', $userId)
            ->orderBy('id')
            ->get()
            ->map(fn ($row) => [
                'id' => (int) $row->id,
                'firstName' => (string) $row->first_name,
                'lastName' => (string) $row->last_name,
                'fiscalCode' => (string) $row->fiscal_code,
            ])
            ->all();

        $linkedAssociations = [];
        $fiscalCode = strtoupper(trim((string) ($row->fiscal_code ?? '')));
        if ($operatorType === 'person' && $fiscalCode !== '') {
            $linkedAssociations = DB::table('operatorassociatedata')
                ->join('operatordata', 'operatordata.user_id', '=', 'operatorassociatedata.user_id')
                ->select(['operatordata.user_id', 'operatordata.business_name', 'operatordata.vat_number'])
                ->where('operatorassociatedata.fiscal_code', $fiscalCode)
                ->where('operatordata.operator_type', 'association')
                ->orderBy('operatordata.business_name')
                ->get()
                ->map(fn ($row) => [
                    'userId' => (int) $row->user_id,
                    'businessName' => (string) $row->business_name,
                    'vatNumber' => (string) $row->vat_number,
                ])
                ->all();
        }

        $titleIds = DB::table('operatortitledata')
            ->where('user_id', $userId)
            ->orderBy('title_id')
            ->pluck('title_id')
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();

        $petTypeIds = DB::table('pettypedata')
            ->where('user_id', $userId)
            ->orderBy('pettype_id')
            ->pluck('pettype_id')
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();

        $acceptedPetGroupIds = DB::table('petbreeddata')
            ->where('user_id', $userId)
            ->where('acceptance', 'accepted')
            ->orderBy('petbreed_id')
            ->pluck('petbreed_id')
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();

        $rejectedPetGroupIds = DB::table('petbreeddata')
            ->where('user_id', $userId)
            ->where('acceptance', 'rejected')
            ->orderBy('petbreed_id')
            ->pluck('petbreed_id')
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();

        $houseFeatureIds = DB::table('housefeaturedata')
            ->where('user_id', $userId)
            ->orderBy('housefeature_id')
            ->pluck('housefeature_id')
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();

        $gallery = DB::table('operatorgallery')
            ->select(['id', 'photo', 'caption', 'sortorder'])
            ->where('user_id', $userId)
            ->orderBy('sortorder')
            ->orderBy('id')
            ->get()
            ->map(fn ($row) => [
                'id' => (int) $row->id,
                'photo' => (string) $row->photo,
                'photoUrl' => $this->normalizePhotoUrl((string) $row->photo),
                'caption' => (string) $row->caption,
                'sortorder' => (int) $row->sortorder,
            ])
            ->all();

        $defaultFeaturesMap = DB::table('servicefeaturedata')
            ->select(['service_id', 'feature_id'])
            ->get()
            ->groupBy('service_id')
            ->map(fn ($rows) => $rows
                ->pluck('feature_id')
                ->map(fn ($id) => (int) $id)
                ->values()
                ->all()
            );

        $selectedFeaturesMap = DB::table('operatorservicefeaturedata')
            ->select(['service_id', 'feature_id'])
            ->where('user_id', $userId)
            ->get()
            ->groupBy('service_id')
            ->map(fn ($rows) => $rows
                ->pluck('feature_id')
                ->map(fn ($id) => (int) $id)
                ->values()
                ->all()
            );

        $services = DB::table('operatorservicedata')
            ->select(['service_id', 'hour_price', 'home_photo_enabled'])
            ->where('user_id', $userId)
            ->orderBy('service_id')
            ->get()
            ->map(fn ($row) => [
                'serviceId' => (int) $row->service_id,
                'hourlyRate' => round((float) ($row->hour_price ?? 0), 2),
                'homePhotoEnabled' => (bool) $row->home_photo_enabled,
                'featureIds' => $selectedFeaturesMap->get((int) $row->service_id, $defaultFeaturesMap->get((int) $row->service_id, [])),
            ])
            ->all();

        $public = DB::table('operator_public_profile')->where('user_id', $userId)->first();

        return [
            'operatorType' => $operatorType,
            'fiscalCode' => (string) ($row->fiscal_code ?? ''),
            'businessName' => (string) ($row->business_name ?? ''),
            'vatNumber' => (string) ($row->vat_number ?? ''),
            'associates' => $associates,
            'linkedAssociations' => $linkedAssociations,
            'bio' => (string) ($row->bio ?? ''),
            'experienceYears' => (int) ($row->experience_years ?? 0),
            'publicProfile' => [
                'headline' => (string) ($public->headline ?? ''),
                'typicalDay' => (string) ($public->typical_day ?? ''),
                'safetyAndHome' => (string) ($public->safety_and_home ?? ''),
                'ownerInstructions' => (string) ($public->owner_instructions ?? ''),
                'publishExactLocation' => (bool) ($public->publish_exact_location ?? false),
            ],
            'titleIds' => $titleIds,
            'acceptedPetGroupIds' => $acceptedPetGroupIds,
            'rejectedPetGroupIds' => $rejectedPetGroupIds,
            'petSize' => (string) ($row->pet_size ?? ''),
            'petTypeIds' => $petTypeIds,
            'houseFeatureIds' => $houseFeatureIds,
            'services' => $services,
            'gallery' => $gallery,
        ];
    }

    public function savePersonalProfile(int $userId, array $payload, string $context): array
    {
        $now = time();
        $email = strtolower(trim((string) ($payload['email'] ?? '')));

        if ($email !== '') {
            $existingEmailUser = DB::table('users')
                ->select(['id'])
                ->where('email', $email)
                ->where('id', '<>', $userId)
                ->first();

            if ($existingEmailUser) {
                throw new \RuntimeException('Email gia associata a un altro account.');
            }
        }

        DB::transaction(function () use ($userId, $payload, $now, $email, $context) {
            DB::table('users')
                ->where('id', $userId)
                ->update([
                    'name' => (string) ($payload['alias'] ?? ''),
                    'email' => $email,
                    'updated_at' => $now,
                ]);

            (new ProfileData)->write($userId, $context, $payload, $now);

            if ($context === ProfileData::ASSISTANT
                && array_key_exists('publishExactLocation', $payload)
                && Schema::hasTable('operator_public_profile')) {
                DB::table('operator_public_profile')->updateOrInsert(
                    ['user_id' => $userId],
                    ['publish_exact_location' => (bool) $payload['publishExactLocation']]
                );
            }
        });

        return $this->getPersonalProfile($userId, $context);
    }

    public function updateUserCredentials(int $userId, string $email, ?string $password): array
    {
        $normalizedEmail = strtolower(trim($email));

        $existingEmailUser = DB::table('users')
            ->select(['id'])
            ->where('email', $normalizedEmail)
            ->where('id', '<>', $userId)
            ->first();

        if ($existingEmailUser) {
            throw new \RuntimeException('Email gia associata a un altro account.');
        }

        $updates = [
            'email' => $normalizedEmail,
            'updated_at' => time(),
        ];

        if ($password !== null && $password !== '') {
            $updates['password_hash'] = Hash::make($password);
        }

        DB::table('users')
            ->where('id', $userId)
            ->update($updates);

        return [
            'email' => $normalizedEmail,
        ];
    }

    private function ensureOperatorIdentitySchema(): void
    {
        if (Schema::hasTable('operatordata')) {
            Schema::table('operatordata', function ($table) {
                if (! Schema::hasColumn('operatordata', 'operator_type')) {
                    $table->string('operator_type', 32)->default('person')->after('user_id');
                }
                if (! Schema::hasColumn('operatordata', 'fiscal_code')) {
                    $table->string('fiscal_code', 32)->default('')->after('operator_type');
                }
                if (! Schema::hasColumn('operatordata', 'business_name')) {
                    $table->string('business_name', 255)->default('')->after('fiscal_code');
                }
                if (! Schema::hasColumn('operatordata', 'vat_number')) {
                    $table->string('vat_number', 32)->default('')->after('business_name');
                }
                if (! Schema::hasColumn('operatordata', 'pet_size')) {
                    $table->string('pet_size', 32)->default('')->after('experience_years');
                }
            });
        }

        if (! Schema::hasTable('operatorassociatedata')) {
            Schema::create('operatorassociatedata', function ($table) {
                $table->increments('id');
                $table->unsignedInteger('user_id')->default(0);
                $table->string('first_name', 255)->default('');
                $table->string('last_name', 255)->default('');
                $table->string('fiscal_code', 32)->default('');
                $table->integer('created_at')->default(0);
                $table->integer('updated_at')->default(0);
                $table->index('user_id', 'idx_operatorassociatedata_user_id');
                $table->index('fiscal_code', 'idx_operatorassociatedata_fiscal_code');
            });
        }

        if (! Schema::hasTable('petbreed')) {
            Schema::create('petbreed', function ($table) {
                $table->increments('id');
                $table->string('category', 80)->default('');
                $table->string('name', 160)->default('');
                $table->integer('sortorder')->default(0);
                $table->integer('created_at')->default(0);
                $table->integer('updated_at')->default(0);
            });
        }
        if (! Schema::hasColumn('petbreed', 'category')) {
            Schema::table('petbreed', fn ($table) => $table->string('category', 80)->default('')->after('id'));
        }

        if (! Schema::hasTable('petbreeddata')) {
            Schema::create('petbreeddata', function ($table) {
                $table->increments('id');
                $table->unsignedInteger('user_id')->default(0);
                $table->unsignedInteger('petbreed_id')->default(0);
                $table->string('acceptance', 16)->default('accepted');
                $table->integer('created_at')->default(0);
                $table->integer('updated_at')->default(0);
                $table->unique(['user_id', 'petbreed_id'], 'uk_petbreeddata_user_breed');
                $table->index('user_id', 'idx_petbreeddata_user_id');
                $table->index('petbreed_id', 'idx_petbreeddata_breed_id');
            });
        }
        if (! Schema::hasColumn('petbreeddata', 'acceptance')) {
            Schema::table('petbreeddata', fn ($table) => $table->string('acceptance', 16)->default('accepted')->after('petbreed_id'));
        }
    }

    private function ensurePetOwnerPetsSchema(): void
    {
        if (! Schema::hasTable('ownerpet')) {
            Schema::create('ownerpet', function ($table) {
                $table->increments('id');
                $table->unsignedInteger('user_id')->default(0);
                $table->string('name', 255)->default('');
                $table->string('sex', 16)->default('');
                $table->date('birth_date')->nullable();
                $table->string('microchip_code', 64)->default('');
                $table->string('general_notes', 4096)->default('');
                $table->string('pet_size', 32)->default('');
                $table->integer('sortorder')->default(0);
                $table->integer('created_at')->default(0);
                $table->integer('updated_at')->default(0);
                $table->index('user_id', 'idx_ownerpet_user_id');
            });
        }

        if (! Schema::hasColumn('ownerpet', 'sex')) {
            Schema::table('ownerpet', fn ($table) => $table->string('sex', 16)->default('')->after('name'));
        }
        if (! Schema::hasColumn('ownerpet', 'birth_date')) {
            Schema::table('ownerpet', fn ($table) => $table->date('birth_date')->nullable()->after('sex'));
        }
        if (! Schema::hasColumn('ownerpet', 'microchip_code')) {
            Schema::table('ownerpet', fn ($table) => $table->string('microchip_code', 64)->default('')->after('birth_date'));
        }
        if (! Schema::hasColumn('ownerpet', 'general_notes')) {
            Schema::table('ownerpet', fn ($table) => $table->string('general_notes', 4096)->default('')->after('microchip_code'));
        }

        if (! Schema::hasTable('ownerpetbreeddata')) {
            Schema::create('ownerpetbreeddata', function ($table) {
                $table->increments('id');
                $table->unsignedInteger('pet_id')->default(0);
                $table->unsignedInteger('petbreed_id')->default(0);
                $table->integer('created_at')->default(0);
                $table->integer('updated_at')->default(0);
                $table->unique(['pet_id', 'petbreed_id'], 'uk_ownerpetbreeddata_pet_breed');
                $table->index('pet_id', 'idx_ownerpetbreeddata_pet_id');
                $table->index('petbreed_id', 'idx_ownerpetbreeddata_breed_id');
            });
        }

        if (! Schema::hasTable('ownerpettypedata')) {
            Schema::create('ownerpettypedata', function ($table) {
                $table->increments('id');
                $table->unsignedInteger('pet_id')->default(0);
                $table->unsignedInteger('pettype_id')->default(0);
                $table->integer('created_at')->default(0);
                $table->integer('updated_at')->default(0);
                $table->unique(['pet_id', 'pettype_id'], 'uk_ownerpettypedata_pet_type');
                $table->index('pet_id', 'idx_ownerpettypedata_pet_id');
                $table->index('pettype_id', 'idx_ownerpettypedata_type_id');
            });
        }

        if (! Schema::hasTable('ownerpetgallery')) {
            Schema::create('ownerpetgallery', function ($table) {
                $table->increments('id');
                $table->unsignedInteger('pet_id')->default(0);
                $table->string('photo', 1024)->default('');
                $table->boolean('is_profile')->default(false);
                $table->integer('sortorder')->default(0);
                $table->integer('created_at')->default(0);
                $table->integer('updated_at')->default(0);
                $table->index('pet_id', 'idx_ownerpetgallery_pet_id');
            });
        }
        if (! Schema::hasColumn('ownerpetgallery', 'is_profile')) {
            Schema::table('ownerpetgallery', fn ($table) => $table->boolean('is_profile')->default(false)->after('photo'));
            DB::statement('UPDATE ownerpetgallery AS gallery INNER JOIN (SELECT pet_id, MIN(id) AS profile_photo_id FROM ownerpetgallery GROUP BY pet_id) AS first_photo ON first_photo.profile_photo_id = gallery.id SET gallery.is_profile = 1');
        }
        if (Schema::hasColumn('ownerpetgallery', 'caption')) {
            Schema::table('ownerpetgallery', fn ($table) => $table->dropColumn('caption'));
        }

        if (! Schema::hasTable('ownerpetdocument')) {
            Schema::create('ownerpetdocument', function ($table) {
                $table->increments('id');
                $table->unsignedInteger('pet_id')->default(0);
                $table->string('document_type', 64)->default('');
                $table->string('title', 255)->default('');
                $table->date('issued_at')->nullable();
                $table->date('expires_at')->nullable();
                $table->string('notes', 2048)->default('');
                $table->string('file_path', 1024)->default('');
                $table->string('original_name', 255)->default('');
                $table->string('mime_type', 120)->default('');
                $table->unsignedBigInteger('file_size')->default(0);
                $table->integer('sortorder')->default(0);
                $table->integer('created_at')->default(0);
                $table->integer('updated_at')->default(0);
                $table->index('pet_id', 'idx_ownerpetdocument_pet_id');
            });
        }
    }

    public function saveOperatorProfile(int $userId, array $payload): array
    {
        $this->ensureOperatorIdentitySchema();
        $this->ensureOperatorMetadataSeeded();

        $now = time();

        DB::transaction(function () use ($userId, $payload, $now) {
            $existing = DB::table('operatordata')
                ->select(['id'])
                ->where('user_id', $userId)
                ->first();

            $operatorData = [
                'user_id' => $userId,
                'operator_type' => (string) ($payload['operatorType'] ?? 'person') === 'association' ? 'association' : 'person',
                'fiscal_code' => strtoupper(trim((string) ($payload['fiscalCode'] ?? ''))),
                'business_name' => (string) ($payload['businessName'] ?? ''),
                'vat_number' => strtoupper(trim((string) ($payload['vatNumber'] ?? ''))),
                'bio' => (string) ($payload['bio'] ?? ''),
                'experience_years' => (int) ($payload['experienceYears'] ?? 0),
                'pet_size' => (string) ($payload['petSize'] ?? ''),
                'updated_at' => $now,
            ];

            if (isset($payload['publicProfile'])) {
                $public = $payload['publicProfile'];
                DB::table('operator_public_profile')->upsert([[
                    'user_id' => $userId,
                    'headline' => (string) ($public['headline'] ?? ''),
                    'typical_day' => (string) ($public['typicalDay'] ?? ''),
                    'safety_and_home' => (string) ($public['safetyAndHome'] ?? ''),
                    'owner_instructions' => (string) ($public['ownerInstructions'] ?? ''),
                    'publish_exact_location' => (bool) ($public['publishExactLocation'] ?? false),
                ]], ['user_id'], ['headline', 'typical_day', 'safety_and_home', 'owner_instructions', 'publish_exact_location']);
            }

            if ($operatorData['operator_type'] === 'person') {
                $operatorData['business_name'] = '';
                $operatorData['vat_number'] = '';
            }

            if ($existing) {
                DB::table('operatordata')
                    ->where('user_id', $userId)
                    ->update($operatorData);
            } else {
                $operatorData['created_at'] = $now;
                DB::table('operatordata')->insert($operatorData);
            }

            DB::table('operatorassociatedata')->where('user_id', $userId)->delete();
            if ($operatorData['operator_type'] === 'association') {
                $associates = is_array($payload['associates'] ?? null) ? $payload['associates'] : [];
                foreach ($associates as $associate) {
                    if (! is_array($associate)) {
                        continue;
                    }

                    $firstName = trim((string) ($associate['firstName'] ?? ''));
                    $lastName = trim((string) ($associate['lastName'] ?? ''));
                    $fiscalCode = strtoupper(trim((string) ($associate['fiscalCode'] ?? '')));

                    if ($firstName === '' && $lastName === '' && $fiscalCode === '') {
                        continue;
                    }

                    DB::table('operatorassociatedata')->insert([
                        'user_id' => $userId,
                        'first_name' => $firstName,
                        'last_name' => $lastName,
                        'fiscal_code' => $fiscalCode,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }
            }

            DB::table('operatortitledata')->where('user_id', $userId)->delete();
            $titleIds = array_values(array_unique(array_map('intval', $payload['titleIds'] ?? [])));
            foreach ($titleIds as $titleId) {
                if ($titleId <= 0) {
                    continue;
                }

                DB::table('operatortitledata')->insert([
                    'user_id' => $userId,
                    'title_id' => $titleId,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            DB::table('petbreeddata')->where('user_id', $userId)->delete();
            foreach (['accepted' => 'acceptedPetGroupIds', 'rejected' => 'rejectedPetGroupIds'] as $acceptance => $field) {
                $petGroupIds = array_values(array_unique(array_map('intval', $payload[$field] ?? [])));
                foreach ($petGroupIds as $petGroupId) {
                    if ($petGroupId <= 0) {
                        continue;
                    }

                    DB::table('petbreeddata')->insert([
                        'user_id' => $userId,
                        'petbreed_id' => $petGroupId,
                        'acceptance' => $acceptance,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }
            }

            DB::table('pettypedata')->where('user_id', $userId)->delete();
            $petTypeIds = array_values(array_unique(array_map('intval', $payload['petTypeIds'] ?? [])));
            foreach ($petTypeIds as $petTypeId) {
                if ($petTypeId <= 0) {
                    continue;
                }

                DB::table('pettypedata')->insert([
                    'user_id' => $userId,
                    'pettype_id' => $petTypeId,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            DB::table('housefeaturedata')->where('user_id', $userId)->delete();
            $houseFeatureIds = array_values(array_unique(array_map('intval', $payload['houseFeatureIds'] ?? [])));
            foreach ($houseFeatureIds as $houseFeatureId) {
                if ($houseFeatureId <= 0) {
                    continue;
                }

                DB::table('housefeaturedata')->insert([
                    'user_id' => $userId,
                    'housefeature_id' => $houseFeatureId,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            DB::table('operatorservicedata')->where('user_id', $userId)->delete();
            DB::table('operatorservicefeaturedata')->where('user_id', $userId)->delete();
            $services = is_array($payload['services'] ?? null) ? $payload['services'] : [];
            foreach ($services as $service) {
                if (! is_array($service)) {
                    continue;
                }

                $serviceId = (int) ($service['serviceId'] ?? 0);
                if ($serviceId <= 0) {
                    continue;
                }

                DB::table('operatorservicedata')->insert([
                    'user_id' => $userId,
                    'service_id' => $serviceId,
                    'hour_price' => round((float) ($service['hourlyRate'] ?? 0), 2),
                    'home_photo_enabled' => (int) ($service['homePhotoEnabled'] ?? true),
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                $featureIds = array_values(array_unique(array_map('intval', $service['featureIds'] ?? [])));
                foreach ($featureIds as $featureId) {
                    if ($featureId <= 0) {
                        continue;
                    }

                    DB::table('operatorservicefeaturedata')->insert([
                        'user_id' => $userId,
                        'service_id' => $serviceId,
                        'feature_id' => $featureId,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }
            }

            DB::table('operatorgallery')->where('user_id', $userId)->delete();
            $galleryItems = $payload['gallery'] ?? [];
            foreach ($galleryItems as $index => $item) {
                $photo = trim((string) ($item['photo'] ?? ''));
                if ($photo === '') {
                    continue;
                }

                DB::table('operatorgallery')->insert([
                    'user_id' => $userId,
                    'photo' => $photo,
                    'caption' => (string) ($item['caption'] ?? ''),
                    'sortorder' => $index + 1,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        });

        return $this->getOperatorProfile($userId);
    }

    public function getCalendarMonthOverview(int $userId, int $year, int $month): array
    {
        $startDate = sprintf('%04d-%02d-01', $year, $month);
        $endDate = date('Y-m-t', strtotime($startDate));

        $rows = DB::table('calendar_day as cd')
            ->leftJoin('calendar_day_slot as cds', 'cds.calendar_day_id', '=', 'cd.id')
            ->leftJoin('calendar_day_slot_service as cdss', 'cdss.slot_id', '=', 'cds.id')
            ->select([
                'cd.date',
                'cd.enabled',
                DB::raw('COUNT(DISTINCT cds.id) as slot_count'),
                DB::raw('COUNT(DISTINCT CASE WHEN cdss.enabled = 1 THEN CONCAT(cds.id, "-", cdss.service_id) END) as service_count'),
                DB::raw('(SELECT COALESCE(SUM(TIME_TO_SEC(TIMEDIFF(inner_slot.end_time, inner_slot.start_time)) / 60), 0) FROM calendar_day_slot inner_slot WHERE inner_slot.calendar_day_id = cd.id AND inner_slot.enabled = 1) as total_minutes'),
            ])
            ->where('cd.user_id', $userId)
            ->whereBetween('cd.date', [$startDate, $endDate])
            ->groupBy('cd.id', 'cd.date', 'cd.enabled')
            ->get();

        $mapped = [];
        foreach ($rows as $row) {
            $mapped[(string) $row->date] = [
                'date' => (string) $row->date,
                'enabled' => (bool) $row->enabled,
                'slotCount' => (int) $row->slot_count,
                'serviceCount' => (int) $row->service_count,
                'totalMinutes' => (int) $row->total_minutes,
            ];
        }

        $days = [];
        $totalDays = (int) date('t', strtotime($startDate));
        for ($day = 1; $day <= $totalDays; $day += 1) {
            $date = sprintf('%04d-%02d-%02d', $year, $month, $day);
            $days[] = $mapped[$date] ?? [
                'date' => $date,
                'enabled' => false,
                'slotCount' => 0,
                'serviceCount' => 0,
                'totalMinutes' => 0,
            ];
        }

        return [
            'year' => $year,
            'month' => $month,
            'bookingConfirmationMode' => ((string) DB::table('operatordata')->where('user_id', $userId)->value('booking_confirmation_mode')) === 'automatic' ? 'automatic' : 'manual',
            'days' => $days,
        ];
    }

    public function getCalendarDay(int $userId, string $date): array
    {
        $day = DB::table('calendar_day')
            ->select(['id', 'date', 'enabled'])
            ->where('user_id', $userId)
            ->where('date', $date)
            ->first();

        if (! $day) {
            return [
                'date' => $date,
                'enabled' => false,
                'slots' => [],
            ];
        }

        $slots = DB::table('calendar_day_slot')
            ->select(['id', 'start_time', 'end_time', 'enabled', 'sortorder'])
            ->where('calendar_day_id', (int) $day->id)
            ->orderBy('sortorder')
            ->orderBy('start_time')
            ->get()
            ->map(function ($slot) {
                $services = DB::table('calendar_day_slot_service')
                    ->select(['service_id', 'enabled', 'hour_price'])
                    ->where('slot_id', (int) $slot->id)
                    ->orderBy('service_id')
                    ->get()
                    ->map(fn ($service) => [
                        'serviceId' => (int) $service->service_id,
                        'enabled' => (bool) $service->enabled,
                        'hourlyRate' => round((float) $service->hour_price, 2),
                    ])
                    ->all();

                return [
                    'id' => (int) $slot->id,
                    'startTime' => (string) $slot->start_time,
                    'endTime' => (string) $slot->end_time,
                    'enabled' => (bool) $slot->enabled,
                    'services' => $services,
                ];
            })
            ->all();

        return [
            'date' => (string) $day->date,
            'enabled' => (bool) $day->enabled,
            'slots' => $slots,
        ];
    }

    public function saveCalendarDay(int $userId, array $payload): array
    {
        $date = (string) ($payload['date'] ?? '');
        $enabled = ! empty($payload['enabled']);
        $slots = is_array($payload['slots'] ?? null) ? $payload['slots'] : [];
        $now = time();

        DB::transaction(function () use ($userId, $date, $enabled, $slots, $now) {
            DB::table('calendar_day')->updateOrInsert(
                [
                    'user_id' => $userId,
                    'date' => $date,
                ],
                [
                    'enabled' => $enabled ? 1 : 0,
                    'updated_at' => $now,
                    'created_at' => $now,
                ]
            );

            $dayId = (int) DB::table('calendar_day')
                ->where('user_id', $userId)
                ->where('date', $date)
                ->value('id');

            $slotIds = DB::table('calendar_day_slot')
                ->where('calendar_day_id', $dayId)
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->all();

            if ($slotIds !== []) {
                DB::table('calendar_day_slot_service')->whereIn('slot_id', $slotIds)->delete();
            }
            DB::table('calendar_day_slot')->where('calendar_day_id', $dayId)->delete();

            foreach ($slots as $index => $slot) {
                if (! is_array($slot)) {
                    continue;
                }

                $slotId = (int) DB::table('calendar_day_slot')->insertGetId([
                    'calendar_day_id' => $dayId,
                    'start_time' => (string) ($slot['startTime'] ?? ''),
                    'end_time' => (string) ($slot['endTime'] ?? ''),
                    'enabled' => ! empty($slot['enabled']) ? 1 : 0,
                    'sortorder' => $index + 1,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                $services = is_array($slot['services'] ?? null) ? $slot['services'] : [];
                foreach ($services as $service) {
                    if (! is_array($service)) {
                        continue;
                    }

                    $serviceId = (int) ($service['serviceId'] ?? 0);
                    if ($serviceId <= 0) {
                        continue;
                    }

                    DB::table('calendar_day_slot_service')->insert([
                        'slot_id' => $slotId,
                        'service_id' => $serviceId,
                        'enabled' => ! empty($service['enabled']) ? 1 : 0,
                        'hour_price' => round((float) ($service['hourlyRate'] ?? 0), 2),
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }
            }
        });

        return $this->getCalendarDay($userId, $date);
    }

    public function copyCalendarDay(int $userId, string $sourceDate, array $targetDates): array
    {
        $source = $this->getCalendarDay($userId, $sourceDate);
        $copied = 0;

        foreach ($targetDates as $targetDate) {
            $normalizedTarget = (string) $targetDate;
            if ($normalizedTarget === '' || $normalizedTarget === $sourceDate) {
                continue;
            }

            $this->saveCalendarDay($userId, [
                'date' => $normalizedTarget,
                'enabled' => $source['enabled'] ?? false,
                'slots' => $source['slots'] ?? [],
            ]);
            $copied += 1;
        }

        return [
            'sourceDate' => $sourceDate,
            'copiedCount' => $copied,
        ];
    }

    private function ensureOperatorMetadataSeeded(): void
    {
        $now = time();

        $titles = [
            ['id' => 1, 'name' => 'Addestratore', 'sortorder' => 10],
            ['id' => 2, 'name' => 'Educatore', 'sortorder' => 20],
            ['id' => 3, 'name' => 'Veterinario', 'sortorder' => 30],
            ['id' => 4, 'name' => 'Petsitter', 'sortorder' => 40],
            ['id' => 5, 'name' => 'Toelettatore', 'sortorder' => 50],
            ['id' => 6, 'name' => 'Operatore Olistico', 'sortorder' => 60],
        ];

        foreach ($titles as $title) {
            DB::table('operatortitle')->updateOrInsert(
                ['id' => $title['id']],
                [
                    'name' => $title['name'],
                    'sortorder' => $title['sortorder'],
                    'created_at' => $now,
                    'updated_at' => $now,
                ]
            );
        }

        $petGroups = [
            [101, 'Cani', 'Cani da pastore e bovari'], [102, 'Cani', 'Pinscher, Schnauzer, Molossi e bovari svizzeri'],
            [103, 'Cani', 'Terrier'], [104, 'Cani', 'Bassotti'], [105, 'Cani', 'Spitz e tipo primitivo'],
            [106, 'Cani', 'Segugi e cani per pista di sangue'], [107, 'Cani', 'Cani da ferma'],
            [108, 'Cani', 'Cani da riporto, da cerca e da acqua'], [109, 'Cani', 'Cani da compagnia'],
            [110, 'Cani', 'Levrieri'], [111, 'Cani', 'Meticci e non classificati'],
            [201, 'Gatti', 'Pelo lungo e persiani/esotici'], [202, 'Gatti', 'Pelo semilungo'], [203, 'Gatti', 'Pelo corto e somali'],
            [204, 'Gatti', 'Orientali, siamesi e affini'], [205, 'Gatti', 'Gatti domestici, meticci o non classificati'],
            [301, 'Conigli', 'Conigli nani e piccoli'], [302, 'Conigli', 'Conigli medi'], [303, 'Conigli', 'Conigli grandi e giganti'],
            [304, 'Conigli', 'Conigli ariete e a pelo lungo'], [401, 'Furetti', 'Furetti'],
            [411, 'Piccoli mammiferi', 'Criceti, gerbilli, topi e ratti domestici'], [412, 'Piccoli mammiferi', 'Cavie e porcellini d’India'],
            [413, 'Piccoli mammiferi', 'Cincillà e degu'], [414, 'Piccoli mammiferi', 'Ricci domestici e altri piccoli insettivori'],
            [415, 'Piccoli mammiferi', 'Altri piccoli mammiferi da compagnia'], [501, 'Uccelli', 'Psittaciformi · pappagalli e parrocchetti'],
            [502, 'Uccelli', 'Passeriformi · canarini, fringillidi e affini'], [503, 'Uccelli', 'Columbiformi e altri uccelli ornamentali'],
            [504, 'Uccelli', 'Uccelli da cortile tenuti come compagnia'], [601, 'Rettili', 'Sauri · lucertole, gechi e iguane'],
            [602, 'Rettili', 'Cheloni · tartarughe terrestri e acquatiche'], [603, 'Rettili', 'Serpenti e altri rettili'],
            [701, 'Anfibi', 'Anuri e urodeli · rane, rospi, tritoni e salamandre'], [801, 'Pesci ornamentali', 'Acqua dolce tropicale'],
            [802, 'Pesci ornamentali', 'Acqua fredda'], [803, 'Pesci ornamentali', 'Marini e di barriera'],
            [901, 'Invertebrati', 'Invertebrati terrestri e acquatici da compagnia'], [1001, 'Equidi', 'Cavalli, pony e asini da compagnia'],
            [1101, 'Altri pet', 'Altri animali da compagnia consentiti'],
        ];

        foreach ($petGroups as $index => [$id, $category, $name]) {
            DB::table('petbreed')->updateOrInsert(
                ['id' => $id],
                ['category' => $category, 'name' => $name, 'sortorder' => ($index + 1) * 10, 'created_at' => $now, 'updated_at' => $now]
            );
        }

        $petTypes = [
            ['id' => 9, 'name' => 'Qualsiasi', 'sortorder' => 0],
            ['id' => 1, 'name' => 'Docile', 'sortorder' => 10],
            ['id' => 2, 'name' => 'Aggressivo con persone', 'sortorder' => 20],
            ['id' => 3, 'name' => 'Aggressivo con pet', 'sortorder' => 30],
            ['id' => 4, 'name' => 'Ansioso', 'sortorder' => 40],
            ['id' => 5, 'name' => 'Iperattivo', 'sortorder' => 50],
            ['id' => 6, 'name' => 'Anziano', 'sortorder' => 60],
            ['id' => 7, 'name' => 'Cucciolo', 'sortorder' => 70],
            ['id' => 8, 'name' => 'Con esigenze speciali', 'sortorder' => 80],
            ['id' => 10, 'name' => 'Malato', 'sortorder' => 90],
        ];

        foreach ($petTypes as $petType) {
            DB::table('pettype')->updateOrInsert(
                ['id' => $petType['id']],
                [
                    'name' => $petType['name'],
                    'sortorder' => $petType['sortorder'],
                    'created_at' => $now,
                    'updated_at' => $now,
                ]
            );
        }

        if (! DB::table('housefeature')->exists()) {
            $houseFeatures = [
                ['id' => 1, 'name' => 'Giardino (recintato SI/NO)', 'sortorder' => 10],
                ['id' => 2, 'name' => 'Appartamento', 'sortorder' => 20],
                ['id' => 3, 'name' => 'Casa indipendente', 'sortorder' => 30],
                ['id' => 4, 'name' => 'Villa', 'sortorder' => 40],
                ['id' => 5, 'name' => 'Terrazzo (piccolo medio grande)', 'sortorder' => 50],
                ['id' => 6, 'name' => 'Confinamento (zona dedicata, cuccia interna/esterna, intera casa)', 'sortorder' => 60],
                ['id' => 7, 'name' => 'Presenza altri animali', 'sortorder' => 70],
                ['id' => 8, 'name' => 'Presenza ascensore', 'sortorder' => 80],
            ];

            foreach ($houseFeatures as $houseFeature) {
                DB::table('housefeature')->updateOrInsert(
                    ['id' => $houseFeature['id']],
                    [
                        'name' => $houseFeature['name'],
                        'sortorder' => $houseFeature['sortorder'],
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]
                );
            }
        }
    }

    private function normalizePhotoUrl(string $value): string
    {
        $trimmed = trim($value);
        if ($trimmed === '') {
            return '';
        }

        if (str_starts_with($trimmed, 'http://') || str_starts_with($trimmed, 'https://') || str_starts_with($trimmed, '/')) {
            return $trimmed;
        }

        return '/storage/'.$trimmed;
    }
}
