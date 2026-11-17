// Errors on the screen are sent to the Worker, which logs them beside its
// own, so a problem on someone's phone can be looked up afterwards.
function report(message: string, stack: string) {
	navigator.sendBeacon('/api/errors', new Blob([JSON.stringify({message, stack})], {type: 'application/json'}));
}

window.addEventListener('error', (event) => report(event.message, event.error instanceof Error ? (event.error.stack ?? '') : ''));
window.addEventListener('unhandledrejection', (event) => {
	const reason: unknown = event.reason;
	report(reason instanceof Error ? reason.message : String(reason), reason instanceof Error ? (reason.stack ?? '') : '');
});
