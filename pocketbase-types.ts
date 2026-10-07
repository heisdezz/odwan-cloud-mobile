/**
* This file was @generated using pocketbase-typegen
*/

import type PocketBase from 'pocketbase'
import type { RecordService } from 'pocketbase'

export const Collections = {
	Authorigins: "_authOrigins",
	Externalauths: "_externalAuths",
	Mfas: "_mfas",
	Otps: "_otps",
	Superusers: "_superusers",
	Album: "album",
	LibraryStats: "library_stats",
	MediaItem: "media_item",
	MediaTag: "media_tag",
	Tag: "tag",
	Users: "users",
} as const
export type Collections = typeof Collections[keyof typeof Collections]

// Alias types for improved usability
export type IsoDateString = string
export type IsoAutoDateString = string & { readonly autodate: unique symbol }
export type RecordIdString = string
export type FileNameString = string & { readonly filename: unique symbol }
export type HTMLString = string

type ExpandType<T> = unknown extends T
	? T extends unknown
		? { expand?: unknown }
		: { expand: T }
	: { expand: T }

// System fields
export type BaseSystemFields<T = unknown> = {
	id: RecordIdString
	collectionId: string
	collectionName: Collections
} & ExpandType<T>

export type AuthSystemFields<T = unknown> = {
	email: string
	emailVisibility: boolean
	username: string
	verified: boolean
} & BaseSystemFields<T>

// Record types for each collection

export type AuthoriginsRecord = {
	collectionRef: string
	created: IsoAutoDateString
	fingerprint: string
	id: string
	recordRef: string
	updated: IsoAutoDateString
}

export type ExternalauthsRecord = {
	collectionRef: string
	created: IsoAutoDateString
	id: string
	provider: string
	providerId: string
	recordRef: string
	updated: IsoAutoDateString
}

export type MfasRecord = {
	collectionRef: string
	created: IsoAutoDateString
	id: string
	method: string
	recordRef: string
	updated: IsoAutoDateString
}

export type OtpsRecord = {
	collectionRef: string
	created: IsoAutoDateString
	id: string
	password: string
	recordRef: string
	sentTo?: string
	updated: IsoAutoDateString
}

export type SuperusersRecord = {
	created: IsoAutoDateString
	email: string
	emailVisibility?: boolean
	id: string
	password: string
	tokenKey: string
	updated: IsoAutoDateString
	verified?: boolean
}

export type AlbumRecord = {
	cover_media_id?: RecordIdString
	created_at: IsoAutoDateString
	description?: string
	id: string
	media_count?: number
	name: string
	relative_path: string
}

export type LibraryStatsRecord = {
	albums?: number
	db_exists?: boolean
	db_size_bytes?: number
	db_size_formatted?: string
	id: string
	images?: number
	tags?: number
	total_items?: number
	videos?: number
}

export const MediaItemUploadStatusOptions = {
	"pending": "pending",
	"uploading": "uploading",
	"success": "success",
	"error": "error",
} as const
export type MediaItemUploadStatusOptions = typeof MediaItemUploadStatusOptions[keyof typeof MediaItemUploadStatusOptions]

export const MediaItemStorageBackendOptions = {
	"telegram": "telegram",
	"s3": "s3",
} as const
export type MediaItemStorageBackendOptions = typeof MediaItemStorageBackendOptions[keyof typeof MediaItemStorageBackendOptions]
export type MediaItemRecord = {
	album_id?: RecordIdString
	created_at: IsoAutoDateString
	current_relative_path: string
	duration_seconds?: number
	file_hash: string
	file_size?: number
	id: string
	metadata_json?: string
	mime_type: string
	original_relative_path: string
	storage_backend?: MediaItemStorageBackendOptions
	storage_bucket?: string
	storage_etag?: string
	storage_key?: string
	upload_status: MediaItemUploadStatusOptions
}

export type MediaTagRecord = {
	id: string
	media_id: RecordIdString
	tag_id: RecordIdString
}

export type TagRecord = {
	category: string
	color_hex: string
	id: string
	media_count?: number
	name: string
}

export type UsersRecord = {
	avatar?: FileNameString
	created: IsoAutoDateString
	email: string
	emailVisibility?: boolean
	id: string
	name?: string
	password: string
	tokenKey: string
	updated: IsoAutoDateString
	verified?: boolean
}

// Response types include system fields and match responses from the PocketBase API
export type AuthoriginsResponse<Texpand = unknown> = Required<AuthoriginsRecord> & BaseSystemFields<Texpand>
export type ExternalauthsResponse<Texpand = unknown> = Required<ExternalauthsRecord> & BaseSystemFields<Texpand>
export type MfasResponse<Texpand = unknown> = Required<MfasRecord> & BaseSystemFields<Texpand>
export type OtpsResponse<Texpand = unknown> = Required<OtpsRecord> & BaseSystemFields<Texpand>
export type SuperusersResponse<Texpand = unknown> = Required<SuperusersRecord> & AuthSystemFields<Texpand>
export type AlbumResponse<Texpand = unknown> = Required<AlbumRecord> & BaseSystemFields<Texpand>
export type LibraryStatsResponse<Texpand = unknown> = Required<LibraryStatsRecord> & BaseSystemFields<Texpand>
export type MediaItemResponse<Texpand = unknown> = Required<MediaItemRecord> & BaseSystemFields<Texpand>
export type MediaTagResponse<Texpand = unknown> = Required<MediaTagRecord> & BaseSystemFields<Texpand>
export type TagResponse<Texpand = unknown> = Required<TagRecord> & BaseSystemFields<Texpand>
export type UsersResponse<Texpand = unknown> = Required<UsersRecord> & AuthSystemFields<Texpand>

// Types containing all Records and Responses, useful for creating typing helper functions

export type CollectionRecords = {
	_authOrigins: AuthoriginsRecord
	_externalAuths: ExternalauthsRecord
	_mfas: MfasRecord
	_otps: OtpsRecord
	_superusers: SuperusersRecord
	album: AlbumRecord
	library_stats: LibraryStatsRecord
	media_item: MediaItemRecord
	media_tag: MediaTagRecord
	tag: TagRecord
	users: UsersRecord
}

export type CollectionResponses = {
	_authOrigins: AuthoriginsResponse
	_externalAuths: ExternalauthsResponse
	_mfas: MfasResponse
	_otps: OtpsResponse
	_superusers: SuperusersResponse
	album: AlbumResponse
	library_stats: LibraryStatsResponse
	media_item: MediaItemResponse
	media_tag: MediaTagResponse
	tag: TagResponse
	users: UsersResponse
}

// Utility types for create/update operations

type ProcessCreateAndUpdateFields<T> = Omit<{
	// Omit AutoDate fields
	[K in keyof T as Extract<T[K], IsoAutoDateString> extends never ? K : never]: 
		// Convert FileNameString to File
		T[K] extends infer U ? 
			U extends (FileNameString | FileNameString[]) ? 
				U extends any[] ? File[] : File 
			: U
		: never
}, 'id'>

// Create type for Auth collections
export type CreateAuth<T> = {
	id?: RecordIdString
	email: string
	emailVisibility?: boolean
	password: string
	passwordConfirm: string
	verified?: boolean
} & ProcessCreateAndUpdateFields<T>

// Create type for Base collections
export type CreateBase<T> = {
	id?: RecordIdString
} & ProcessCreateAndUpdateFields<T>

// Update type for Auth collections
export type UpdateAuth<T> = Partial<
	Omit<ProcessCreateAndUpdateFields<T>, keyof AuthSystemFields>
> & {
	email?: string
	emailVisibility?: boolean
	oldPassword?: string
	password?: string
	passwordConfirm?: string
	verified?: boolean
}

// Update type for Base collections
export type UpdateBase<T> = Partial<
	Omit<ProcessCreateAndUpdateFields<T>, keyof BaseSystemFields>
>

// Get the correct create type for any collection
export type Create<T extends keyof CollectionResponses> =
	CollectionResponses[T] extends AuthSystemFields
		? CreateAuth<CollectionRecords[T]>
		: CreateBase<CollectionRecords[T]>

// Get the correct update type for any collection
export type Update<T extends keyof CollectionResponses> =
	CollectionResponses[T] extends AuthSystemFields
		? UpdateAuth<CollectionRecords[T]>
		: UpdateBase<CollectionRecords[T]>

// Type for usage with type asserted PocketBase instance
// https://github.com/pocketbase/js-sdk#specify-typescript-definitions

export type TypedPocketBase = {
	collection<T extends keyof CollectionResponses>(
		idOrName: T
	): RecordService<CollectionResponses[T]>
} & PocketBase
