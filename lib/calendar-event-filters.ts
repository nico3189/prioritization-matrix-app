export interface CalendarEventAttendeeLike {
	self?: boolean
	responseStatus?: string | null
}

/** Skjul begivenheder hvor den loggede bruger har meldt afbud. */
export function isEventDeclinedByUser(
	attendees?: CalendarEventAttendeeLike[] | null
): boolean {
	const self = attendees?.find((a) => a.self)
	if (!self) return false
	return self.responseStatus === 'declined'
}
